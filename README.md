# Summit & Pine — Customer-Support AI Chatbot

A custom LLM customer-support chatbot for **Summit & Pine Outfitters**, a small
e-commerce business selling outdoor apparel and camping gear. It handles the four
support jobs a store actually needs — **order tracking, returns & exchanges,
product recommendations, and human handoff** — through a clean web chat UI backed
by an LLM with real tool/function calling.

It's a from-scratch code build (not a no-code export): an Anthropic **Claude**
model drives the conversation and calls typed tools that read from a swappable
mock-data layer. Policy answers are grounded in the store's actual policy
documents, so the bot won't invent rules.

> Built as a deliverable for the Upwork *Talent Accelerator: AI Chatbot Developer*
> assignment, and as a portfolio piece demonstrating LLM tool-use integration.

---

## What it does

| # | Use case | How it works |
|---|----------|--------------|
| 1 | **Order tracking** | Looks up an order by id and/or email and reports status, carrier, tracking number, ETA, and contents. |
| 2 | **Returns & exchanges** | Explains the policy, checks the 30-day return window for the order, and opens a return/exchange with an RMA number and next steps. |
| 3 | **Product recommendations** | Turns a plain-language need ("a warm jacket for winter hiking") into ranked, in-stock catalog suggestions with prices. |
| 4 | **Human handoff** | Detects frustration, explicit requests, or out-of-scope issues and escalates to a human — capturing a summary and a ticket id. |

Throughout, the assistant ("Pine") greets users, asks focused clarifying
questions, confirms before taking actions, and falls back gracefully on unknown
orders or vague requests.

---

## Architecture

```
Browser chat UI  (public/index.html)
        │  POST /api/chat { sessionId, message }
        ▼
Express server   (src/server.ts)  ── in-memory session store
        │
        ▼
Conversation     (src/agent.ts)   ── Anthropic Messages API + tool-use loop
        │                              keeps full message history per session
        ├── system prompt          (src/prompt.ts)  ◄── policies + FAQs injected
        │
        ▼
Tool layer       (src/tools.ts)   ── 4 typed tools, JSON in / JSON out
        │
        ▼
Data layer       (src/data.ts)    ── reads /data/*.json  (← swap point)
```

**The tool-use loop** (`src/agent.ts`): each user message is sent to Claude with
the four tool definitions. If Claude returns `tool_use`, the server runs the tool
locally, feeds the JSON result back, and loops until Claude produces a final
natural-language reply. History is retained per `sessionId` so context carries
across turns.

**Grounding:** the store's policies and FAQs (`data/policies.json`) are injected
into the system prompt, and the bot is instructed to answer policy questions only
from that source and to use tools — never invent — for order, return, and
recommendation specifics.

### The four tools

| Tool | Purpose |
|------|---------|
| `get_order_status` | Find an order by id/email; returns status + tracking + items + return eligibility. |
| `start_return_or_exchange` | Verify the order/item, check the return window, open the request, return an RMA + next steps. |
| `recommend_products` | Score the in-stock catalog against the customer's need (+ optional category/price filters). |
| `escalate_to_human` | Hand off to a human with a captured summary, contact, urgency, and ticket id. |

### Project layout

```
.
├── data/                 # ← swappable mock data (the only files to replace for real data)
│   ├── products.json     #   catalog
│   ├── orders.json       #   orders
│   └── policies.json     #   business info, policies, FAQs
├── public/
│   └── index.html        # web chat UI (self-contained)
├── src/
│   ├── types.ts          # shared domain types
│   ├── data.ts           # data-access + return-eligibility logic
│   ├── tools.ts          # tool definitions + executor
│   ├── prompt.ts         # system prompt (injects policies/FAQs)
│   ├── agent.ts          # Anthropic tool-use loop + per-session history
│   ├── server.ts         # Express server + /api/chat
│   └── cli.ts            # optional terminal chat
├── .env.example
└── README.md
```

---

## Setup & run

**Requirements:** Node.js 18+ and an [Anthropic API key](https://console.anthropic.com/settings/keys).

```bash
# 1. Install
npm install

# 2. Configure your key
cp .env.example .env
#   then edit .env and set ANTHROPIC_API_KEY=sk-ant-...

# 3. Run the web app
npm run dev          # http://localhost:3000  (auto-reload)
#   or:  npm start

# Optional: chat in the terminal instead
npm run cli
```

Then open **http://localhost:3000** and use the suggested chips or type your own
message. There's nothing else to configure — no database, no live deployment.

Useful: `npm run typecheck` validates the TypeScript.

---

## Swapping in real business data

The data layer is deliberately isolated. To go from the placeholder store to real
data, **replace the three JSON files in `data/`** — keeping the same shape — and
nothing else changes:

- `data/products.json` — catalog (`id`, `name`, `category`, `price`, `inStock`, `description`, `tags`, `specs`).
- `data/orders.json` — orders (`orderId`, `email`, `status`, dates, `carrier`, `trackingNumber`, `items`, `total`).
- `data/policies.json` — `business` info, `policies[]` (injected into the prompt), and `faqs[]`.

If your real data lives in an API or database instead of JSON, implement the same
functions exported from `src/data.ts` (`findOrder`, `returnEligibility`,
`products`, etc.) against your source — the tools and agent are unaffected.

> The mock data uses a fixed "today" (2026-06-22) in `src/data.ts` so return-window
> math is deterministic for demos. Remove that constant to use the real current date.

---

## Sample conversation

Representative transcripts against the included mock data (the assistant's wording
will vary naturally; tool calls and data are exact).

**1 — Order tracking**

> **You:** Where is my order SP-100001?
> **Pine:** Good news, Alex — order **SP-100001** has shipped! 📦 It's on its way via **UPS** (tracking `1Z999AA10123456784`), with delivery estimated by **June 24**. It contains the Trailblazer Waterproof Hiking Boots (US 10) and a Ridge Midweight Fleece (M). Anything else I can help with?
> *⚙ get_order_status*

**2 — Returns & exchanges**

> **You:** I'd like to return the tent from order SP-100002.
> **Pine:** Sure! Just to confirm — you'd like to return the **Aurora 2-Person Backpacking Tent** from order **SP-100002** for a refund?
> **You:** Yes please.
> **Pine:** Done! That order was delivered 12 days ago, so it's within our 30-day window. I've opened return **RMA-100002-AURORA2**. A prepaid FedEx label will be emailed to jamie.chen@example.com — pack the tent in original condition with tags and drop it off within 14 days. Your refund of **$249.99** lands on your original payment method 5–7 business days after we receive it. 🌲
> *⚙ start_return_or_exchange*

**3 — Product recommendations**

> **You:** Can you recommend a warm jacket for winter hiking?
> **Pine:** Absolutely. For cold, dry winter hikes I'd reach for the **Summit Insulated Down Jacket** ($199.99) — 800-fill down, packable, and seriously warm. If you also expect rain or wind, pair or swap in the **Storm Hardshell Rain Jacket** ($179.99). Want me to narrow it down by budget or layering plan?
> *⚙ recommend_products*

**4 — Human handoff**

> **You:** This is ridiculous, my package is damaged and I want to talk to a real person.
> **Pine:** I'm really sorry about the damaged package, Morgan — that's frustrating and I want to get it sorted. I've created ticket **ESC-00004** and passed your conversation to a human agent with the details. They're available Monday–Friday, 8am–6pm Mountain Time and will follow up. You can also reach us at support@summitandpine.example.
> *⚙ escalate_to_human* · 👤 *handed off to a human agent*

**Graceful fallback (unknown order)**

> **You:** Track order SP-999999
> **Pine:** I couldn't find an order with that number. Could you double-check the id (it looks like "SP-100001") or share the email you used at checkout? I'll take another look.
> *⚙ get_order_status*

---

## Demo video

A ready-to-record, 2–3 minute walkthrough script lives in
**[DEMO_SCRIPT.md](DEMO_SCRIPT.md)** — exact messages to type, in order, to show
all four use cases in one clean screen recording.

---

## Tech

TypeScript · Node.js · Express · Anthropic Claude (Messages API + tool use) ·
vanilla HTML/CSS/JS UI. Run with [`tsx`](https://github.com/privatenumber/tsx) —
no build step. Secrets via `.env` (never committed).

## License

MIT
