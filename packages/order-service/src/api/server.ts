import express, { type Request, type Response } from 'express';
import { createOrder } from '../handlers/order-handler.js';
import { orderStore } from '../storage/order-store.js';
import { withSpan } from '@kafka-choreography/shared';
import type { OrderData } from '@kafka-choreography/shared';

const PORT = Number.parseInt(process.env.PORT || '3001', 10);

/**
 * Express server for order service
 */
export function startServer(): void {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'order-service' });
  });

  // Get all orders
  app.get('/orders', (_req: Request, res: Response) => {
    const orders = orderStore.getAll();
    res.json(orders);
  });

  // Get order by ID
  app.get('/orders/:orderId', (req: Request, res: Response) => {
    const { orderId } = req.params;
    const order = orderStore.get(orderId);
    if (order) {
      res.json(order);
    } else {
      res.status(404).json({ error: 'Order not found' });
    }
  });

  // Create order
  app.post('/orders', async (req: Request, res: Response) => {
    await withSpan('order-service', 'http.post.orders', async (span) => {
      try {
        const orderData: OrderData = req.body;

        if (span) {
          span.setAttributes({
            'http.method': 'POST',
            'http.route': '/orders',
            'order.id': orderData.orderId,
          });
        }

        await createOrder(orderData);

        if (span) {
          span.setAttributes({
            'http.status_code': 201,
          });
        }

        res.status(201).json({ message: 'Order created', orderId: orderData.orderId });
      } catch (error) {
        console.error('❌ Error creating order:', error);

        if (span) {
          span.setAttributes({
            'http.status_code': 400,
            'error': true,
          });
        }

        res.status(400).json({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  });

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.listen(PORT, () => {
    console.log(`🚀 Order Service listening on port ${PORT}`);
  });
}
