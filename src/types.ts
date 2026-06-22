// Shared domain types for the support chatbot.

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  inStock: boolean;
  description: string;
  tags: string[];
  specs: Record<string, unknown>;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  size: string | null;
}

export type OrderStatus =
  | 'processing'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface Order {
  orderId: string;
  email: string;
  customerName: string;
  status: OrderStatus;
  orderedDate: string;
  shippedDate: string | null;
  estimatedDelivery: string | null;
  deliveredDate: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  shippingAddress: string;
  items: OrderItem[];
  total: number;
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

export interface Business {
  name: string;
  tagline: string;
  supportHours: string;
  supportEmail: string;
  returnWindowDays: number;
}
