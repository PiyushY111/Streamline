import type {
  AiProvider,
  AiGenerateTextOptions,
  AiStructuredJsonOptions,
  AiStreamTextOptions,
  AiEmbeddingOptions,
} from '../types.js';

export class MockAiProvider implements AiProvider {
  readonly name = 'mock';

  isAvailable(): boolean {
    return true;
  }

  async generateText(options: AiGenerateTextOptions): Promise<string> {
    return `[Mock AI Response for: "${options.prompt.slice(0, 50)}..."]`;
  }

  async generateStructuredJson<T = any>(options: AiStructuredJsonOptions<T>): Promise<T> {
    return {} as T;
  }

  async streamText(
    options: AiStreamTextOptions,
    onChunk: (chunk: string) => void
  ): Promise<string> {
    const text = 'Hi,\n\nThank you for reaching out. I have reviewed the details and will follow up shortly.\n\nBest regards,';
    const words = text.split(' ');
    for (const word of words) {
      onChunk(word + ' ');
      await new Promise((r) => setTimeout(r, 20));
    }
    return text;
  }

  async generateEmbedding(text: string, options?: AiEmbeddingOptions): Promise<number[]> {
    const dims = options?.dimensions || 768;
    const embedding = new Array(dims).fill(0);
    // Deterministic pseudo-embedding based on string character codes
    for (let i = 0; i < text.length; i++) {
      embedding[i % dims] += text.charCodeAt(i) / 1000;
    }
    return embedding;
  }
}
