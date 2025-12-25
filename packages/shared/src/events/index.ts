/**
 * Event definitions for Kafka choreography pattern
 * Each service publishes and subscribes to these events
 */

import type { OrderItem, ProcessPaymentResult, ReserveInventoryResult } from '../types/index.js';

/**
 * Event types
 */
export enum EventType {
  // Order events
  ORDER_CREATED = 'order.created',
  ORDER_CONFIRMED = 'order.confirmed',
  ORDER_CANCELLED = 'order.cancelled',

  // Inventory events
  INVENTORY_RESERVE_REQUESTED = 'inventory.reserve.requested',
  INVENTORY_RESERVED = 'inventory.reserved',
  INVENTORY_RESERVATION_FAILED = 'inventory.reservation.failed',
  INVENTORY_RELEASE_REQUESTED = 'inventory.release.requested',
  INVENTORY_RELEASED = 'inventory.released',

  // Payment events
  PAYMENT_PROCESS_REQUESTED = 'payment.process.requested',
  PAYMENT_PROCESSED = 'payment.processed',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUND_REQUESTED = 'payment.refund.requested',
  PAYMENT_REFUNDED = 'payment.refunded',

  // Notification events
  NOTIFICATION_SEND_REQUESTED = 'notification.send.requested',
  NOTIFICATION_SENT = 'notification.sent',
}

/**
 * Base event interface
 */
export interface BaseEvent {
  eventId: string;
  eventType: EventType;
  timestamp: string;
  orderId: string;
  userId: string;
}

/**
 * Order Created Event
 * Published by: Order Service
 * Subscribed by: Inventory Service
 */
export interface OrderCreatedEvent extends BaseEvent {
  eventType: EventType.ORDER_CREATED;
  data: {
    orderId: string;
    userId: string;
    items: OrderItem[];
    totalAmount: number;
  };
}

/**
 * Inventory Reserve Requested Event
 * Published by: Order Service (after order created)
 * Subscribed by: Inventory Service
 */
export interface InventoryReserveRequestedEvent extends BaseEvent {
  eventType: EventType.INVENTORY_RESERVE_REQUESTED;
  data: {
    orderId: string;
    items: OrderItem[];
  };
}

/**
 * Inventory Reserved Event
 * Published by: Inventory Service
 * Subscribed by: Order Service, Payment Service
 */
export interface InventoryReservedEvent extends BaseEvent {
  eventType: EventType.INVENTORY_RESERVED;
  data: {
    orderId: string;
    items: OrderItem[];
    result: ReserveInventoryResult;
  };
}

/**
 * Inventory Reservation Failed Event
 * Published by: Inventory Service
 * Subscribed by: Order Service
 */
export interface InventoryReservationFailedEvent extends BaseEvent {
  eventType: EventType.INVENTORY_RESERVATION_FAILED;
  data: {
    orderId: string;
    reason: string;
  };
}

/**
 * Payment Process Requested Event
 * Published by: Order Service (after inventory reserved)
 * Subscribed by: Payment Service
 */
export interface PaymentProcessRequestedEvent extends BaseEvent {
  eventType: EventType.PAYMENT_PROCESS_REQUESTED;
  data: {
    orderId: string;
    userId: string;
    amount: number;
  };
}

/**
 * Payment Processed Event
 * Published by: Payment Service
 * Subscribed by: Order Service, Notification Service
 */
export interface PaymentProcessedEvent extends BaseEvent {
  eventType: EventType.PAYMENT_PROCESSED;
  data: {
    orderId: string;
    paymentId: string;
    amount: number;
    result: ProcessPaymentResult;
  };
}

/**
 * Payment Failed Event
 * Published by: Payment Service
 * Subscribed by: Order Service, Inventory Service
 */
export interface PaymentFailedEvent extends BaseEvent {
  eventType: EventType.PAYMENT_FAILED;
  data: {
    orderId: string;
    reason: string;
  };
}

/**
 * Order Confirmed Event
 * Published by: Order Service (after payment processed)
 * Subscribed by: Notification Service
 */
export interface OrderConfirmedEvent extends BaseEvent {
  eventType: EventType.ORDER_CONFIRMED;
  data: {
    orderId: string;
    userId: string;
    totalAmount: number;
    paymentId: string;
  };
}

/**
 * Notification Send Requested Event
 * Published by: Order Service (after order confirmed or cancelled)
 * Subscribed by: Notification Service
 */
export interface NotificationSendRequestedEvent extends BaseEvent {
  eventType: EventType.NOTIFICATION_SEND_REQUESTED;
  data: {
    orderId: string;
    userId: string;
    type: 'confirmation' | 'cancellation';
    totalAmount?: number;
    reason?: string;
  };
}

/**
 * Notification Sent Event
 * Published by: Notification Service
 * Subscribed by: (none - for logging/monitoring)
 */
export interface NotificationSentEvent extends BaseEvent {
  eventType: EventType.NOTIFICATION_SENT;
  data: {
    orderId: string;
    userId: string;
    type: 'confirmation' | 'cancellation';
  };
}

/**
 * Order Cancelled Event
 * Published by: Order Service (on failure)
 * Subscribed by: Inventory Service, Payment Service
 */
export interface OrderCancelledEvent extends BaseEvent {
  eventType: EventType.ORDER_CANCELLED;
  data: {
    orderId: string;
    userId: string;
    reason: string;
  };
}

/**
 * Inventory Release Requested Event
 * Published by: Order Service (on cancellation)
 * Subscribed by: Inventory Service
 */
export interface InventoryReleaseRequestedEvent extends BaseEvent {
  eventType: EventType.INVENTORY_RELEASE_REQUESTED;
  data: {
    orderId: string;
    items: OrderItem[];
  };
}

/**
 * Inventory Released Event
 * Published by: Inventory Service
 * Subscribed by: (none - for logging/monitoring)
 */
export interface InventoryReleasedEvent extends BaseEvent {
  eventType: EventType.INVENTORY_RELEASED;
  data: {
    orderId: string;
    items: OrderItem[];
  };
}

/**
 * Payment Refund Requested Event
 * Published by: Order Service (on cancellation, if payment was processed)
 * Subscribed by: Payment Service
 */
export interface PaymentRefundRequestedEvent extends BaseEvent {
  eventType: EventType.PAYMENT_REFUND_REQUESTED;
  data: {
    orderId: string;
    paymentId: string;
  };
}

/**
 * Payment Refunded Event
 * Published by: Payment Service
 * Subscribed by: (none - for logging/monitoring)
 */
export interface PaymentRefundedEvent extends BaseEvent {
  eventType: EventType.PAYMENT_REFUNDED;
  data: {
    orderId: string;
    paymentId: string;
    amount: number;
  };
}

/**
 * Union type of all events
 */
export type ChoreographyEvent =
  | OrderCreatedEvent
  | InventoryReserveRequestedEvent
  | InventoryReservedEvent
  | InventoryReservationFailedEvent
  | PaymentProcessRequestedEvent
  | PaymentProcessedEvent
  | PaymentFailedEvent
  | OrderConfirmedEvent
  | NotificationSendRequestedEvent
  | NotificationSentEvent
  | OrderCancelledEvent
  | InventoryReleaseRequestedEvent
  | InventoryReleasedEvent
  | PaymentRefundRequestedEvent
  | PaymentRefundedEvent;

/**
 * Helper function to create event
 */
export function createEvent<T extends ChoreographyEvent>(
  eventType: EventType,
  orderId: string,
  userId: string,
  data: T['data'],
): T {
  return {
    eventId: `${eventType}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    eventType,
    timestamp: new Date().toISOString(),
    orderId,
    userId,
    data,
  } as T;
}

