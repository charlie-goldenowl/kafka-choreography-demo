/**
 * Type definitions for Kafka choreography demo
 */

export interface OrderItem {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface OrderData {
  orderId: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
}

export interface Order {
  orderId: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'created' | 'confirmed' | 'cancelled';
  createdAt: string;
  cancelledAt?: string;
  confirmedAt?: string;
}

export interface InventoryItem {
  name: string;
  quantity: number;
  reserved?: number;
}

export interface Payment {
  paymentId: string;
  orderId: string;
  userId: string;
  amount: number;
  status: 'completed' | 'refunded' | 'failed';
  processedAt: string;
  refundedAt?: string;
}

export interface ProcessPaymentResult {
  success: boolean;
  paymentId?: string;
  amount?: number;
  message?: string;
}

export interface ReserveInventoryResult {
  success: boolean;
  message?: string;
}

