// Tool (function-calling) layer.
//
// Four tools mapping to the four required use cases:
//   get_order_status        -> Order tracking
//   get_return_info         -> Returns & exchanges (explains policy + returns link)
//   recommend_category      -> Product recommendations (recommends a category)
//   escalate_to_human       -> Human handoff (transition to a Live Agent)

import type Anthropic from '@anthropic-ai/sdk';
import { business, categories, findOrder, policies, shipping } from './data.js';
import type { Category } from './types.js';

export const tools: Anthropic.Tool[] = [
  {
    name: 'get_order_status',
    description:
      'Look up an order by its order number and return the simulated shipping status. ' +
      'Ask the customer for their order number first if they have not provided one.',
    input_schema: {
      type: 'object',
      properties: {
        orderNumber: {
          type: 'string',
          description: 'The order number the customer provided (e.g. "111", "#222", "order 333").',
        },
      },
      required: ['orderNumber'],
    },
  },
  {
    name: 'get_return_info',
    description:
      'Get the return/exchange policy and the link to start a return. Use this for any ' +
      'returns or exchanges question. Optionally pass an order number to tailor the answer ' +
      "to that order's status.",
    input_schema: {
      type: 'object',
      properties: {
        orderNumber: { type: 'string', description: 'Optional order number the return relates to.' },
        intent: {
          type: 'string',
          enum: ['return', 'exchange', 'policy'],
          description: 'Whether the customer wants to return, exchange, or just understand the policy.',
        },
      },
    },
  },
  {
    name: 'get_shipping_info',
    description:
      'Return the available shipping options and their delivery durations (Standard and ' +
      'Expedited). Use this for any question about shipping speed, delivery time, or how ' +
      'long an order takes to arrive.',
    input_schema: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          enum: ['standard', 'expedited', 'all'],
          description: 'Which option the customer asked about (default "all").',
        },
      },
    },
  },
  {
    name: 'recommend_category',
    description:
      'Recommend the best-matching product category (or categories) for a customer need. ' +
      'Only call this AFTER asking 1-2 clarifying questions (e.g. season, activity, conditions) ' +
      'so the recommendation is well-targeted.',
    input_schema: {
      type: 'object',
      properties: {
        need: {
          type: 'string',
          description:
            "The customer's need, including their answers to your clarifying questions " +
            '(e.g. "warm jacket for winter day hikes").',
        },
        maxResults: { type: 'number', description: 'Max categories to return (default 2).' },
      },
      required: ['need'],
    },
  },
  {
    name: 'escalate_to_human',
    description:
      'Hand the conversation off to a live human agent. Use when the customer explicitly ' +
      'asks for a person, is frustrated, or has a request you cannot resolve with the other ' +
      'tools. This transitions the session to a "Live Agent" state.',
    input_schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          enum: ['customer_request', 'frustration', 'out_of_scope', 'fallback'],
          description: 'Why the handoff is needed.',
        },
        summary: { type: 'string', description: 'Short summary of the issue for the human agent.' },
        orderNumber: { type: 'string', description: 'Related order number, if any.' },
      },
      required: ['reason', 'summary'],
    },
  },
];

// ---- Tool implementations ------------------------------------------------

function getOrderStatus(input: { orderNumber: string }) {
  const order = findOrder(input.orderNumber ?? '');
  if (!order) {
    return {
      found: false,
      invalid: true,
      message:
        "I couldn't find an order with that number. Our sample order numbers are 111, 222, " +
        'and 333 — please double-check and try again.',
    };
  }
  return {
    found: true,
    orderNumber: order.orderNumber,
    status: order.status,
    statusDetail: order.statusDetail,
    followUp: order.followUpPrompt,
  };
}

function getReturnInfo(input: { orderNumber?: string; intent?: string }) {
  const returnsPolicy = policies.find((p) => p.topic === 'returns')?.content ?? '';
  const exchangePolicy = policies.find((p) => p.topic === 'exchanges')?.content ?? '';

  let orderNote: string | undefined;
  if (input.orderNumber) {
    const order = findOrder(input.orderNumber);
    if (!order) {
      orderNote = `Order ${input.orderNumber} wasn't found, but here's how returns work.`;
    } else if (order.status === 'Delivered') {
      orderNote = `Order ${order.orderNumber} is delivered, so it's eligible to start a return now.`;
    } else {
      orderNote = `Order ${order.orderNumber} is "${order.status}". Returns can be started once it's delivered.`;
    }
  }

  return {
    returnWindowDays: business.returnWindowDays,
    conditions: 'Items must be unused and in their original packaging.',
    returnsLink: business.returnsLink,
    returnPolicy: returnsPolicy,
    exchangePolicy: input.intent === 'exchange' ? exchangePolicy : undefined,
    orderNote,
  };
}

function getShippingInfo(input: { method?: 'standard' | 'expedited' | 'all' }) {
  const method = input.method ?? 'all';
  const options =
    method === 'standard'
      ? [shipping.standard]
      : method === 'expedited'
        ? [shipping.expedited]
        : [shipping.standard, shipping.expedited];
  return {
    options: options.map((o) => ({ name: o.name, duration: o.duration })),
  };
}

function scoreCategory(c: Category, terms: string[]): number {
  const hay = `${c.name} ${c.description} ${c.goodFor.join(' ')} ${c.examples.join(' ')}`.toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (!t) continue;
    if (c.goodFor.includes(t)) score += 3;
    else if (hay.includes(t)) score += 1;
  }
  return score;
}

function recommendCategory(input: { need: string; maxResults?: number }) {
  const terms = input.need.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  const max = input.maxResults ?? 2;

  const ranked = categories
    .map((c) => ({ c, score: scoreCategory(c, terms) }))
    .sort((a, b) => b.score - a.score);

  const top = (ranked.some((r) => r.score > 0) ? ranked.filter((r) => r.score > 0) : ranked).slice(0, max);

  return {
    recommendations: top.map(({ c }) => ({
      category: c.name,
      why: c.description,
      examples: c.examples,
    })),
    note:
      top.length === 0
        ? 'No clear match — ask another clarifying question or offer to connect a human.'
        : undefined,
  };
}

function escalateToHuman(input: { reason: string; summary: string; orderNumber?: string }) {
  const suffix = (input.orderNumber?.replace(/\D/g, '') || String(input.summary.length)).slice(-4);
  const ticketId = `LA-${suffix.padStart(4, '0')}`;
  return {
    escalated: true,
    state: 'Live Agent',
    ticketId,
    handoffMessage:
      `I'm connecting you with a live agent now. Your reference is ${ticketId}. ` +
      `Our team is available ${business.supportHours}, or you can reach us at ${business.supportEmail}.`,
    capturedContext: {
      reason: input.reason,
      summary: input.summary,
      orderNumber: input.orderNumber ?? null,
    },
  };
}

// ---- Dispatcher ----------------------------------------------------------

export interface ToolResult {
  result: unknown;
  /** True when this tool handed the conversation to a human (Live Agent). */
  escalated?: boolean;
}

export function executeTool(name: string, input: any): ToolResult {
  switch (name) {
    case 'get_order_status':
      return { result: getOrderStatus(input) };
    case 'get_return_info':
      return { result: getReturnInfo(input) };
    case 'get_shipping_info':
      return { result: getShippingInfo(input) };
    case 'recommend_category':
      return { result: recommendCategory(input) };
    case 'escalate_to_human':
      return { result: escalateToHuman(input), escalated: true };
    default:
      return { result: { error: `Unknown tool: ${name}` } };
  }
}
