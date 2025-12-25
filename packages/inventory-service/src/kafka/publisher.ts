import { producer } from './client.js';
import type { ChoreographyEvent } from '@kafka-choreography/shared';

/**
 * Publish event to Kafka topic
 */
export async function publishEvent(event: ChoreographyEvent): Promise<void> {
  const topic = 'inventory-events';

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

