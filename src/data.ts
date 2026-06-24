// Swappable data-access layer.
//
// Everything the bot knows about orders, product categories, and policies flows
// through this module. To use different business data, replace the JSON files in
// /data with the same shape — no other code needs to change.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Business, Category, Faq, Order, Policy, Shipping } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

function load<T>(file: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, file), 'utf-8')) as T;
}

const ordersFile = load<{ orders: Order[] }>('orders.json');
const categoriesFile = load<{ categories: Category[] }>('categories.json');
const policiesFile = load<{ business: Business; shipping: Shipping; policies: Policy[]; faqs: Faq[] }>(
  'policies.json',
);

export const business: Business = policiesFile.business;
export const shipping: Shipping = policiesFile.shipping;
export const policies: Policy[] = policiesFile.policies;
export const faqs: Faq[] = policiesFile.faqs;
export const categories: Category[] = categoriesFile.categories;
export const orders: Order[] = ordersFile.orders;

/** Pull the digits out of whatever the customer typed: "#111", "order 111" -> "111". */
export function normalizeOrderNumber(raw: string): string {
  return (raw.match(/\d+/g)?.join('') ?? '').trim();
}

/** Look up an order by number. Returns undefined for any unknown number (invalid). */
export function findOrder(rawOrderNumber: string): Order | undefined {
  const num = normalizeOrderNumber(rawOrderNumber);
  if (!num) return undefined;
  return orders.find((o) => o.orderNumber === num);
}
