import crypto from 'crypto';
import { logger } from './logger.js';
import { requestContext } from './context.js';

export interface TelemetrySpanAttributes {
  'gen_ai.system'?: string;
  'gen_ai.request.model'?: string;
  'gen_ai.usage.prompt_tokens'?: number;
  'gen_ai.usage.completion_tokens'?: number;
  'gen_ai.usage.total_tokens'?: number;
  'gen_ai.usage.estimated_cost_usd'?: number;
  'agent.step_kind'?: 'user_message' | 'context_retrieved' | 'tool_call' | 'pending_action' | 'model_response';
  'agent.tool_name'?: string;
  'agent.permission_class'?: string;
  'agent.recalled_memory_ids'?: string[];
  'agent.untrusted_content_detected'?: boolean;
  'agent.action_id'?: string;
  'agent.action_status'?: string;
  'http.method'?: string;
  'http.target'?: string;
  'http.status_code'?: number;
  'db.system'?: string;
  'db.operation'?: string;
  [key: string]: unknown;
}

export interface TelemetrySpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: 'INTERNAL' | 'CLIENT' | 'SERVER' | 'PRODUCER' | 'CONSUMER';
  startTimeMs: number;
  endTimeMs?: number;
  durationMs?: number;
  statusCode: 'UNSET' | 'OK' | 'ERROR' | 'INTERCEPTED';
  statusMessage?: string;
  attributes: TelemetrySpanAttributes;
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, unknown> }>;
}

export type SpanExporter = (span: TelemetrySpan) => void;

class TelemetryRegistry {
  private inMemorySpans: TelemetrySpan[] = [];
  private exporters: SpanExporter[] = [];
  private maxStoredSpans = 500;

  constructor() {
    // Default in-memory exporter
    this.addExporter((span) => {
      this.inMemorySpans.push(span);
      if (this.inMemorySpans.length > this.maxStoredSpans) {
        this.inMemorySpans.shift();
      }
    });
  }

  addExporter(exporter: SpanExporter): void {
    this.exporters.push(exporter);
  }

  getRecentSpans(limit = 50): TelemetrySpan[] {
    return this.inMemorySpans.slice(-limit);
  }

  clearSpans(): void {
    this.inMemorySpans = [];
  }

  exportSpan(span: TelemetrySpan): void {
    for (const exporter of this.exporters) {
      try {
        exporter(span);
      } catch (err) {
        logger.warn({ err }, 'Error in telemetry span exporter');
      }
    }
  }
}

export const telemetryRegistry = new TelemetryRegistry();

/**
 * Generates a standard 16-byte (32-character) hex trace ID.
 */
export function generateTraceId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generates a standard 8-byte (16-character) hex span ID.
 */
export function generateSpanId(): string {
  return crypto.randomBytes(8).toString('hex');
}

export class Span {
  public data: TelemetrySpan;
  private isEnded = false;

  constructor(
    name: string,
    options: {
      traceId?: string;
      parentSpanId?: string;
      kind?: TelemetrySpan['kind'];
      attributes?: TelemetrySpanAttributes;
    } = {},
  ) {
    const store = requestContext.getStore();
    const traceId = options.traceId || store?.traceId || generateTraceId();
    const spanId = generateSpanId();
    const parentSpanId = options.parentSpanId || store?.spanId;

    this.data = {
      traceId,
      spanId,
      parentSpanId,
      name,
      kind: options.kind || 'INTERNAL',
      startTimeMs: Date.now(),
      statusCode: 'UNSET',
      attributes: options.attributes || {},
      events: [],
    };
  }

  setAttribute(key: string, value: unknown): this {
    this.data.attributes[key] = value;
    return this;
  }

  setAttributes(attributes: TelemetrySpanAttributes): this {
    Object.assign(this.data.attributes, attributes);
    return this;
  }

  addEvent(name: string, attributes?: Record<string, unknown>): this {
    this.data.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
    return this;
  }

  setStatus(code: TelemetrySpan['statusCode'], message?: string): this {
    this.data.statusCode = code;
    if (message) this.data.statusMessage = message;
    return this;
  }

  recordException(error: Error): this {
    this.setStatus('ERROR', error.message);
    this.addEvent('exception', {
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack,
    });
    return this;
  }

  end(): TelemetrySpan {
    if (this.isEnded) return this.data;
    this.isEnded = true;
    this.data.endTimeMs = Date.now();
    this.data.durationMs = this.data.endTimeMs - this.data.startTimeMs;
    if (this.data.statusCode === 'UNSET') {
      this.data.statusCode = 'OK';
    }
    telemetryRegistry.exportSpan(this.data);
    return this.data;
  }
}

/**
 * Creates and starts a new telemetry span.
 */
export function startSpan(
  name: string,
  options?: {
    traceId?: string;
    parentSpanId?: string;
    kind?: TelemetrySpan['kind'];
    attributes?: TelemetrySpanAttributes;
  },
): Span {
  return new Span(name, options);
}

/**
 * Runs an asynchronous or synchronous function within an active tracing span and ALS context.
 */
export async function withActiveSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T> | T,
  options?: {
    kind?: TelemetrySpan['kind'];
    attributes?: TelemetrySpanAttributes;
  },
): Promise<T> {
  const span = startSpan(name, options);
  const store = requestContext.getStore() || {
    requestId: span.data.spanId,
  };

  const nextContext = {
    ...store,
    traceId: span.data.traceId,
    spanId: span.data.spanId,
  };

  return requestContext.run(nextContext, async () => {
    try {
      const result = await fn(span);
      span.end();
      return result;
    } catch (err) {
      if (err instanceof Error) {
        span.recordException(err);
      }
      span.end();
      throw err;
    }
  });
}
