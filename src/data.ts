// Swappable data-access layer.
//
// Everything the bot knows about products, orders, and policies flows through
// this module. To use real business data, replace the JSON files in /data with
// the same shape (or repoint these imports) — no other code needs to change.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Business, Faq, Order, Policy, Product } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

function load<T>(file: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, file), 'utf-8')) as T;
}

const productsFile = load<{ currency: string; products: Product[] }>('products.json');
const ordersFile = load<{ orders: Order[] }>('orders.json');
const policiesFile = load<{ business: Business; policies: Policy[]; faqs: Faq[] }>('policies.json');

export const business: Business = policiesFile.business;
export const policies: Policy[] = policiesFile.policies;
export const faqs: Faq[] = policiesFile.faqs;
export const currency: string = productsFile.currency;
export const products: Product[] = productsFile.products;
export const orders: Order[] = ordersFile.orders;

/** Look up an order by its id, or by the email on the order. */
export function findOrder(opts: { orderId?: string; email?: string }): Order | undefined {
  const orderId = opts.orderId?.trim().toUpperCase();
  const email = opts.email?.trim().toLowerCase();

  if (orderId) {
    const byId = orders.find((o) => o.orderId.toUpperCase() === orderId);
    // If an email was also supplied, it must match — protects against guessing.
    if (byId && email && byId.email.toLowerCase() !== email) return undefined;
    if (byId) return byId;
  }
  if (email) {
    return orders.find((o) => o.email.toLowerCase() === email);
  }
  return undefined;
}

export function findProductById(id: string): Product | undefined {
  return products.find((p) => p.id.toUpperCase() === id.trim().toUpperCase());
}

/**
 * Days since delivery, or null if not delivered. Uses a fixed "today" so the
 * mock data behaves deterministically in a demo regardless of the real date.
 */
export const TODAY = new Date('2026-06-22T12:00:00Z');

export function daysSinceDelivery(order: Order): number | null {
  if (!order.deliveredDate) return null;
  const delivered = new Date(order.deliveredDate + 'T12:00:00Z');
  const ms = TODAY.getTime() - delivered.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** Whether an order is currently within the return/exchange window. */
export function returnEligibility(order: Order): {
  eligible: boolean;
  reason: string;
} {
  if (order.status === 'cancelled') {
    return { eligible: false, reason: 'This order was cancelled, so there is nothing to return.' };
  }
  if (order.status !== 'delivered') {
    return {
      eligible: false,
      reason: `Returns start after delivery. This order is currently "${order.status}".`,
    };
  }
  const days = daysSinceDelivery(order);
  if (days === null) {
    return { eligible: false, reason: 'No delivery date is on file for this order yet.' };
  }
  if (days > business.returnWindowDays) {
    return {
      eligible: false,
      reason: `Delivered ${days} days ago, which is past our ${business.returnWindowDays}-day return window.`,
    };
  }
  return {
    eligible: true,
    reason: `Delivered ${days} days ago — within the ${business.returnWindowDays}-day window.`,
  };
}
