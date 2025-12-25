import {
  EventType,
  createEvent,
  type NotificationSendRequestedEvent,
  type NotificationSentEvent,
} from '@kafka-choreography/shared';
import { publishEvent } from '../kafka/publisher.js';

/**
 * Handle notification send requested event
 */
export async function handleNotificationSendRequested(
  event: NotificationSendRequestedEvent,
): Promise<void> {
  const { orderId, userId, data } = event;
  const { type, totalAmount, reason } = data;

  console.log('📧 Sending notification...', { orderId, userId, type });

  // Simulate sending email delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  if (type === 'confirmation') {
    console.log('✅ Confirmation email sent', {
      to: `user-${userId}@example.com`,
      subject: `Order Confirmation #${orderId}`,
      body: `Your order has been confirmed. Total: ${totalAmount} VND`,
    });
  } else if (type === 'cancellation') {
    console.log('✅ Cancellation email sent', {
      to: `user-${userId}@example.com`,
      subject: `Order Cancellation #${orderId}`,
      body: `Your order has been cancelled. Reason: ${reason || 'Unknown'}`,
    });
  }

  // Publish notification sent event
  const sentEvent = createEvent<NotificationSentEvent>(
    EventType.NOTIFICATION_SENT,
    orderId,
    userId,
    {
      orderId,
      userId,
      type,
    },
  );

  await publishEvent(sentEvent);
  console.log('✅ Notification sent event published', { orderId });
}

