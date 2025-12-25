import type { InventoryItem } from '@kafka-choreography/shared';

/**
 * In-memory inventory store (in production, use database)
 */
class InventoryStore {
  private inventory = new Map<string, InventoryItem>([
    ['item-1', { name: 'Product 1', quantity: 10, reserved: 0 }],
    ['item-2', { name: 'Product 2', quantity: 5, reserved: 0 }],
    ['item-3', { name: 'Product 3', quantity: 8, reserved: 0 }],
  ]);

  get(itemId: string): InventoryItem | undefined {
    return this.inventory.get(itemId);
  }

  reserve(itemId: string, quantity: number): boolean {
    const item = this.inventory.get(itemId);
    if (!item || item.quantity < quantity) {
      return false;
    }

    item.quantity -= quantity;
    item.reserved = (item.reserved || 0) + quantity;
    return true;
  }

  release(itemId: string, quantity: number): void {
    const item = this.inventory.get(itemId);
    if (item) {
      item.quantity += quantity;
      item.reserved = Math.max(0, (item.reserved || 0) - quantity);
    }
  }

  getAll(): Map<string, InventoryItem> {
    return new Map(this.inventory);
  }
}

export const inventoryStore = new InventoryStore();

