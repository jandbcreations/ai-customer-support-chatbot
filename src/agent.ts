// The conversational agent: wraps the Anthropic SDK in a tool-use loop and
// keeps per-conversation message history. Shared by both the web server and CLI.

import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from './prompt.js';
import { executeTool, tools } from './tools.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const MAX_TOOL_ROUNDS = 6;

export interface AgentTurn {
  /** The assistant's final natural-language reply. */
  reply: string;
  /** Names of tools invoked during this turn, in order. */
  toolsUsed: string[];
  /** True if the conversation was handed to a human this turn. */
  escalated: boolean;
}

/**
 * One stateful conversation. Holds the running message history so the model has
 * full context across turns. Create one per user/session.
 */
export class Conversation {
  private client: Anthropic;
  private messages: Anthropic.MessageParam[] = [];
  private system: string;
  escalated = false;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error(
        'ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.',
      );
    }
    this.client = new Anthropic({ apiKey: key });
    this.system = buildSystemPrompt();
  }

  async send(userMessage: string): Promise<AgentTurn> {
    this.messages.push({ role: 'user', content: userMessage });

    const toolsUsed: string[] = [];
    let escalatedThisTurn = false;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: this.system,
        tools,
        messages: this.messages,
      });

      // Record the assistant's full response (text + any tool_use blocks).
      this.messages.push({ role: 'assistant', content: response.content });

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
        // No tool calls — we have the final answer.
        return {
          reply: extractText(response.content),
          toolsUsed,
          escalated: escalatedThisTurn,
        };
      }

      // Run each requested tool and feed the results back.
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        toolsUsed.push(tu.name);
        const { result, escalated } = executeTool(tu.name, tu.input);
        if (escalated) {
          escalatedThisTurn = true;
          this.escalated = true;
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        });
      }
      this.messages.push({ role: 'user', content: toolResults });
    }

    return {
      reply:
        "I'm having trouble completing that automatically. Let me connect you with a human agent who can help.",
      toolsUsed,
      escalated: escalatedThisTurn,
    };
  }
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}
