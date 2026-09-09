export interface AiGenerateTextOptions {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  models?: string[];
}

export interface AiStructuredJsonOptions<T = any> {
  prompt: string;
  systemPrompt?: string;
  schema?: any;
  models?: string[];
}

export interface AiStreamTextOptions {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  models?: string[];
}

export interface AiEmbeddingOptions {
  model?: string;
  dimensions?: number;
}

export interface AiProvider {
  readonly name: string;

  /**
   * Check if this provider has the credentials and configuration needed to execute calls.
   */
  isAvailable(): boolean;

  /**
   * Standard plain text generation.
   */
  generateText(options: AiGenerateTextOptions): Promise<string>;

  /**
   * Structured JSON generation conforming to a schema.
   */
  generateStructuredJson<T = any>(options: AiStructuredJsonOptions<T>): Promise<T>;

  /**
   * Stream draft tokens/chunks over SSE or callbacks.
   */
  streamText(options: AiStreamTextOptions, onChunk: (chunk: string) => void): Promise<string>;

  /**
   * High-dimensional vector embedding generation for semantic memory and similarity search.
   */
  generateEmbedding(text: string, options?: AiEmbeddingOptions): Promise<number[]>;
}
