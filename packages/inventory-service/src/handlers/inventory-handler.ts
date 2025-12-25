import {
  EventType,
  createEvent,
  type InventoryReleaseRequestedEvent,
  type InventoryReleasedEvent,
  type InventoryReserveRequestedEvent,
  type InventoryReservedEvent,
  type InventoryReservationFailedEvent,
  type OrderCancelledEvent,
} from '@kafka-choreography/shared';
import { publishEvent } from '../kafka/publisher.js';
import { inventoryStore } from '../storage/inventory-store.js';

/**
 * Handle inventory reserve requested event
 */
export async function handleInventoryReserveRequested(
  event: InventoryReserveRequestedEvent,
): Promise<void> {
  const { orderId, userId, data } = event;

  console.log('📦 Reserving inventory...', { orderId, items: data.items });

  // Check and reserve inventory
  for (const item of data.items) {
    const stock = inventoryStore.get(item.itemId);
    if (!stock || stock.quantity < item.quantity) {
      console.error('❌ Insufficient inventory', {
        itemId: item.itemId,
        required: item.quantity,
        available: stock?.quantity,
      });

      // Publish reservation failed event
      const failedEvent = createEvent<InventoryReservationFailedEvent>(
        EventType.INVENTORY_RESERVATION_FAILED,
        orderId,
        userId,
        {
          orderId,
          reason: `Insufficient inventory for product ${item.itemId}`,
        },
      );

      await publishEvent(failedEvent);
      return;
    }
  }

  // Reserve all items
  let allReserved = true;
  for (const item of data.items) {
    const reserved = inventoryStore.reserve(item.itemId, item.quantity);
    if (!reserved) {
      allReserved = false;
      break;
    }
  }

  if (!allReserved) {
    // Rollback any reservations made
    for (const item of data.items) {
      inventoryStore.release(item.itemId, item.quantity);
    }

    const failedEvent = createEvent<InventoryReservationFailedEvent>(
      EventType.INVENTORY_RESERVATION_FAILED,
      orderId,
      userId,
      {
        orderId,
        reason: 'Failed to reserve inventory',
      },
    );

    await publishEvent(failedEvent);
    return;
  }

  // Publish inventory reserved event
  const reservedEvent = createEvent<InventoryReservedEvent>(
    EventType.INVENTORY_RESERVED,
    orderId,
    userId,
    {
      orderId,
      items: data.items,
      result: {
        success: true,
        message: 'Inventory reserved successfully',
      },
    },
  );

  await publishEvent(reservedEvent);
  console.log('✅ Inventory reserved', { orderId });
}

/**
 * Handle inventory release requested event (compensation)
 */
export async function handleInventoryReleaseRequested(
  event: InventoryReleaseRequestedEvent,
): Promise<void> {
  const { orderId, userId, data } = event;

  console.log('🔄 Releasing inventory (compensation)...', { orderId, items: data.items });

  // Release all items
  for (const item of data.items) {
    inventoryStore.release(item.itemId, item.quantity);
  }

  // Publish inventory released event
  const releasedEvent = createEvent<InventoryReleasedEvent>(
    EventType.INVENTORY_RELEASED,
    orderId,
    userId,
    {
      orderId,
      items: data.items,
    },
  );

  await publishEvent(releasedEvent);
  console.log('✅ Inventory released', { orderId });
}

/**
 * Handle order cancelled event (alternative compensation path)
 * This is a safety net in case order cancellation happens before release request
 */
export async function handleOrderCancelled(event: OrderCancelledEvent): Promise<void> {
  const { orderId } = event;

  console.log('🔄 Order cancelled, checking for inventory to release...', { orderId });

  // Note: In a real system, we would need to track which orders have reserved inventory
  // For simplicity, we rely on the explicit release request event
  // This handler can be used for cleanup or monitoring
}

