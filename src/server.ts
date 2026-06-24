// Minimal web server: serves the chat UI and a /api/chat endpoint.
// Conversations are kept in memory keyed by a session id sent from the browser.

import './env.js';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createConversation, isMockMode, type Conversation } from './agent.js';
import { business } from './data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));

// In-memory conversation store. Fine for a single-process demo; swap for Redis
// or a DB if you ever need persistence or multiple instances.
const conversations = new Map<string, Conversation>();

app.get('/api/config', (_req, res) => {
  res.json({ businessName: business.name, tagline: business.tagline, mockMode: isMockMode() });
});

app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body ?? {};
  if (typeof sessionId !== 'string' || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'sessionId and a non-empty message are required.' });
  }

  try {
    let convo = conversations.get(sessionId);
    if (!convo) {
      convo = createConversation();
      conversations.set(sessionId, convo);
    }
    const turn = await convo.send(message);
    res.json(turn);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error.';
    console.error('[chat error]', msg);
    res.status(500).json({ error: msg });
  }
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  if (isMockMode()) {
    console.log(
      '\n🧪  Running in OFFLINE MOCK MODE — no API key needed. Every feature is testable.' +
        '\n    (Set ANTHROPIC_API_KEY in .env to use the live Claude model instead.)',
    );
  } else {
    console.log('\n🤖  Running with the live Claude model (ANTHROPIC_API_KEY detected).');
  }
  console.log(`\n🧭  ${business.name} support bot running at http://localhost:${PORT}\n`);
});
