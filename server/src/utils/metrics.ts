/**
 * Prometheus-Compatible Metrics Registry & Collector for Streamline.
 * Exports metrics in standard text format (text/plain; version=0.0.4).
 */

export interface MetricLabels {
  [key: string]: string | number | undefined;
}

function formatLabels(labels?: MetricLabels): string {
  if (!labels || Object.keys(labels).length === 0) return '';
  const entries = Object.entries(labels)
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`);
  return entries.length > 0 ? `{${entries.join(',')}}` : '';
}

export class Counter {
  private values = new Map<string, number>();

  constructor(
    public readonly name: string,
    public readonly help: string,
  ) {}

  inc(labels?: MetricLabels, value = 1): void {
    const key = formatLabels(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current + value);
  }

  get(labels?: MetricLabels): number {
    return this.values.get(formatLabels(labels)) || 0;
  }

  reset(): void {
    this.values.clear();
  }

  toPrometheus(): string {
    const lines: string[] = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    if (this.values.size === 0) {
      lines.push(`${this.name} 0`);
    } else {
      for (const [labelsStr, val] of this.values.entries()) {
        lines.push(`${this.name}${labelsStr} ${val}`);
      }
    }
    return lines.join('\n');
  }
}

export class Gauge {
  private values = new Map<string, number>();

  constructor(
    public readonly name: string,
    public readonly help: string,
  ) {}

  set(value: number, labels?: MetricLabels): void {
    this.values.set(formatLabels(labels), value);
  }

  inc(labels?: MetricLabels, value = 1): void {
    const key = formatLabels(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current + value);
  }

  dec(labels?: MetricLabels, value = 1): void {
    const key = formatLabels(labels);
    const current = this.values.get(key) || 0;
    this.values.set(key, current - value);
  }

  get(labels?: MetricLabels): number {
    return this.values.get(formatLabels(labels)) || 0;
  }

  reset(): void {
    this.values.clear();
  }

  toPrometheus(): string {
    const lines: string[] = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} gauge`];
    if (this.values.size === 0) {
      lines.push(`${this.name} 0`);
    } else {
      for (const [labelsStr, val] of this.values.entries()) {
        lines.push(`${this.name}${labelsStr} ${val}`);
      }
    }
    return lines.join('\n');
  }
}

export class Histogram {
  private buckets: number[];
  private counts = new Map<string, Map<number, number>>();
  private sums = new Map<string, number>();
  private totals = new Map<string, number>();

  constructor(
    public readonly name: string,
    public readonly help: string,
    buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  ) {
    this.buckets = [...buckets].sort((a, b) => a - b);
  }

  observe(value: number, labels?: MetricLabels): void {
    const labelKey = formatLabels(labels);

    if (!this.counts.has(labelKey)) {
      this.counts.set(labelKey, new Map());
      this.sums.set(labelKey, 0);
      this.totals.set(labelKey, 0);
    }

    const bucketCounts = this.counts.get(labelKey)!;
    const currentSum = this.sums.get(labelKey) || 0;
    const currentTotal = this.totals.get(labelKey) || 0;

    this.sums.set(labelKey, currentSum + value);
    this.totals.set(labelKey, currentTotal + 1);

    for (const b of this.buckets) {
      if (value <= b) {
        bucketCounts.set(b, (bucketCounts.get(b) || 0) + 1);
      }
    }
  }

  reset(): void {
    this.counts.clear();
    this.sums.clear();
    this.totals.clear();
  }

  toPrometheus(): string {
    const lines: string[] = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];

    if (this.totals.size === 0) {
      for (const b of this.buckets) {
        lines.push(`${this.name}_bucket{le="${b}"} 0`);
      }
      lines.push(`${this.name}_bucket{le="+Inf"} 0`);
      lines.push(`${this.name}_sum 0`);
      lines.push(`${this.name}_count 0`);
    } else {
      for (const [labelsStr, total] of this.totals.entries()) {
        const bucketMap = this.counts.get(labelsStr) || new Map();
        const sum = this.sums.get(labelsStr) || 0;

        const baseLabels = labelsStr.length > 2 ? labelsStr.slice(1, -1) + ',' : '';

        for (const b of this.buckets) {
          const count = bucketMap.get(b) || 0;
          lines.push(`${this.name}_bucket{${baseLabels}le="${b}"} ${count}`);
        }
        lines.push(`${this.name}_bucket{${baseLabels}le="+Inf"} ${total}`);
        lines.push(`${this.name}_sum${labelsStr} ${sum.toFixed(6)}`);
        lines.push(`${this.name}_count${labelsStr} ${total}`);
      }
    }

    return lines.join('\n');
  }
}

export class MetricsRegistry {
  public readonly httpRequestsTotal = new Counter(
    'streamline_http_requests_total',
    'Total number of HTTP requests processed by Streamline backend API',
  );

  public readonly httpRequestDurationSeconds = new Histogram(
    'streamline_http_request_duration_seconds',
    'HTTP request duration latency in seconds',
    [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  );

  public readonly agentToolDurationSeconds = new Histogram(
    'streamline_agent_tool_duration_seconds',
    'Agent tool invocation execution duration in seconds',
    [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  );

  public readonly policyDecisionsTotal = new Counter(
    'streamline_policy_decisions_total',
    'Total count of AI agent action policy gate decisions',
  );

  public readonly circuitBreakerTripsTotal = new Counter(
    'streamline_circuit_breaker_trips_total',
    'Total number of times AI cost guard circuit breaker tripped',
  );

  public readonly oauthRefreshErrorsTotal = new Counter(
    'streamline_oauth_refresh_errors_total',
    'Total number of Google OAuth token refresh failures',
  );

  public readonly dlqSize = new Gauge(
    'streamline_dlq_size',
    'Current number of failed jobs sitting in Dead Letter Queues',
  );

  public readonly activeSseClients = new Gauge(
    'streamline_active_sse_clients',
    'Number of active live SSE streaming subscriber connections',
  );

  public readonly aiTokensTotal = new Counter(
    'streamline_ai_tokens_total',
    'Total AI prompt and completion tokens consumed across models',
  );

  public readonly aiCostUsdTotal = new Counter(
    'streamline_ai_cost_usd_total',
    'Total AI expenditure in USD across models and features',
  );

  toPrometheus(): string {
    return [
      this.httpRequestsTotal.toPrometheus(),
      this.httpRequestDurationSeconds.toPrometheus(),
      this.agentToolDurationSeconds.toPrometheus(),
      this.policyDecisionsTotal.toPrometheus(),
      this.circuitBreakerTripsTotal.toPrometheus(),
      this.oauthRefreshErrorsTotal.toPrometheus(),
      this.dlqSize.toPrometheus(),
      this.activeSseClients.toPrometheus(),
      this.aiTokensTotal.toPrometheus(),
      this.aiCostUsdTotal.toPrometheus(),
    ].join('\n\n');
  }

  resetAll(): void {
    this.httpRequestsTotal.reset();
    this.httpRequestDurationSeconds.reset();
    this.agentToolDurationSeconds.reset();
    this.policyDecisionsTotal.reset();
    this.circuitBreakerTripsTotal.reset();
    this.oauthRefreshErrorsTotal.reset();
    this.dlqSize.reset();
    this.activeSseClients.reset();
    this.aiTokensTotal.reset();
    this.aiCostUsdTotal.reset();
  }
}

export const metrics = new MetricsRegistry();

/**
 * Returns formatted Prometheus exposition text payload.
 */
export function getPrometheusMetrics(): string {
  return metrics.toPrometheus() + '\n';
}
