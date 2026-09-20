CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"embedding" vector(768),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"from_entity_id" uuid NOT NULL,
	"to_entity_id" uuid NOT NULL,
	"relation_type" text NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"source_ref" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_style_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"formality" text DEFAULT 'balanced' NOT NULL,
	"brevity" text DEFAULT 'concise' NOT NULL,
	"avg_sentence_length" integer DEFAULT 14 NOT NULL,
	"preferred_greeting" text DEFAULT 'Hi' NOT NULL,
	"preferred_signoff" text DEFAULT 'Best' NOT NULL,
	"use_bullet_points" boolean DEFAULT false NOT NULL,
	"sample_sent_snippets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"traits_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_style_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "embedding_model_version" text DEFAULT 'text-embedding-004' NOT NULL;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relations" ADD CONSTRAINT "entity_relations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relations" ADD CONSTRAINT "entity_relations_from_entity_id_entities_id_fk" FOREIGN KEY ("from_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relations" ADD CONSTRAINT "entity_relations_to_entity_id_entities_id_fk" FOREIGN KEY ("to_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_style_profiles" ADD CONSTRAINT "user_style_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entities_user_idx" ON "entities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "entities_user_type_idx" ON "entities" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "entities_name_idx" ON "entities" USING btree ("name");--> statement-breakpoint
CREATE INDEX "entity_relations_hops_idx" ON "entity_relations" USING btree ("user_id","from_entity_id","to_entity_id");--> statement-breakpoint
CREATE INDEX "entity_relations_type_idx" ON "entity_relations" USING btree ("relation_type");--> statement-breakpoint
CREATE INDEX "user_style_profiles_user_idx" ON "user_style_profiles" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pending_actions_expires_idx" ON "pending_actions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "pending_actions_user_created_idx" ON "pending_actions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "emails_account_folder_received_idx" ON "emails" USING btree ("account_id","folder","received_at");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "memories_user_model_version_idx" ON "memories" USING btree ("user_id","embedding_model_version");--> statement-breakpoint
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_status_valid" CHECK ("connected_accounts"."status" IN ('active', 'error', 'disconnected'));--> statement-breakpoint
ALTER TABLE "sync_states" ADD CONSTRAINT "sync_states_status_valid" CHECK ("sync_states"."status" IN ('idle', 'syncing', 'error'));--> statement-breakpoint
ALTER TABLE "sync_states" ADD CONSTRAINT "sync_states_service_valid" CHECK ("sync_states"."service" IN ('gmail', 'calendar'));--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_role_valid" CHECK ("agent_messages"."role" IN ('user', 'model', 'tool'));--> statement-breakpoint
ALTER TABLE "pending_actions" ADD CONSTRAINT "pending_actions_status_valid" CHECK ("pending_actions"."status" IN ('pending', 'approved', 'rejected', 'executed', 'failed', 'expired'));--> statement-breakpoint
ALTER TABLE "email_ai_metadata" ADD CONSTRAINT "email_ai_metadata_priority_valid" CHECK ("email_ai_metadata"."priority" IN ('p1_urgent', 'p2_important', 'p3_updates', 'p4_newsletter', 'p5_low'));--> statement-breakpoint
ALTER TABLE "email_ai_metadata" ADD CONSTRAINT "email_ai_metadata_urgency_range" CHECK ("email_ai_metadata"."urgency_score" >= 1 AND "email_ai_metadata"."urgency_score" <= 100);--> statement-breakpoint
ALTER TABLE "email_ai_metadata" ADD CONSTRAINT "email_ai_metadata_category_valid" CHECK ("email_ai_metadata"."category" IN ('action_required', 'direct', 'notification', 'newsletter', 'promotional'));--> statement-breakpoint
ALTER TABLE "user_ai_preferences" ADD CONSTRAINT "user_ai_preferences_delivery_mode_valid" CHECK ("user_ai_preferences"."digest_delivery_mode" IN ('in_app', 'email', 'both'));--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_folder_valid" CHECK ("emails"."folder" IN ('inbox', 'sent', 'drafts', 'trash', 'spam', 'archive', 'starred'));--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_category_valid" CHECK ("emails"."category" IN ('primary', 'social', 'promotions', 'updates', 'forums'));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_importance_range" CHECK ("tasks"."importance" >= 0.0 AND "tasks"."importance" <= 1.0);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_priority_valid" CHECK ("tasks"."priority" IN ('low', 'medium', 'high', 'urgent'));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_valid" CHECK ("tasks"."status" IN ('todo', 'in_progress', 'completed', 'cancelled'));--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_type_valid" CHECK ("memories"."type" IN ('preference', 'decision', 'project_fact'));--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_status_valid" CHECK ("memories"."status" IN ('active', 'superseded', 'archived'));