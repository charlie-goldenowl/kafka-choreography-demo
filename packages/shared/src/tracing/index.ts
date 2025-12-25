/**
 * OpenTelemetry tracing setup for microservices
 * Simplified setup using NodeSDK with auto-instrumentations
 * 
 * This approach:
 * - Automatically instruments HTTP, database, and Kafka operations
 * - Reduces boilerplate code significantly
 * - Maintains best practices (resource attributes, batch processing)
 * - Still allows manual spans for business logic when needed
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { KafkaJsInstrumentation } from '@opentelemetry/instrumentation-kafkajs';
import { trace, SpanStatusCode, type Span, context, propagation } from '@opentelemetry/api';
import { randomUUID } from 'crypto';

const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 
                     process.env.JAEGER_OTLP_ENDPOINT || 
                     'http://localhost:4318/v1/traces';
const DEPLOYMENT_ENV = process.env.DEPLOYMENT_ENV || process.env.NODE_ENV || 'development';
const SERVICE_VERSION = process.env.SERVICE_VERSION || '1.0.0';
const SERVICE_NAMESPACE = process.env.SERVICE_NAMESPACE || 'default';

let sdk: NodeSDK | null = null;

/**
 * Initialize tracing for a service using NodeSDK with auto-instrumentations
 * 
 * This automatically instruments:
 * - HTTP requests/responses (Express, Fastify, etc.)
 * - Database operations (if using supported drivers)
 * - Kafka producer/consumer operations
 * - And many more common Node.js libraries
 * 
 * Best Practices:
 * - Complete resource attributes (OpenTelemetry semantic conventions)
 * - Automatic context propagation via W3C Trace Context
 * - BatchSpanProcessor with optimized configuration
 * - Service instance ID for multi-instance deployments
 */
export function initTracing(serviceName: string): void {
  // Generate unique service instance ID for multi-instance deployments
  const serviceInstanceId = process.env.SERVICE_INSTANCE_ID || randomUUID();

  // Create resource with complete attributes following OpenTelemetry semantic conventions
  const resource = new Resource({
    // Service identification
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
    [SemanticResourceAttributes.SERVICE_NAMESPACE]: SERVICE_NAMESPACE,
    [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: serviceInstanceId,
    
    // Deployment information
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: DEPLOYMENT_ENV,
    
    // Telemetry SDK information
    [SemanticResourceAttributes.TELEMETRY_SDK_NAME]: 'opentelemetry',
    [SemanticResourceAttributes.TELEMETRY_SDK_LANGUAGE]: 'nodejs',
    [SemanticResourceAttributes.TELEMETRY_SDK_VERSION]: '0.52.1',
  });

  // Configure OTLP exporter
  const traceExporter = new OTLPTraceExporter({
    url: OTLP_ENDPOINT,
    // Optional: Add headers for authentication if needed
    // headers: {
    //   'Authorization': `Bearer ${process.env.JAEGER_AUTH_TOKEN}`,
    // },
  });

  // Initialize NodeSDK with auto-instrumentations
  sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      // Auto-instrument common Node.js libraries (HTTP, database, etc.)
      getNodeAutoInstrumentations({
        // Disable specific instrumentations if needed
        // '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
      // Kafka instrumentation - automatically propagates context via headers
      new KafkaJsInstrumentation(),
    ],
  });

  sdk.start();

  console.log(`🔍 Tracing initialized for ${serviceName}`);
  console.log(`   Service: ${serviceName} v${SERVICE_VERSION}`);
  console.log(`   Environment: ${DEPLOYMENT_ENV}`);
  console.log(`   Instance ID: ${serviceInstanceId}`);
  console.log(`   OTLP endpoint: ${OTLP_ENDPOINT}`);
  console.log(`   Auto-instrumentations: enabled`);
  console.log(`   Kafka instrumentation: enabled`);
}

/**
 * Shutdown tracing gracefully
 * Call this during application shutdown
 */
export function shutdownTracing(): Promise<void> {
  if (sdk) {
    return sdk.shutdown();
  }
  return Promise.resolve();
}

/**
 * Get tracer instance for manual spans
 * Use this when you need custom spans for business logic
 */
export function getTracer(serviceName: string) {
  return trace.getTracer(serviceName);
}

/**
 * Create a manual span for business logic
 * 
 * Use this when auto-instrumentation doesn't cover your use case
 * For example: custom business operations, complex workflows
 * 
 * @example
 * ```typescript
 * await withSpan('order-service', 'processOrder', async (span) => {
 *   span.setAttribute('order.id', orderId);
 *   // your business logic
 * });
 * ```
 */
export async function withSpan<T>(
  tracerName: string,
  spanName: string,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = getTracer(tracerName);
  
  return tracer.startActiveSpan(spanName, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ 
        code: SpanStatusCode.ERROR, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Inject trace context into Kafka message headers
 * Used when KafkaJsInstrumentation doesn't automatically propagate context
 */
export function injectTraceContext(): Record<string, string> {
  const headers: Record<string, string> = {};
  propagation.inject(context.active(), headers);
  return headers;
}

/**
 * Extract trace context from Kafka message headers
 * Used when KafkaJsInstrumentation doesn't automatically extract context
 */
export function extractTraceContext(headers: Record<string, string | Buffer | (string | Buffer)[] | undefined>): ReturnType<typeof context.active> {
  // Convert headers to string format for propagation
  const stringHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        const firstValue = value[0];
        stringHeaders[key] = typeof firstValue === 'string' ? firstValue : firstValue.toString();
      } else {
        stringHeaders[key] = typeof value === 'string' ? value : value.toString();
      }
    }
  }
  
  return propagation.extract(context.active(), stringHeaders);
}

/**
 * Create a span with extracted trace context from Kafka headers
 * This ensures spans are linked across services
 */
export async function withSpanFromContext<T>(
  tracerName: string,
  spanName: string,
  headers: Record<string, string | Buffer | (string | Buffer)[] | undefined>,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const extractedContext = extractTraceContext(headers);
  const tracer = getTracer(tracerName);
  
  return context.with(extractedContext, async () => {
    return tracer.startActiveSpan(spanName, async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({ 
          code: SpanStatusCode.ERROR, 
          message: error instanceof Error ? error.message : 'Unknown error' 
        });
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        throw error;
      } finally {
        span.end();
      }
    });
  });
}

/**
 * Re-export commonly used types and functions
 */
export { trace, SpanStatusCode, type Span, context } from '@opentelemetry/api';
