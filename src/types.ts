// Shared domain types for the support chatbot.

export type OrderStatus = 'Shipped' | 'Processing' | 'Delivered';

export interface Order {
  orderNumber: string;
  status: OrderStatus;
  statusDetail: string;
  /** Optional instruction for the bot to follow up after reporting status. */
  followUpPrompt: string | null;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  /** Keywords used to match a customer's stated need. */
  goodFor: string[];
  /** Representative item types in this category (no SKUs/prices). */
  examples: string[];
}

export interface Policy {
  topic: string;
  title: string;
  content: string;
}

export interface Faq {
  question: string;
  answer: string;
}

export interface ShippingOption {
  name: string;
  duration: string;
}

export interface Shipping {
  standard: ShippingOption;
  expedited: ShippingOption;
}

export interface Business {
  name: string;
  botName: string;
  tagline: string;
  supportHours: string;
  supportEmail: string;
  returnsLink: string;
  returnWindowDays: number;
}
