import type { Order } from '@kafka-choreography/shared';

/**
 * In-memory order store (in production, use database)
 */
class OrderStore {
  private orders = new Map<string, Order>();

  create(order: Order): void {
    this.orders.set(order.orderId, order);
  }

  get(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  update(orderId: string, updates: Partial<Order>): void {
    const order = this.orders.get(orderId);
    if (order) {
      this.orders.set(orderId, { ...order, ...updates });
    }
  }

  getAll(): Order[] {
    return Array.from(this.orders.values());
  }
}

export const orderStore = new OrderStore();

