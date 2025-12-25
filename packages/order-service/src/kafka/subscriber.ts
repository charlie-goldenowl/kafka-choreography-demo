import {
  EventType,
  type InventoryReservedEvent,
  type InventoryReservationFailedEvent,
  type PaymentFailedEvent,
  type PaymentProcessedEvent,
} from '@kafka-choreography/shared';
import { withSpan } from '@kafka-choreography/shared';
import { consumer } from './client.js';
import {
  handleInventoryReserved,
  handleInventoryReservationFailed,
  handlePaymentFailed,
  handlePaymentProcessed,
} from '../handlers/order-handler.js';

/**
 * Subscribe to Kafka topics and handle events
 */
export async function subscribeToEvents(): Promise<void> {
  await consumer.subscribe({
    topics: ['inventory-events', 'payment-events'],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      if (!message.value) {
        return;
      }

      await withSpan('order-service', 'kafka.consume', async (span) => {
        try {
          const event = JSON.parse(message.value!.toString());

          if (span) {
            span.setAttributes({
              'kafka.topic': topic,
              'kafka.partition': partition,
              'event.type': event.eventType,
              'order.id': event.orderId || 'unknown',
            });
          }

          console.log(`📨 Received event: ${event.eventType}`, {
            topic,
            partition,
            orderId: event.orderId,
            eventId: event.eventId,
          });

          // Route event to appropriate handler
          switch (event.eventType) {
            case EventType.INVENTORY_RESERVED:
              await handleInventoryReserved(event as InventoryReservedEvent);
              break;

            case EventType.INVENTORY_RESERVATION_FAILED:
              await handleInventoryReservationFailed(event as InventoryReservationFailedEvent);
              break;

            case EventType.PAYMENT_PROCESSED:
              await handlePaymentProcessed(event as PaymentProcessedEvent);
              break;

            case EventType.PAYMENT_FAILED:
              await handlePaymentFailed(event as PaymentFailedEvent);
              break;

            default:
              console.warn('⚠️ Unknown event type', { eventType: event.eventType });
          }
        } catch (error) {
          console.error('❌ Error processing message', {
            topic,
            partition,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // In production, implement dead letter queue
        }
      });
    },
  });
}

