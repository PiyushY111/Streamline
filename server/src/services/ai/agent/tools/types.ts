import { z } from 'zod';
import { AiToolDefinition } from '../../core/types.js';

export type PermissionClass = 'read' | 'write' | 'send';

export interface ToolDefinition<TArgs = any, TResult = any> {
  name: string;
  description: string;
  permissionClass: PermissionClass;
  schema: z.ZodType<TArgs, any, any>;
  parameters: AiToolDefinition['parameters'];
  generateImpactPreview: (args: TArgs) => Record<string, unknown>;
  execute: (userId: string, args: TArgs) => Promise<TResult>;
}

