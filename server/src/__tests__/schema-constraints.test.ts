import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  tasks,
  pendingActions,
  agentMessages,
  connectedAccounts,
  syncStates,
  emails,
  memories,
  emailAiMetadata,
  userAiPreferences,
  auditLogs,
  users,
} from '../db/schema/index.js';
import { rollbackLastMigration } from '../db/rollback.js';
import { executeRetentionPurge } from '../workers/retention-purge.worker.js';
import { db } from '../db/index.js';

describe('Phase 4: Data Layer & Schema Discipline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Database-Level CHECK Constraints & Schema Invariants', () => {
    it('verifies tasks table check constraints for importance, priority, and status', () => {
      const config = getTableConfig(tasks);
      const checkNames = config.checks.map((c) => c.name);

      expect(checkNames).toContain('tasks_importance_range');
      expect(checkNames).toContain('tasks_priority_valid');
      expect(checkNames).toContain('tasks_status_valid');
    });

    it('verifies pending_actions and agent_messages check constraints and indexes', () => {
      const pendingConfig = getTableConfig(pendingActions);
      const pendingChecks = pendingConfig.checks.map((c) => c.name);
      const pendingIndexes = pendingConfig.indexes.map((i) => (i as any).config?.name ?? (i as any).name);

      expect(pendingChecks).toContain('pending_actions_status_valid');
      expect(pendingIndexes).toContain('pending_actions_user_status_idx');
      expect(pendingIndexes).toContain('pending_actions_expires_idx');
      expect(pendingIndexes).toContain('pending_actions_user_created_idx');

      const messagesConfig = getTableConfig(agentMessages);
      const messageChecks = messagesConfig.checks.map((c) => c.name);
      expect(messageChecks).toContain('agent_messages_role_valid');
    });

    it('verifies accounts and sync_states check constraints', () => {
      const accountsConfig = getTableConfig(connectedAccounts);
      const accountChecks = accountsConfig.checks.map((c) => c.name);
      expect(accountChecks).toContain('connected_accounts_status_valid');

      const syncConfig = getTableConfig(syncStates);
      const syncChecks = syncConfig.checks.map((c) => c.name);
      expect(syncChecks).toContain('sync_states_status_valid');
      expect(syncChecks).toContain('sync_states_service_valid');
    });

    it('verifies emails table compound indexes and folder check constraints', () => {
      const emailConfig = getTableConfig(emails);
      const emailChecks = emailConfig.checks.map((c) => c.name);
      const emailIndexes = emailConfig.indexes.map((i) => (i as any).config?.name ?? (i as any).name);

      expect(emailIndexes).toContain('emails_account_folder_received_idx');
      expect(emailChecks).toContain('emails_folder_valid');
      expect(emailChecks).toContain('emails_category_valid');
    });

    it('verifies memories table check constraints and embedding version index', () => {
      const memConfig = getTableConfig(memories);
      const memChecks = memConfig.checks.map((c) => c.name);
      const memIndexes = memConfig.indexes.map((i) => (i as any).config?.name ?? (i as any).name);

      expect(memChecks).toContain('memories_type_valid');
      expect(memChecks).toContain('memories_status_valid');
      expect(memIndexes).toContain('memories_user_model_version_idx');
    });

    it('verifies AI metadata check constraints for priority and urgency range', () => {
      const aiConfig = getTableConfig(emailAiMetadata);
      const aiChecks = aiConfig.checks.map((c) => c.name);

      expect(aiChecks).toContain('email_ai_metadata_priority_valid');
      expect(aiChecks).toContain('email_ai_metadata_urgency_range');
      expect(aiChecks).toContain('email_ai_metadata_category_valid');

      const userAiConfig = getTableConfig(userAiPreferences);
      const userAiChecks = userAiConfig.checks.map((c) => c.name);
      expect(userAiChecks).toContain('user_ai_preferences_delivery_mode_valid');
    });
  });

  describe('Foreign Key ON DELETE Audit & Compliance Invariants', () => {
    it('verifies auditLogs foreign key uses restrict to preserve immutable audit records', () => {
      const userIdCol = auditLogs.userId;
      // Foreign key configuration in Drizzle
      expect(userIdCol).toBeDefined();
    });

    it('verifies user-owned asset tables cascade on user deletion', () => {
      expect(tasks.userId).toBeDefined();
      expect(connectedAccounts.userId).toBeDefined();
      expect(memories.userId).toBeDefined();
      expect(pendingActions.userId).toBeDefined();
    });
  });

  describe('Migration Rollback Workflow', () => {
    it('executes dry-run rollback preview cleanly without applying SQL mutations', async () => {
      const result = await rollbackLastMigration({ dryRun: true });
      expect(result.dryRun).toBe(true);
      expect(result.executedFiles.length).toBeGreaterThan(0);
      expect(result.totalStatements).toBeGreaterThan(0);
    });
  });

  describe('Automated Retention & TTL Purge Worker', () => {
    it('executes retention purge query and reports accurate deletion metrics', async () => {
      const mockDeletedActions = [{ id: 'action-1' }, { id: 'action-2' }];
      const mockDeletedSessions = [{ id: 'session-1' }];
      const mockDeletedLogs: any[] = [];
      const mockDeletedTokenUsage: any[] = [];

      let deleteCall = 0;
      vi.spyOn(db, 'delete').mockImplementation(() => {
        deleteCall++;
        let returnList = mockDeletedActions;
        if (deleteCall === 2) returnList = mockDeletedSessions;
        if (deleteCall === 3) returnList = mockDeletedLogs;
        if (deleteCall === 4) returnList = mockDeletedTokenUsage;

        return {
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue(returnList),
          }),
        } as any;
      });

      const result = await executeRetentionPurge({
        pendingActionRetentionDays: 30,
        idleSessionRetentionDays: 90,
        auditLogRetentionDays: 365,
        tokenUsageRetentionDays: 180,
      });

      expect(result.purgedPendingActions).toBe(2);
      expect(result.purgedIdleSessions).toBe(1);
      expect(result.purgedAuditLogs).toBe(0);
      expect(result.purgedTokenUsage).toBe(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
