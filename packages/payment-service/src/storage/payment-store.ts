import type { Payment } from '@kafka-choreography/shared';

/**
 * In-memory payment store (in production, use database)
 */
class PaymentStore {
  private payments = new Map<string, Payment>();

  create(payment: Payment): void {
    this.payments.set(payment.paymentId, payment);
  }

  get(paymentId: string): Payment | undefined {
    return this.payments.get(paymentId);
  }

  getByOrderId(orderId: string): Payment | undefined {
    return Array.from(this.payments.values()).find((p) => p.orderId === orderId);
  }

  update(paymentId: string, updates: Partial<Payment>): void {
    const payment = this.payments.get(paymentId);
    if (payment) {
      this.payments.set(paymentId, { ...payment, ...updates });
    }
  }

  getAll(): Payment[] {
    return Array.from(this.payments.values());
  }
}

export const paymentStore = new PaymentStore();

