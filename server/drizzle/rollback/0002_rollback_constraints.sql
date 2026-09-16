-- Down Migration: Rollback Phase 4 Constraints and Indexes
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_importance_range";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_priority_valid";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_status_valid";
--> statement-breakpoint
ALTER TABLE "agent_messages" DROP CONSTRAINT IF EXISTS "agent_messages_role_valid";
--> statement-breakpoint
ALTER TABLE "pending_actions" DROP CONSTRAINT IF EXISTS "pending_actions_status_valid";
--> statement-breakpoint
ALTER TABLE "connected_accounts" DROP CONSTRAINT IF EXISTS "connected_accounts_status_valid";
--> statement-breakpoint
ALTER TABLE "sync_states" DROP CONSTRAINT IF EXISTS "sync_states_status_valid";
--> statement-breakpoint
ALTER TABLE "sync_states" DROP CONSTRAINT IF EXISTS "sync_states_service_valid";
--> statement-breakpoint
ALTER TABLE "emails" DROP CONSTRAINT IF EXISTS "emails_folder_valid";
--> statement-breakpoint
ALTER TABLE "emails" DROP CONSTRAINT IF EXISTS "emails_category_valid";
--> statement-breakpoint
ALTER TABLE "memories" DROP CONSTRAINT IF EXISTS "memories_type_valid";
--> statement-breakpoint
ALTER TABLE "memories" DROP CONSTRAINT IF EXISTS "memories_status_valid";
--> statement-breakpoint
ALTER TABLE "email_ai_metadata" DROP CONSTRAINT IF EXISTS "email_ai_metadata_priority_valid";
--> statement-breakpoint
ALTER TABLE "email_ai_metadata" DROP CONSTRAINT IF EXISTS "email_ai_metadata_urgency_range";
--> statement-breakpoint
ALTER TABLE "email_ai_metadata" DROP CONSTRAINT IF EXISTS "email_ai_metadata_category_valid";
--> statement-breakpoint
ALTER TABLE "user_ai_preferences" DROP CONSTRAINT IF EXISTS "user_ai_preferences_delivery_mode_valid";
--> statement-breakpoint
DROP INDEX IF EXISTS "emails_account_folder_received_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "pending_actions_expires_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "pending_actions_user_created_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "audit_logs_user_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "audit_logs_action_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "notifications_user_idx";
