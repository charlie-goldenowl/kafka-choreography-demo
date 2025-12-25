import {
  EventType,
  createEvent,
  type OrderCancelledEvent,
  type Payment,
  type PaymentFailedEvent,
  type PaymentProcessedEvent,
  type PaymentProcessRequestedEvent,
  type PaymentRefundRequestedEvent,
  type PaymentRefundedEvent,
  type ProcessPaymentResult,
} from '@kafka-choreography/shared';
import { publishEvent } from '../kafka/publisher.js';
import { paymentStore } from '../storage/payment-store.js';

/**
 * Handle payment process requested event
 * Simulates payment API call with various failure scenarios
 */
export async function handlePaymentProcessRequested(
  event: PaymentProcessRequestedEvent,
): Promise<void> {
  const { orderId, userId, data } = event;
  const { amount } = data;

  console.log('💳 Processing payment...', { orderId, userId, amount });

  // Simulate API call delay (1-2 seconds)
  const delay = 1000 + Math.random() * 1000;
  await new Promise((resolve) => setTimeout(resolve, delay));

  // Generate random scenario (0-100)
  const random = Math.random() * 100;

  // Scenario 1: Business Logic Error (7%) - No retry
  // Check business rules first (before API call)
  if (amount > 1000) {
    console.error('❌ Payment failed: Amount exceeds limit (business rule)', {
      amount,
      limit: 1000,
    });

    const failedEvent = createEvent<PaymentFailedEvent>(
      EventType.PAYMENT_FAILED,
      orderId,
      userId,
      {
        orderId,
        reason: 'Payment failed: Amount exceeds limit of 1000',
      },
    );

    await publishEvent(failedEvent);
    return;
  }

  // Scenario 2: Network Timeout (15%) - Transient error
  if (random < 15) {
    console.error('❌ Payment failed: Network timeout', {
      orderId,
      attempt: 'transient error - would retry in production',
    });

    // In production, implement retry logic or dead letter queue
    const failedEvent = createEvent<PaymentFailedEvent>(
      EventType.PAYMENT_FAILED,
      orderId,
      userId,
      {
        orderId,
        reason: 'Payment API timeout - network connection failed',
      },
    );

    await publishEvent(failedEvent);
    return;
  }

  // Scenario 3: Server Error 500 (10%) - Transient error
  if (random >= 15 && random < 25) {
    console.error('❌ Payment failed: Server error 500', {
      orderId,
      status: 500,
    });

    const failedEvent = createEvent<PaymentFailedEvent>(
      EventType.PAYMENT_FAILED,
      orderId,
      userId,
      {
        orderId,
        reason: 'Payment API server error 500 - Internal server error',
      },
    );

    await publishEvent(failedEvent);
    return;
  }

  // Scenario 4: Client Error 400 - Bad Request (5%) - No retry
  if (random >= 25 && random < 30) {
    console.error('❌ Payment failed: Client error 400', {
      orderId,
      status: 400,
      reason: 'Invalid request format',
    });

    const failedEvent = createEvent<PaymentFailedEvent>(
      EventType.PAYMENT_FAILED,
      orderId,
      userId,
      {
        orderId,
        reason: 'Payment failed: Invalid request format (400 Bad Request)',
      },
    );

    await publishEvent(failedEvent);
    return;
  }

  // Scenario 5: Client Error 401 - Unauthorized (3%) - No retry
  if (random >= 30 && random < 33) {
    console.error('❌ Payment failed: Client error 401', {
      orderId,
      status: 401,
      reason: 'Invalid API credentials',
    });

    const failedEvent = createEvent<PaymentFailedEvent>(
      EventType.PAYMENT_FAILED,
      orderId,
      userId,
      {
        orderId,
        reason: 'Payment failed: Invalid API credentials (401 Unauthorized)',
      },
    );

    await publishEvent(failedEvent);
    return;
  }

  // Scenario 6: Success (~67% remaining)
  const paymentId = `payment-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const payment: Payment = {
    paymentId,
    orderId,
    userId,
    amount,
    status: 'completed',
    processedAt: new Date().toISOString(),
  };

  paymentStore.create(payment);

  const result: ProcessPaymentResult = {
    success: true,
    paymentId,
    amount,
  };

  const processedEvent = createEvent<PaymentProcessedEvent>(
    EventType.PAYMENT_PROCESSED,
    orderId,
    userId,
    {
      orderId,
      paymentId,
      amount,
      result,
    },
  );

  await publishEvent(processedEvent);
  console.log('✅ Payment processed successfully', {
    paymentId,
    amount,
    orderId,
  });
}

/**
 * Handle payment refund requested event (compensation)
 */
export async function handlePaymentRefundRequested(
  event: PaymentRefundRequestedEvent,
): Promise<void> {
  const { orderId, userId, data } = event;
  const { paymentId } = data;

  console.log('🔄 Refunding payment (compensation)...', { orderId, paymentId });

  // Simulate refund delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const payment = paymentStore.get(paymentId);
  if (!payment) {
    console.error('❌ Payment not found for refund', { paymentId });
    return;
  }

  // Update payment status
  paymentStore.update(paymentId, {
    status: 'refunded',
    refundedAt: new Date().toISOString(),
  });

  // Publish payment refunded event
  const refundedEvent = createEvent<PaymentRefundedEvent>(
    EventType.PAYMENT_REFUNDED,
    orderId,
    userId,
    {
      orderId,
      paymentId,
      amount: payment.amount,
    },
  );

  await publishEvent(refundedEvent);
  console.log('✅ Payment refunded', { paymentId, amount: payment.amount });
}

/**
 * Handle order cancelled event (alternative compensation path)
 * This is a safety net in case order cancellation happens before refund request
 */
export async function handleOrderCancelled(event: OrderCancelledEvent): Promise<void> {
  const { orderId } = event;

  console.log('🔄 Order cancelled, checking for payment to refund...', { orderId });

  // Find payment for this order
  const payment = paymentStore.getByOrderId(orderId);
  if (payment && payment.status === 'completed') {
    // Request refund
    const refundEvent = createEvent<PaymentRefundRequestedEvent>(
      EventType.PAYMENT_REFUND_REQUESTED,
      orderId,
      event.userId,
      {
        orderId,
        paymentId: payment.paymentId,
      },
    );

    await publishEvent(refundEvent);
    console.log('💰 Refund requested for cancelled order', { orderId, paymentId: payment.paymentId });
  }
}

