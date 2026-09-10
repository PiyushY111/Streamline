CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "agent_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text,
	"tool_calls" jsonb,
	"tool_name" text,
	"tool_result" jsonb,
	"span_id" text,
	"parent_span_id" text,
	"latency_ms" integer,
	"retrieved_memory_ids" jsonb DEFAULT '[]'::jsonb,
	"token_prompt_count" integer DEFAULT 0,
	"token_candidate_count" integer DEFAULT 0,
	"cost_usd" text DEFAULT '0.000000',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid,
	"tool_name" text NOT NULL,
	"tool_args" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reasoning" text,
	"impact_preview" jsonb,
	"idempotency_key" text,
	"expires_at" timestamp NOT NULL,
	"result_json" jsonb,
	"error_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	CONSTRAINT "pending_actions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "ai_token_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"model" varchar(100) NOT NULL,
	"operation" varchar(50) NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd" varchar(30) DEFAULT '0.000000' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"digest_date" timestamp DEFAULT now() NOT NULL,
	"executive_greeting" text NOT NULL,
	"schedule_summary" text,
	"newsletter_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"action_summary" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_ai_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"priority" text NOT NULL,
	"urgency_score" integer DEFAULT 50 NOT NULL,
	"category" text NOT NULL,
	"one_sentence_summary" text,
	"newsletter_topic" text,
	"extracted_tasks" jsonb,
	"sentiment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_ai_metadata_email_id_unique" UNIQUE("email_id")
);
--> statement-breakpoint
CREATE TABLE "user_ai_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"digest_time" time DEFAULT '08:00:00' NOT NULL,
	"digest_timezone" text DEFAULT 'UTC' NOT NULL,
	"digest_delivery_mode" text DEFAULT 'in_app' NOT NULL,
	"is_auto_triage_enabled" boolean DEFAULT true NOT NULL,
	"vip_senders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"custom_instructions" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_ai_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"color" text DEFAULT '#3b82f6' NOT NULL,
	"stack" text,
	"current_milestone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"content" text NOT NULL,
	"source_ref" text,
	"embedding" vector(768),
	"status" text DEFAULT 'active' NOT NULL,
	"superseded_by" uuid,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "folder" text DEFAULT 'inbox' NOT NULL;--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "category" text DEFAULT 'primary' NOT NULL;--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "attachments" jsonb;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "importance" real DEFAULT 0.5 NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "estimated_minutes" real;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_session_id_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_actions" ADD CONSTRAINT "pending_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_actions" ADD CONSTRAINT "pending_actions_session_id_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_token_usage" ADD CONSTRAINT "ai_token_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_digests" ADD CONSTRAINT "daily_digests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_ai_metadata" ADD CONSTRAINT "email_ai_metadata_email_id_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."emails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_ai_metadata" ADD CONSTRAINT "email_ai_metadata_thread_id_email_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."email_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ai_preferences" ADD CONSTRAINT "user_ai_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_messages_session_idx" ON "agent_messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_messages_span_idx" ON "agent_messages" USING btree ("span_id");--> statement-breakpoint
CREATE INDEX "agent_messages_latency_idx" ON "agent_messages" USING btree ("latency_ms");--> statement-breakpoint
CREATE INDEX "agent_sessions_user_idx" ON "agent_sessions" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "pending_actions_user_status_idx" ON "pending_actions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "ai_token_usage_user_idx" ON "ai_token_usage" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_token_usage_operation_idx" ON "ai_token_usage" USING btree ("operation");--> statement-breakpoint
CREATE INDEX "daily_digests_user_idx" ON "daily_digests" USING btree ("user_id","digest_date");--> statement-breakpoint
CREATE UNIQUE INDEX "email_ai_metadata_email_idx" ON "email_ai_metadata" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "email_ai_metadata_thread_idx" ON "email_ai_metadata" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "email_ai_metadata_priority_idx" ON "email_ai_metadata" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "email_ai_metadata_category_idx" ON "email_ai_metadata" USING btree ("category");--> statement-breakpoint
CREATE INDEX "projects_user_idx" ON "projects" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "memories_user_status_type_idx" ON "memories" USING btree ("user_id","status","type");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_project_idx" ON "tasks" USING btree ("project_id");