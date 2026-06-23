# Demo Video Script (2–3 minutes)

A tight, ordered walkthrough that shows **all four required use cases plus a
fallback scenario** in one clean screen recording. ~2.5 minutes at a relaxed pace.

## Before you record
1. `npm install`, set your key in `.env` (or `.env.local`), then `npm run dev`.
2. Open **http://localhost:3000** in a clean browser window (close other tabs).
3. Have this script on a second screen/phone so you can read the lines to type.
4. Wait for each reply to finish before typing the next line.

## Recording method (Mac)
- **Built-in:** press **⌘ + Shift + 5**, choose "Record Selected Portion," frame
  the chat window, and click Record. Stop from the menu bar; the file saves to the
  Desktop.
- **Nicer result:** QuickTime → File → New Screen Recording, or
  [Loom](https://www.loom.com) for webcam + voiceover in one take.
- Keep it to one continuous take. Optionally add a short voiceover intro.

---

## The script

### 0:00 — Intro (voiceover or on camera)
> "This is the North Star Support Bot — a custom customer-support chatbot I built
> for an outdoor gear store. It's a from-scratch LLM app: Claude with tool calling
> over the store's order, policy, and product data. Here are the four things it
> does, plus how it handles something it doesn't understand."

Show the landing screen (greeting + suggestion chips).

### 0:15 — Use case 1: Order tracking (with intent recognition)
Type a natural phrasing that isn't the literal word "track":
```
where's my package?
```
The bot asks for the order number. Then type:
```
#111
```
**Point out:** it understood the intent, asked for the number, and returned the
simulated status ("Shipped — arriving tomorrow") with the `⚙ get_order_status`
tool badge.

### 0:45 — Use case 2: Returns & exchanges
Type:
```
what's your return policy?
```
**Point out:** 30 days, unused, original packaging, **plus the returns link** —
all from the provided data, nothing invented.

### 1:10 — Use case 3: Product recommendations (clarify → category)
Type a vague request so the clarifying step shows:
```
I need a jacket
```
The bot asks 1–2 clarifying questions. Then answer:
```
something warm for winter hiking
```
**Point out:** it asked clarifying questions first, then recommended a product
**category** (Insulated Jackets) with the `⚙ recommend_category` badge.

### 1:40 — Fallback scenario (required)
Type something it can't parse:
```
asdf qwerty zzz
```
**Point out:** a clear "I didn't catch that" plus the four options offered — this
is the required fallback handling.

### 2:00 — Use case 4: Human handoff (Live Agent)
Type:
```
I'd like to talk to a real person
```
**Point out:** it transitions to a **Live Agent** state, shows a reference number,
and the "Connected to a Live Agent" banner appears.

### 2:20 — (Optional) Invalid order
Type:
```
track order 999
```
**Point out:** invalid orders are handled gracefully — it asks for a valid number
(111/222/333) instead of guessing.

### 2:35 — Close
> "Four use cases, a real tool-calling LLM under the hood, a clear fallback, and a
> swappable data layer. Thanks for watching."

---

## Tips
- Speak to *what just happened* after each reply — the brief grades use-case
  coverage, conversation clarity, accuracy to the provided data, intent handling,
  and overall usability. This script hits all five.
- The `⚙` tool badges are great visual proof that real function calls are
  happening — call them out.
- If you want to also show order `#222` (processing) or `#333` (delivered), add
  one of those between steps 1 and 2.
