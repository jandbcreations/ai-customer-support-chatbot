// The conversational agent.
//
// Two interchangeable implementations behind one interface:
//   - AnthropicConversation: real LLM tool-use loop (used when an API key is set).
//   - MockConversation:      deterministic offline engine (no API key required) so
//                            every feature can be tested end-to-end without a key.
//
// createConversation() picks the right one. Both call the SAME executeTool()
// functions, so the data and tool behavior are identical either way.

import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from './prompt.js';
import { executeTool, tools } from './tools.js';
import { business } from './data.js';

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

export interface Conversation {
  escalated: boolean;
  send(userMessage: string): Promise<AgentTurn>;
}

/** Decide which engine to use. Mock when there's no key (or CHAT_MODE=mock). */
export function isMockMode(): boolean {
  const mode = (process.env.CHAT_MODE || '').toLowerCase();
  if (mode === 'mock') return true;
  if (mode === 'anthropic' || mode === 'live') return false;
  return !process.env.ANTHROPIC_API_KEY;
}

export function createConversation(): Conversation {
  return isMockMode() ? new MockConversation() : new AnthropicConversation();
}

// ---- Real LLM engine -----------------------------------------------------

export class AnthropicConversation implements Conversation {
  private client: Anthropic;
  private messages: Anthropic.MessageParam[] = [];
  private system: string;
  escalated = false;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.');
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

      this.messages.push({ role: 'assistant', content: response.content });

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );

      if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
        return { reply: extractText(response.content), toolsUsed, escalated: escalatedThisTurn };
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        toolsUsed.push(tu.name);
        const { result, escalated } = executeTool(tu.name, tu.input);
        if (escalated) {
          escalatedThisTurn = true;
          this.escalated = true;
        }
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) });
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

// ---- Offline mock engine -------------------------------------------------
//
// Rule-based intent detection that drives the same tools as the real bot. It is
// intentionally simple and transparent so a reviewer can test all features with
// no API key. It is NOT trying to be the LLM — it mirrors the bot's flows.

type Pending = 'order_number' | 'reco_details' | null;

const RE = {
  handoff:
    /\b(human|agent|representative|real person|live (agent|person)|talk to (a )?(person|human|someone)|speak (to|with) (a )?(person|human|someone))\b/i,
  shipping:
    /\b(how long|how fast|delivery time|shipping|ship it|expedited|standard shipping|when will it (arrive|ship)|days to (ship|arrive|deliver))\b/i,
  returns: /\b(return|refund|exchange|send (it )?back|money back|policy)\b/i,
  tracking: /\b(track|tracking|where('?s| is| are)|order|status of|my package|parcel|shipment)\b/i,
  reco: /\b(recommend|suggest|looking for|need (a|an|some)|what should i|which|help me (find|choose|pick)|jacket|tent|sleeping bag|sleeping pad|boots|backpack|daypack|stove|gear|fleece|shell|footwear|filter)\b/i,
  greeting: /^(hi|hello|hey|yo|howdy|good (morning|afternoon|evening))\b/i,
};

function hasOrderNumber(text: string): boolean {
  return /\d/.test(text);
}

export class MockConversation implements Conversation {
  private pending: Pending = null;
  escalated = false;

  async send(userMessage: string): Promise<AgentTurn> {
    const text = userMessage.trim();

    // Resolve pending follow-ups first, unless the user clearly switched topics.
    if (this.pending === 'order_number' && !this.isTopicSwitch(text)) {
      if (hasOrderNumber(text)) return this.trackOrder(text);
      return turn('No problem — just send me your order number (for example 111) and I’ll look it up.');
    }
    if (this.pending === 'reco_details' && !this.isTopicSwitch(text)) {
      return this.recommend(text);
    }

    if (RE.handoff.test(text)) return this.handoff(text);
    if (RE.shipping.test(text) && !RE.tracking.test(text)) return this.shippingInfo(text);
    if (RE.returns.test(text)) return this.returnInfo(text);
    if (RE.tracking.test(text) || (hasOrderNumber(text) && text.length <= 12)) {
      if (hasOrderNumber(text)) return this.trackOrder(text);
      this.pending = 'order_number';
      return turn('Sure — I can track that for you. What’s your order number? (e.g. 111)');
    }
    if (RE.reco.test(text)) {
      this.pending = 'reco_details';
      return turn(
        'Happy to help you find the right gear! A couple of quick questions: what season and ' +
          'conditions will you be in — for example cold & dry, or wet & windy?',
      );
    }
    if (RE.greeting.test(text)) return turn(this.menu(`Hi! I’m the ${business.botName}.`));

    // Fallback
    return turn(this.menu('Sorry, I didn’t quite catch that.'));
  }

  private isTopicSwitch(text: string): boolean {
    return RE.handoff.test(text) || RE.returns.test(text) || RE.shipping.test(text);
  }

  private menu(prefix: string): string {
    return (
      `${prefix} Here’s what I can help with:\n` +
      '1. Order tracking — share your order number\n' +
      '2. Returns & exchanges — our policy and returns link\n' +
      '3. Shipping — standard & expedited delivery times\n' +
      '4. Product recommendations — tell me what you need\n' +
      '5. Talk to a live agent\n\n' +
      'What would you like to do?'
    );
  }

  private trackOrder(text: string): AgentTurn {
    const orderNumber = (text.match(/\d+/g)?.join('') ?? '').slice(0, 8);
    const { result } = executeTool('get_order_status', { orderNumber });
    this.pending = null;
    const r = result as any;
    if (!r.found) {
      return turn(r.message, ['get_order_status']);
    }
    let reply = `📦 Order #${r.orderNumber}: ${r.status}. ${r.statusDetail}`;
    if (r.followUp) {
      reply += '\n\nDid everything arrive in good condition? If you need a return or exchange, I’m happy to help.';
    } else {
      reply += '\n\nIs there anything else I can help with — returns, shipping, or a product recommendation?';
    }
    return turn(reply, ['get_order_status']);
  }

  private returnInfo(text: string): AgentTurn {
    const intent = /exchange/i.test(text) ? 'exchange' : 'policy';
    const orderNumber = hasOrderNumber(text) ? text.match(/\d+/g)?.join('') : undefined;
    const { result } = executeTool('get_return_info', { intent, orderNumber });
    const r = result as any;
    let reply =
      `Here’s how returns work: you have ${r.returnWindowDays} days to return an item. ` +
      `${r.conditions} Start your return here: ${r.returnsLink}`;
    if (r.orderNote) reply += `\n\n${r.orderNote}`;
    reply += '\n\nAnything else I can help with?';
    return turn(reply, ['get_return_info']);
  }

  private shippingInfo(text: string): AgentTurn {
    const method = /expedited/i.test(text)
      ? 'expedited'
      : /standard/i.test(text)
        ? 'standard'
        : 'all';
    const { result } = executeTool('get_shipping_info', { method });
    const r = result as any;
    const lines = r.options.map((o: any) => `• ${o.name}: ${o.duration}`).join('\n');
    return turn(`Here are our shipping options:\n${lines}\n\nAnything else I can help with?`, [
      'get_shipping_info',
    ]);
  }

  private recommend(need: string): AgentTurn {
    const { result } = executeTool('recommend_category', { need });
    this.pending = null;
    const r = result as any;
    if (!r.recommendations?.length) {
      return turn(
        'I want to point you to the right gear — could you tell me a bit more about how you’ll use it?',
        ['recommend_category'],
      );
    }
    const recs = r.recommendations
      .map((rec: any) => `• ${rec.category} — ${rec.why} (e.g. ${rec.examples.slice(0, 3).join(', ')})`)
      .join('\n');
    return turn(
      `Based on that, I’d recommend:\n${recs}\n\nWant me to narrow it down further, or anything else?`,
      ['recommend_category'],
    );
  }

  private handoff(text: string): AgentTurn {
    const orderNumber = hasOrderNumber(text) ? text.match(/\d+/g)?.join('') : undefined;
    const { result } = executeTool('escalate_to_human', {
      reason: 'customer_request',
      summary: `Customer asked to speak with a live agent: "${text.slice(0, 120)}"`,
      orderNumber,
    });
    this.pending = null;
    this.escalated = true;
    const r = result as any;
    return { reply: r.handoffMessage, toolsUsed: ['escalate_to_human'], escalated: true };
  }
}

function turn(reply: string, toolsUsed: string[] = []): AgentTurn {
  return { reply, toolsUsed, escalated: false };
}
