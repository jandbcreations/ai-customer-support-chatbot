// Tool (function-calling) layer.
//
// Defines the four tools the model can call and a single executeTool() entry
// point that runs them against the swappable data layer. Each tool returns a
// plain JSON-serialisable object that is handed back to the model.

import type Anthropic from '@anthropic-ai/sdk';
import { business, currency, findOrder, products, returnEligibility } from './data.js';
import type { Product } from './types.js';

export const tools: Anthropic.Tool[] = [
  {
    name: 'get_order_status',
    description:
      "Look up a customer's order and return its current status, tracking, and contents. " +
      'Provide the order id (e.g. "SP-100001") and/or the email on the order. If only an ' +
      'email is given, the most recent matching order is returned.',
    input_schema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'Order id, e.g. "SP-100001".' },
        email: { type: 'string', description: 'Email address on the order.' },
      },
    },
  },
  {
    name: 'start_return_or_exchange',
    description:
      'Begin a return or exchange for an item on a delivered order. First checks the ' +
      'return-window eligibility, and if eligible, opens the request and returns an RMA ' +
      'number and next steps. Always confirm the order and item with the customer before calling.',
    input_schema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', description: 'Order id the item belongs to.' },
        email: { type: 'string', description: 'Email on the order (recommended for verification).' },
        itemId: {
          type: 'string',
          description: 'Product id of the item to return/exchange (e.g. "SP-BOOT-TRAILBLAZER").',
        },
        action: { type: 'string', enum: ['return', 'exchange'], description: 'Return for refund or exchange.' },
        reason: { type: 'string', description: "Customer's reason (e.g. 'wrong size', 'defective')." },
        newSize: { type: 'string', description: 'For exchanges: the desired replacement size.' },
        newColor: { type: 'string', description: 'For exchanges: the desired replacement color.' },
      },
      required: ['orderId', 'itemId', 'action'],
    },
  },
  {
    name: 'recommend_products',
    description:
      'Recommend catalog products that match a stated customer need (e.g. "a warm jacket ' +
      'for winter hiking" or "a 3-season tent"). Returns the best-matching in-stock products ' +
      'with prices so you can present options.',
    input_schema: {
      type: 'object',
      properties: {
        need: { type: 'string', description: "Plain-language description of what the customer wants." },
        category: {
          type: 'string',
          description: 'Optional category filter: shelter, sleep, apparel, footwear, packs, cooking, hydration.',
        },
        maxPrice: { type: 'number', description: 'Optional maximum price.' },
        maxResults: { type: 'number', description: 'Max products to return (default 3).' },
      },
      required: ['need'],
    },
  },
  {
    name: 'escalate_to_human',
    description:
      'Escalate the conversation to a human support agent. Use when the customer is ' +
      'frustrated or explicitly asks for a person, or when the request is out of scope ' +
      '(billing disputes, damaged-on-arrival claims, anything you cannot resolve with the ' +
      'other tools). Captures a summary so the human has full context.',
    input_schema: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          enum: ['customer_request', 'frustration', 'out_of_scope', 'unresolved'],
          description: 'Why the handoff is needed.',
        },
        summary: { type: 'string', description: 'Concise summary of the issue for the human agent.' },
        orderId: { type: 'string', description: 'Related order id, if any.' },
        email: { type: 'string', description: 'Customer contact email, if known.' },
        urgency: { type: 'string', enum: ['normal', 'high'], description: 'How urgent the issue is.' },
      },
      required: ['reason', 'summary'],
    },
  },
];

// ---- Tool implementations ------------------------------------------------

function getOrderStatus(input: { orderId?: string; email?: string }) {
  const order = findOrder(input);
  if (!order) {
    return {
      found: false,
      message:
        'No order matched those details. Double-check the order id (format "SP-100001") ' +
        'or the email used at checkout.',
    };
  }
  const eligibility = returnEligibility(order);
  return {
    found: true,
    order: {
      orderId: order.orderId,
      customerName: order.customerName,
      status: order.status,
      orderedDate: order.orderedDate,
      shippedDate: order.shippedDate,
      estimatedDelivery: order.estimatedDelivery,
      deliveredDate: order.deliveredDate,
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
      items: order.items,
      total: order.total,
      currency,
    },
    returnEligibility: eligibility,
  };
}

function startReturnOrExchange(input: {
  orderId: string;
  email?: string;
  itemId: string;
  action: 'return' | 'exchange';
  reason?: string;
  newSize?: string;
  newColor?: string;
}) {
  const order = findOrder({ orderId: input.orderId, email: input.email });
  if (!order) {
    return { success: false, message: 'Could not find that order. Please verify the order id and email.' };
  }

  const item = order.items.find((i) => i.id.toUpperCase() === input.itemId.trim().toUpperCase());
  if (!item) {
    return {
      success: false,
      message: `Order ${order.orderId} doesn't contain item "${input.itemId}".`,
      itemsOnOrder: order.items.map((i) => ({ id: i.id, name: i.name })),
    };
  }

  const eligibility = returnEligibility(order);
  if (!eligibility.eligible) {
    return { success: false, eligible: false, message: eligibility.reason };
  }

  // Deterministic RMA so demo transcripts stay stable.
  const rma = `RMA-${order.orderId.replace('SP-', '')}-${item.id.split('-').pop()}`;
  const isExchange = input.action === 'exchange';
  return {
    success: true,
    eligible: true,
    rmaNumber: rma,
    action: input.action,
    item: { id: item.id, name: item.name },
    exchangeDetails: isExchange ? { newSize: input.newSize ?? null, newColor: input.newColor ?? null } : null,
    nextSteps: [
      `A prepaid ${order.carrier ?? 'shipping'} return label for ${rma} will be emailed to ${order.email}.`,
      'Pack the item in its original condition with tags attached and drop it off within 14 days.',
      isExchange
        ? 'Your replacement is placed on hold and ships as soon as we receive the original.'
        : `Your refund of ${currency} ${item.price.toFixed(2)} goes to the original payment method 5–7 business days after we receive it.`,
    ],
  };
}

function scoreProduct(p: Product, terms: string[]): number {
  const hay = `${p.name} ${p.description} ${p.tags.join(' ')} ${p.category}`.toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (!t) continue;
    if (p.tags.includes(t)) score += 3;
    else if (hay.includes(t)) score += 1;
  }
  return score;
}

function recommendProducts(input: {
  need: string;
  category?: string;
  maxPrice?: number;
  maxResults?: number;
}) {
  const terms = input.need.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  const max = input.maxResults ?? 3;

  let candidates = products.filter((p) => p.inStock);
  if (input.category) {
    candidates = candidates.filter((p) => p.category === input.category!.toLowerCase());
  }
  if (typeof input.maxPrice === 'number') {
    candidates = candidates.filter((p) => p.price <= input.maxPrice!);
  }

  const ranked = candidates
    .map((p) => ({ p, score: scoreProduct(p, terms) }))
    .sort((a, b) => b.score - a.score);

  // If nothing scored, fall back to category/price matches so we still help.
  const top = (ranked.some((r) => r.score > 0) ? ranked.filter((r) => r.score > 0) : ranked).slice(0, max);

  return {
    matches: top.map(({ p }) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      currency,
      category: p.category,
      description: p.description,
      tags: p.tags,
    })),
    note: top.length === 0 ? 'No in-stock products matched those filters.' : undefined,
  };
}

function escalateToHuman(input: {
  reason: string;
  summary: string;
  orderId?: string;
  email?: string;
  urgency?: 'normal' | 'high';
}) {
  // Deterministic ticket id derived from the summary length + order, so demos are stable.
  const suffix = (input.orderId?.replace(/[^0-9]/g, '') ?? String(input.summary.length)).slice(-5);
  const ticketId = `ESC-${suffix.padStart(5, '0')}`;
  return {
    escalated: true,
    ticketId,
    urgency: input.urgency ?? 'normal',
    handoffMessage:
      `I've created ticket ${ticketId} and passed your conversation to a human agent on our ` +
      `support team. They're available ${business.supportHours} and will follow up` +
      `${input.email ? ` at ${input.email}` : ''}. You can also reach us at ${business.supportEmail}.`,
    capturedContext: {
      reason: input.reason,
      summary: input.summary,
      orderId: input.orderId ?? null,
      email: input.email ?? null,
    },
  };
}

// ---- Dispatcher ----------------------------------------------------------

export interface ToolResult {
  result: unknown;
  /** True when this tool handed the conversation to a human. */
  escalated?: boolean;
}

export function executeTool(name: string, input: any): ToolResult {
  switch (name) {
    case 'get_order_status':
      return { result: getOrderStatus(input) };
    case 'start_return_or_exchange':
      return { result: startReturnOrExchange(input) };
    case 'recommend_products':
      return { result: recommendProducts(input) };
    case 'escalate_to_human':
      return { result: escalateToHuman(input), escalated: true };
    default:
      return { result: { error: `Unknown tool: ${name}` } };
  }
}
