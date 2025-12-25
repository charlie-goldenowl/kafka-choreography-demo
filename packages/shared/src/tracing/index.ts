/**
 * OpenTelemetry tracing setup for microservices
 * Exports tracing utilities to instrument services
 */

import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { trace } from '@opentelemetry/api';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

const JAEGER_OTLP_ENDPOINT = process.env.JAEGER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';

/**
 * Initialize tracing for a service
 */
export function initTracing(serviceName: string): void {
  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
    }),
  });

  const exporter = new OTLPTraceExporter({
    url: JAEGER_OTLP_ENDPOINT,
  });

  provider.addSpanProcessor(new BatchSpanProcessor(exporter));

  provider.register();

  console.log(`🔍 Tracing initialized for ${serviceName}`);
  console.log(`   Jaeger OTLP endpoint: ${JAEGER_OTLP_ENDPOINT}`);
}

/**
 * Get tracer instance
 */
export function getTracer(serviceName: string) {
  return trace.getTracer(serviceName);
}

/**
 * Create a span for async operation
 */
export async function withSpan<T>(
  tracerName: string,
  spanName: string,
  fn: (span: any) => Promise<T>,
): Promise<T> {
  const tracer = getTracer(tracerName);
  const span = tracer.startSpan(spanName);

  try {
    const result = await fn(span);
    span.setStatus({ code: 1 }); // OK
    return result;
  } catch (error) {
    span.setStatus({ code: 2, message: error instanceof Error ? error.message : 'Unknown error' }); // ERROR
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    span.end();
  }
}

