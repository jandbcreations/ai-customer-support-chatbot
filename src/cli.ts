// Optional command-line chat — handy for quick testing without the browser.
// Run with: npm run cli

import './env.js';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { Conversation } from './agent.js';
import { business } from './data.js';

async function main() {
  const convo = new Conversation();
  const rl = readline.createInterface({ input, output });

  console.log(`\n🧭  ${business.name} — support chat (type "exit" to quit)\n`);
  console.log(`Bot: Hi! I'm the ${business.botName}. How can I help today?\n`);

  while (true) {
    const userMessage = (await rl.question('You: ')).trim();
    if (!userMessage) continue;
    if (['exit', 'quit'].includes(userMessage.toLowerCase())) break;

    try {
      const turn = await convo.send(userMessage);
      const tag = turn.toolsUsed.length ? `  [tools: ${turn.toolsUsed.join(', ')}]` : '';
      console.log(`\nBot: ${turn.reply}${tag}\n`);
    } catch (err) {
      console.error(`\n⚠️  ${err instanceof Error ? err.message : err}\n`);
      break;
    }
  }

  rl.close();
  console.log('\nThanks for stopping by. Happy trails! 🥾\n');
}

main();
