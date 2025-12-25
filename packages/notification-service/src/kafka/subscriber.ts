import { EventType, type NotificationSendRequestedEvent, withSpanFromContext } from '@kafka-choreography/shared';
import { consumer } from './client.js';
import { handleNotificationSendRequested } from '../handlers/notification-handler.js';

/**
 * Subscribe to Kafka topics and handle events
 */
export async function subscribeToEvents(): Promise<void> {
  await consumer.subscribe({
    topics: ['notification-events'],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      if (!message.value) {
        return;
      }

      try {
        const event = JSON.parse(message.value!.toString());

        await withSpanFromContext('notification-service', 'processEvent', message.headers || {}, async (span) => {
          span.setAttributes({
            'kafka.topic': topic,
            'kafka.partition': partition,
            'event.type': event.eventType,
            'order.id': event.orderId || 'unknown',
          });

          console.log(`📨 Received event: ${event.eventType}`, {
            topic,
            partition,
            orderId: event.orderId,
            eventId: event.eventId,
          });

          // Route event to appropriate handler
          switch (event.eventType) {
            case EventType.NOTIFICATION_SEND_REQUESTED:
              await handleNotificationSendRequested(event as NotificationSendRequestedEvent);
              break;

            default:
              console.warn('⚠️ Unknown event type', { eventType: event.eventType });
          }
        });
      } catch (error) {
        console.error('❌ Error processing message', {
          topic,
          partition,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // In production, implement dead letter queue
      }
    },
  });
}

