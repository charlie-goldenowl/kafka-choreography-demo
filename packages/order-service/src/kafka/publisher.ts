import { producer } from './client.js';
import type { ChoreographyEvent } from '@kafka-choreography/shared';

/**
 * Publish event to Kafka topic
 */
export async function publishEvent(event: ChoreographyEvent): Promise<void> {
  const topic = getTopicForEvent(event.eventType);

  await producer.send({
    topic,
    messages: [
      {
        key: event.orderId,
        value: JSON.stringify(event),
        headers: {
          eventType: event.eventType,
          orderId: event.orderId,
          userId: event.userId,
        },
      },
    ],
  });
}

/**
 * Get Kafka topic name for event type
 */
function getTopicForEvent(eventType: string): string {
  // Map event types to topics
  const topicMap: Record<string, string> = {
    'order.created': 'order-events',
    'order.confirmed': 'order-events',
    'order.cancelled': 'order-events',
    'inventory.reserve.requested': 'inventory-events',
    'inventory.release.requested': 'inventory-events',
    'payment.process.requested': 'payment-events',
    'payment.refund.requested': 'payment-events',
    'notification.send.requested': 'notification-events',
  };

  return topicMap[eventType] || 'default-events';
}

