import { Kafka, type KafkaConfig } from 'kafkajs';

const kafkaBrokers = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];

const kafkaConfig: KafkaConfig = {
  clientId: 'payment-service',
  brokers: kafkaBrokers,
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
};

export const kafka = new Kafka(kafkaConfig);

export const producer = kafka.producer({
  maxInFlightRequests: 1,
  idempotent: true,
  transactionTimeout: 30000,
});

export const consumer = kafka.consumer({
  groupId: 'payment-service-group',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
});

