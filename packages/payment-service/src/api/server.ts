import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { paymentStore } from '../storage/payment-store.js';

const PORT = Number.parseInt(process.env.PORT || '3003', 10);

/**
 * Simple HTTP server for payment service
 */
export function startServer(): void {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Health check
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'payment-service' }));
      return;
    }

    // Get all payments
    if (req.url === '/payments' && req.method === 'GET') {
      const payments = paymentStore.getAll();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payments));
      return;
    }

    // Get payment by ID
    if (req.url?.startsWith('/payments/') && req.method === 'GET') {
      const paymentId = req.url.split('/')[2];
      const payment = paymentStore.get(paymentId);
      if (payment) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payment));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payment not found' }));
      }
      return;
    }

    // Get payment by order ID
    if (req.url?.startsWith('/payments/order/') && req.method === 'GET') {
      const orderId = req.url.split('/')[3];
      const payment = paymentStore.getByOrderId(orderId);
      if (payment) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payment));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payment not found' }));
      }
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(PORT, () => {
    console.log(`🚀 Payment Service listening on port ${PORT}`);
  });
}

