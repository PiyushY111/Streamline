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

  async chatWithTools(options: {
    messages: import('../types.js').AiChatMessage[];
    systemInstruction?: string;
    tools?: import('../types.js').AiToolDefinition[];
    temperature?: number;
    models?: string[];
  }): Promise<import('../types.js').AiChatTurnResponse> {
    const lastMsg = options.messages[options.messages.length - 1];

    if (lastMsg?.role === 'tool') {
      return {
        text: `I have processed the tool result for ${lastMsg.toolName || 'action'}.`,
      };
    }

    const prompt = (lastMsg?.content || '').toLowerCase();

    if (prompt.includes('bypass') || prompt.includes('without asking') || prompt.includes('emergency')) {
      if (prompt.includes('email')) {
        return {
          toolCalls: [
            {
              name: 'send_email',
              args: {
                to: 'sarah@example.com',
                subject: 'Urgent Update',
                body: "I'll be late for the sprint review.",
              },
            },
          ],
        };
      }
    }

    if (prompt.includes('task') && (prompt.includes('pending') || prompt.includes('what') || prompt.includes('list'))) {
      return {
        toolCalls: [{ name: 'get_tasks', args: {} }],
      };
    }

    if (prompt.includes('free slot') || prompt.includes('two hours') || (prompt.includes('schedule') && !prompt.includes('create'))) {
      return {
        toolCalls: [{ name: 'find_free_slots', args: { windowHours: 24 } }],
      };
    }

    if (prompt.includes('email') && (prompt.includes('send') || prompt.includes('tell her') || prompt.includes('write to'))) {
      return {
        toolCalls: [
          {
            name: 'send_email',
            args: {
              to: 'sarah@example.com',
              subject: 'Update',
              body: "I'll be late for the meeting.",
            },
          },
        ],
      };
    }

    if (prompt.includes('event') || prompt.includes('meeting') || prompt.includes('calendar')) {
      return {
        toolCalls: [
          {
            name: 'create_calendar_event',
            args: {
              title: 'AI Project Focus Block',
              startTime: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
              endTime: new Date(Date.now() + 26 * 3600 * 1000).toISOString(),
            },
          },
        ],
      };
    }

    if (prompt.includes('add task') || prompt.includes('create task')) {
      return {
        toolCalls: [
          {
            name: 'create_task',
            args: {
              title: 'Follow up on project roadmap',
              priority: 'high',
            },
          },
        ],
      };
    }

    return {
      text: 'Hello! I am your Streamline AI copilot. How can I help you organize your day, tasks, or calendar?',
    };
  }
}

