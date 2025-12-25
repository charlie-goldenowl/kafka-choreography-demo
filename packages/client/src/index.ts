import type { OrderData } from '@kafka-choreography/shared';

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3001';

/**
 * Create order via Order Service API
 */
async function createOrder(orderData: OrderData): Promise<void> {
  try {
    const response = await fetch(`${ORDER_SERVICE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const error = (await response.json()) as { error?: string };
      throw new Error(error.error || 'Failed to create order');
    }

    const result = await response.json();
    console.log('✅ Order created:', result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error creating order:', errorMessage);
    throw error;
  }
}

/**
 * Get order status
 */
async function getOrder(orderId: string): Promise<void> {
  try {
    const response = await fetch(`${ORDER_SERVICE_URL}/orders/${orderId}`);

    if (!response.ok) {
      const error = (await response.json()) as { error?: string };
      throw new Error(error.error || 'Failed to get order');
    }

    const order = await response.json();
    console.log('📋 Order status:', JSON.stringify(order, null, 2));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Error getting order:', errorMessage);
  }
}

/**
 * Main function to test order workflow
 */
async function main(): Promise<void> {
  console.log('🔗 Connecting to Order Service...\n');

  // Test case 1: Successful order (amount < 1000)
  console.log('═══════════════════════════════════════════════════════');
  console.log('📦 TEST CASE 1: Successful Order');
  console.log('═══════════════════════════════════════════════════════\n');

  const orderData1: OrderData = {
    orderId: `order-${Date.now()}-1`,
    userId: 'user-123',
    items: [
      { itemId: 'item-1', name: 'Product 1', quantity: 2, price: 100 },
      { itemId: 'item-2', name: 'Product 2', quantity: 1, price: 200 },
    ],
    totalAmount: 400, // < 1000, will succeed
  };

  try {
    await createOrder(orderData1);
    console.log('\n⏳ Waiting for order processing...\n');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    await getOrder(orderData1.orderId);
  } catch (error) {
    console.error('❌ Test case 1 failed:', error);
  }

  console.log('\n\n');

  // Wait a bit before running test case 2
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Test case 2: Failed order (amount > 1000) - will trigger compensation
  console.log('═══════════════════════════════════════════════════════');
  console.log('📦 TEST CASE 2: Failed Order (Compensation)');
  console.log('═══════════════════════════════════════════════════════\n');

  const orderData2: OrderData = {
    orderId: `order-${Date.now()}-2`,
    userId: 'user-456',
    items: [
      { itemId: 'item-1', name: 'Product 1', quantity: 5, price: 300 },
      { itemId: 'item-3', name: 'Product 3', quantity: 3, price: 400 },
    ],
    totalAmount: 2700, // > 1000, will fail and trigger compensation
  };

  try {
    await createOrder(orderData2);
    console.log('\n⏳ Waiting for order processing and compensation...\n');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    await getOrder(orderData2.orderId);
  } catch (error) {
    console.error('❌ Test case 2 failed:', error);
  }

  console.log('\n\n');
  console.log('✨ All test cases completed!');
  console.log('📊 Check Kafka UI at: http://localhost:8080\n');
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});

