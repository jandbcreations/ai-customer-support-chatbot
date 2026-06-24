# 👋 Read me first — reviewer notes

Hi Asif — thanks for the feedback! Both requested changes are done. Here's the
quick version.

**Code repository:** https://github.com/jandbcreations/ai-customer-support-chatbot

## 1. You can now test everything **without an API key**

The chat previously needed an `ANTHROPIC_API_KEY`. It no longer does. With **no key
set**, the bot starts in an **offline mock mode** that drives the *same tools and
data* as the live model, so you can verify **every feature end-to-end** without a key.

```bash
npm install
npm run dev
```

Then open **http://localhost:3000**. The header will show **"offline demo mode"** so
you know the no-key engine is active. (If you'd rather use the live Claude model,
copy `.env.example` to `.env` and add a key — it switches automatically.)

> No key is shared in this package for security reasons; the offline mode exists so
> the key is never needed for review.

## 2. Shipping info is integrated

Ask about shipping and the bot returns both durations from the provided data via a
dedicated `get_shipping_info` tool:
- **Standard:** 3–5 business days
- **Expedited:** 1–2 business days

## Try it — copy/paste these to test each feature

| Feature | Type this |
|---------|-----------|
| Order tracking (asks for number) | `where's my package?` then `111` |
| Order: processing | `track order 222` |
| Order: delivered (with follow-up) | `check order 333` |
| Invalid order | `track order 999` |
| **Shipping durations** | `how long does shipping take?` |
| Returns & exchanges | `what's your return policy?` |
| Recommendation (asks, then recommends a category) | `I need a jacket` then `something warm for winter hiking` |
| Fallback (didn't understand) | `asdf qwerty zzz` |
| Human handoff → Live Agent | `I'd like to talk to a real person` |

The small `⚙` badge under each reply shows which backend tool ran.

## Where things are
- **How it works, architecture, data, swapping data:** `README.md`
- **2–3 min demo walkthrough:** `DEMO_SCRIPT.md`
- **Mock data:** `data/` (`orders.json`, `categories.json`, `policies.json`)
- **Source:** `src/` · **Web UI:** `public/index.html`
- **Public repo:** https://github.com/jandbcreations/ai-customer-support-chatbot

Happy to make any further tweaks — thanks!
