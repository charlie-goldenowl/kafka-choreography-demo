import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { createOrder } from '../handlers/order-handler.js';
import { orderStore } from '../storage/order-store.js';
import type { OrderData } from '@kafka-choreography/shared';

const PORT = Number.parseInt(process.env.PORT || '3001', 10);

/**
 * Simple HTTP server for order service
 */
export function startServer(): void {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Health check
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'order-service' }));
      return;
    }

    // Get all orders
    if (req.url === '/orders' && req.method === 'GET') {
      const orders = orderStore.getAll();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(orders));
      return;
    }

    // Get order by ID
    if (req.url?.startsWith('/orders/') && req.method === 'GET') {
      const orderId = req.url.split('/')[2];
      const order = orderStore.get(orderId);
      if (order) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(order));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Order not found' }));
      }
      return;
    }

    // Create order
    if (req.url === '/orders' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const orderData: OrderData = JSON.parse(body);
          await createOrder(orderData);

          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'Order created', orderId: orderData.orderId }));
        } catch (error) {
          console.error('❌ Error creating order:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          );
        }
      });
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(PORT, () => {
    console.log(`🚀 Order Service listening on port ${PORT}`);
  });
}

