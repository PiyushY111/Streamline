import type { ZodType } from 'zod';

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
  zodSchema?: ZodType<T>;
  maxRetries?: number;
  temperature?: number;
  maxTokens?: number;
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

export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface AiToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
  thoughtSignature?: string;
}

export interface AiChatMessage {
  role: 'user' | 'model' | 'tool';
  content?: string | null;
  toolCalls?: AiToolCall[];
  toolName?: string;
  toolResult?: unknown;
}

export interface AiChatTurnOptions {
  messages: AiChatMessage[];
  systemInstruction?: string;
  tools?: AiToolDefinition[];
  temperature?: number;
  models?: string[];
}

export interface AiChatTurnResponse {
  text?: string;
  toolCalls?: AiToolCall[];
  model?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
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

  /**
   * Multi-turn chat with native tool/function calling across any provider.
   */
  chatWithTools(options: AiChatTurnOptions): Promise<AiChatTurnResponse>;
}

