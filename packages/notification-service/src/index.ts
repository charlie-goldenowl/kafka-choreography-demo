import { producer } from './kafka/client.js';
import { subscribeToEvents } from './kafka/subscriber.js';
import { startServer } from './api/server.js';

async function main(): Promise<void> {
  try {
    // Connect Kafka producer
    await producer.connect();
    console.log('✅ Kafka producer connected');

    // Connect Kafka consumer
    await subscribeToEvents();
    console.log('✅ Kafka consumer subscribed');

    // Start HTTP server
    startServer();

    console.log('🎉 Notification Service started successfully');
  } catch (error) {
    console.error('❌ Error starting Notification Service:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down Notification Service...');
  await producer.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down Notification Service...');
  await producer.disconnect();
  process.exit(0);
});

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

