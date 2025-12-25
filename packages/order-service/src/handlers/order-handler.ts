import {
  EventType,
  createEvent,
  type InventoryReleaseRequestedEvent,
  type InventoryReserveRequestedEvent,
  type InventoryReservedEvent,
  type InventoryReservationFailedEvent,
  type NotificationSendRequestedEvent,
  type OrderCancelledEvent,
  type OrderConfirmedEvent,
  type OrderCreatedEvent,
  type OrderData,
  type PaymentFailedEvent,
  type PaymentProcessedEvent,
} from '@kafka-choreography/shared';
import { withSpan } from '@kafka-choreography/shared';
import { publishEvent } from '../kafka/publisher.js';
import { orderStore } from '../storage/order-store.js';

/**
 * Create new order and publish order.created event
 */
export async function createOrder(orderData: OrderData): Promise<void> {
  return withSpan('order-service', 'createOrder', async (span) => {
    const { orderId, userId, items, totalAmount } = orderData;

    if (span) {
      span.setAttributes({
        'order.id': orderId,
        'order.user_id': userId,
        'order.total_amount': totalAmount,
        'order.items_count': items.length,
      });
    }

    console.log('📝 Creating order...', { orderId, userId, totalAmount });

    // Create order in local store
    const order = {
      orderId,
      userId,
      items,
      totalAmount,
      status: 'created' as const,
      createdAt: new Date().toISOString(),
    };

    orderStore.create(order);

    // Publish order.created event
    const event = createEvent<OrderCreatedEvent>(
      EventType.ORDER_CREATED,
      orderId,
      userId,
      {
        orderId,
        userId,
        items,
        totalAmount,
      },
    );

    await publishEvent(event);
    console.log('✅ Order created and event published', { orderId, eventId: event.eventId });

    // Request inventory reservation
    const inventoryEvent = createEvent<InventoryReserveRequestedEvent>(
      EventType.INVENTORY_RESERVE_REQUESTED,
      orderId,
      userId,
      {
        orderId,
        items,
      },
    );

    await publishEvent(inventoryEvent);
    console.log('📦 Inventory reservation requested', { orderId });
  });
}

/**
 * Handle inventory reserved event
 * Proceed to payment processing
 */
export async function handleInventoryReserved(event: InventoryReservedEvent): Promise<void> {
  return withSpan('order-service', 'handleInventoryReserved', async (span) => {
    const { orderId, userId } = event;

    if (span) {
      span.setAttributes({
        'order.id': orderId,
        'order.user_id': userId,
        'event.type': 'inventory.reserved',
      });
    }

    console.log('📦 Inventory reserved, requesting payment...', { orderId });

    const order = orderStore.get(orderId);
    if (!order) {
      console.error('❌ Order not found', { orderId });
      return;
    }

    // Request payment processing
    const paymentEvent = createEvent(
      EventType.PAYMENT_PROCESS_REQUESTED,
      orderId,
      userId,
      {
        orderId,
        userId,
        amount: order.totalAmount,
      },
    );

    await publishEvent(paymentEvent);
    console.log('💳 Payment processing requested', { orderId });
  });
}

/**
 * Handle inventory reservation failed event
 * Cancel order
 */
export async function handleInventoryReservationFailed(
  event: InventoryReservationFailedEvent,
): Promise<void> {
  const { orderId, userId, data } = event;

  console.error('❌ Inventory reservation failed, cancelling order...', {
    orderId,
    reason: data.reason,
  });

  await cancelOrder(orderId, userId, data.reason);
}

/**
 * Handle payment processed event
 * Confirm order and request notification
 */
export async function handlePaymentProcessed(event: PaymentProcessedEvent): Promise<void> {
  return withSpan('order-service', 'handlePaymentProcessed', async (span) => {
    const { orderId, userId, data } = event;

    if (span) {
      span.setAttributes({
        'order.id': orderId,
        'order.user_id': userId,
        'payment.id': data.paymentId,
        'event.type': 'payment.processed',
      });
    }

    console.log('💳 Payment processed, confirming order...', {
      orderId,
      paymentId: data.paymentId,
    });

    const order = orderStore.get(orderId);
    if (!order) {
      console.error('❌ Order not found', { orderId });
      return;
    }

    // Update order status
    orderStore.update(orderId, {
      status: 'confirmed',
      confirmedAt: new Date().toISOString(),
    });

    // Publish order confirmed event
    const confirmedEvent = createEvent<OrderConfirmedEvent>(
      EventType.ORDER_CONFIRMED,
      orderId,
      userId,
      {
        orderId,
        userId,
        totalAmount: order.totalAmount,
        paymentId: data.paymentId,
      },
    );

    await publishEvent(confirmedEvent);
    console.log('✅ Order confirmed', { orderId });

    // Request notification
    const notificationEvent = createEvent<NotificationSendRequestedEvent>(
      EventType.NOTIFICATION_SEND_REQUESTED,
      orderId,
      userId,
      {
        orderId,
        userId,
        type: 'confirmation',
        totalAmount: order.totalAmount,
      },
    );

    await publishEvent(notificationEvent);
    console.log('📧 Confirmation notification requested', { orderId });
  });
}

/**
 * Handle payment failed event
 * Cancel order and trigger compensation
 */
export async function handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
  const { orderId, userId, data } = event;

  console.error('❌ Payment failed, cancelling order...', {
    orderId,
    reason: data.reason,
  });

  await cancelOrder(orderId, userId, data.reason);
}

/**
 * Cancel order and trigger compensation
 */
async function cancelOrder(orderId: string, userId: string, reason: string): Promise<void> {
  const order = orderStore.get(orderId);
  if (!order) {
    console.error('❌ Order not found for cancellation', { orderId });
    return;
  }

  // Update order status
  orderStore.update(orderId, {
    status: 'cancelled',
    cancelledAt: new Date().toISOString(),
  });

  // Publish order cancelled event
  const cancelledEvent = createEvent<OrderCancelledEvent>(
    EventType.ORDER_CANCELLED,
    orderId,
    userId,
    {
      orderId,
      userId,
      reason,
    },
  );

  await publishEvent(cancelledEvent);
  console.log('🔄 Order cancelled, compensation triggered', { orderId });

  // Request inventory release
  const inventoryReleaseEvent = createEvent<InventoryReleaseRequestedEvent>(
    EventType.INVENTORY_RELEASE_REQUESTED,
    orderId,
    userId,
    {
      orderId,
      items: order.items,
    },
  );

  await publishEvent(inventoryReleaseEvent);
  console.log('📦 Inventory release requested', { orderId });

  // Request cancellation notification
  const notificationEvent = createEvent<NotificationSendRequestedEvent>(
    EventType.NOTIFICATION_SEND_REQUESTED,
    orderId,
    userId,
    {
      orderId,
      userId,
      type: 'cancellation',
      reason,
    },
  );

  await publishEvent(notificationEvent);
  console.log('📧 Cancellation notification requested', { orderId });
}

