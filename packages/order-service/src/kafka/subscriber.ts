import {
  EventType,
  type InventoryReservedEvent,
  type InventoryReservationFailedEvent,
  type PaymentFailedEvent,
  type PaymentProcessedEvent,
  withSpanFromContext,
} from '@kafka-choreography/shared';
import { consumer } from './client.js';
import {
  handleInventoryReserved,
  handleInventoryReservationFailed,
  handlePaymentFailed,
  handlePaymentProcessed,
} from '../handlers/order-handler.js';

/**
 * Subscribe to Kafka topics and handle events
 * 
 * Note: We extract trace context manually to ensure proper linking
 * KafkaJsInstrumentation may not always extract context correctly
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

      try {
        const event = JSON.parse(message.value!.toString());

        // Extract trace context from Kafka headers and create linked span
        await withSpanFromContext('order-service', 'processEvent', message.headers || {}, async (span) => {
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

