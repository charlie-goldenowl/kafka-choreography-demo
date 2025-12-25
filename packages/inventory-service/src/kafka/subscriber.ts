import {
  EventType,
  type InventoryReleaseRequestedEvent,
  type InventoryReserveRequestedEvent,
  type OrderCancelledEvent,
} from '@kafka-choreography/shared';
import { consumer } from './client.js';
import {
  handleInventoryReleaseRequested,
  handleInventoryReserveRequested,
  handleOrderCancelled,
} from '../handlers/inventory-handler.js';

/**
 * Subscribe to Kafka topics and handle events
 */
export async function subscribeToEvents(): Promise<void> {
  await consumer.subscribe({
    topics: ['inventory-events', 'order-events'],
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      if (!message.value) {
        return;
      }

      try {
        const event = JSON.parse(message.value.toString());

        console.log(`📨 Received event: ${event.eventType}`, {
          topic,
          partition,
          orderId: event.orderId,
          eventId: event.eventId,
        });

        // Route event to appropriate handler
        switch (event.eventType) {
          case EventType.INVENTORY_RESERVE_REQUESTED:
            await handleInventoryReserveRequested(event as InventoryReserveRequestedEvent);
            break;

          case EventType.INVENTORY_RELEASE_REQUESTED:
            await handleInventoryReleaseRequested(event as InventoryReleaseRequestedEvent);
            break;

          case EventType.ORDER_CANCELLED:
            await handleOrderCancelled(event as OrderCancelledEvent);
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
    },
  });
}

