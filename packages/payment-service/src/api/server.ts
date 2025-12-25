import express, { type Request, type Response } from 'express';
import { paymentStore } from '../storage/payment-store.js';

const PORT = Number.parseInt(process.env.PORT || '3003', 10);

/**
 * Express server for payment service
 */
export function startServer(): void {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'payment-service' });
  });

  // Get all payments
  app.get('/payments', (_req: Request, res: Response) => {
    const payments = paymentStore.getAll();
    res.json(payments);
  });

  // Get payment by ID
  app.get('/payments/:paymentId', (req: Request, res: Response) => {
    const { paymentId } = req.params;
    const payment = paymentStore.get(paymentId);
    if (payment) {
      res.json(payment);
    } else {
      res.status(404).json({ error: 'Payment not found' });
    }
  });

  // Get payment by order ID
  app.get('/payments/order/:orderId', (req: Request, res: Response) => {
    const { orderId } = req.params;
    const payment = paymentStore.getByOrderId(orderId);
    if (payment) {
      res.json(payment);
    } else {
      res.status(404).json({ error: 'Payment not found' });
    }
  });

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.listen(PORT, () => {
    console.log(`🚀 Payment Service listening on port ${PORT}`);
  });
}
