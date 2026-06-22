# Demo Video Script (2–3 minutes)

A tight, ordered walkthrough that shows all four required use cases in one clean
screen recording. Total runtime ~2.5 minutes at a relaxed pace.

## Before you record
1. `npm install`, set your key in `.env`, then `npm run dev`.
2. Open **http://localhost:3000** in a clean browser window (close other tabs).
3. Have this script on a second screen/phone so you can read the lines to type.
4. Wait for each reply to finish before typing the next line.

## Recording method (Mac)
- **Built-in:** press **⌘ + Shift + 5**, choose "Record Selected Portion," frame
  the chat window, and click Record. Stop from the menu bar; the file saves to the
  Desktop.
- **Nicer result:** [QuickTime Player → File → New Screen Recording], or
  [Loom](https://www.loom.com) if you want webcam + voiceover in one take.
- Keep it to one continuous take. Optionally add a 5-second voiceover intro.

---

## The script

### 0:00 — Intro (say to camera or as voiceover)
> "This is a custom customer-support chatbot I built for an outdoor gear store.
> It's a from-scratch LLM app — Claude with tool calling over the store's real
> order, catalog, and policy data. Let me show the four things it does."

Show the landing screen (greeting + suggestion chips visible).

### 0:15 — Use case 1: Order tracking
Type:
```
Where is my order SP-100001?
```
**Point out:** it returns live status, carrier, tracking number, ETA, and the
items — and note the little `⚙ get_order_status` tool badge under the reply.

### 0:40 — Use case 2: Returns & exchanges (with confirmation flow)
Type:
```
I want to return the tent from order SP-100002
```
Wait for Pine to **confirm** the item, then type (this preempts its reason +
condition questions so the RMA is created in one step):
```
yes, it's the wrong size and it's unused with the tags still on
```
**Point out:** it checked the 30-day window, opened an RMA, and gave next steps and
the refund timeline — grounded in the store's real return policy.

### 1:15 — Use case 3: Product recommendations (clarify → recommend)
Type:
```
I need a jacket
```
Pine should ask a **clarifying question** (season/use). Then type:
```
something warm for winter hiking, under $250
```
**Point out:** vague request handled with a clarifying question, then ranked,
in-stock suggestions with prices.

### 1:50 — Use case 4: Human handoff
Type:
```
This is frustrating — my order arrived damaged and I want to talk to a real person
```
**Point out:** the bot recognizes frustration + an out-of-scope issue, escalates,
creates a ticket, and shows the "handed off to a human agent" banner.

### 2:20 — (Optional) Graceful fallback
Type:
```
track order SP-999999
```
**Point out:** unknown order is handled gracefully — it asks for a valid id/email
instead of failing or hallucinating.

### 2:35 — Close
> "Four use cases, a real tool-calling LLM under the hood, and a swappable data
> layer so it drops onto real store data. Thanks for watching."

---

## Tips
- Speak to *what just happened* after each reply — graders look for the four use
  cases plus good conversation design (confirmations, clarifying questions,
  fallbacks). This script hits all of them.
- If a reply is long, scroll calmly so it's readable on playback.
- The tool badges (`⚙ get_order_status`, etc.) are great visual proof that real
  function calls are happening — call them out.
