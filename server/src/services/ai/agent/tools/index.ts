import { getTasksTool } from './get_tasks.js';
import { findFreeSlotsTool } from './find_free_slots.js';
import { draftEmailTool } from './draft_email.js';
import { createCalendarEventTool } from './create_calendar_event.js';
import { createTaskTool } from './create_task.js';
import { sendEmailTool } from './send_email.js';
import { searchMemoryTool } from './search_memory.js';
import { saveMemoryTool } from './save_memory.js';
import { getEmailTool } from './get_email.js';
import type { ToolDefinition } from './types.js';
import { AiToolDefinition } from '../../core/types.js';

export * from './types.js';

export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  get_tasks: getTasksTool,
  find_free_slots: findFreeSlotsTool,
  draft_email: draftEmailTool,
  create_calendar_event: createCalendarEventTool,
  create_task: createTaskTool,
  send_email: sendEmailTool,
  search_memory: searchMemoryTool,
  save_memory: saveMemoryTool,
  get_email: getEmailTool,
};

export function getAiToolDeclarations(): AiToolDefinition[] {
  return Object.values(TOOL_REGISTRY).map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}
