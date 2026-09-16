import { pgTable, uuid, text, timestamp, jsonb, real, index, vector } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const entities = pgTable(
  'entities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(), // 'person' | 'company' | 'project' | 'topic' | 'decision'
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    embedding: vector('embedding', { dimensions: 768 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('entities_user_idx').on(table.userId),
    userTypeIdx: index('entities_user_type_idx').on(table.userId, table.type),
    nameIdx: index('entities_name_idx').on(table.name),
  }),
);

export const entityRelations = pgTable(
  'entity_relations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    fromEntityId: uuid('from_entity_id')
      .references(() => entities.id, { onDelete: 'cascade' })
      .notNull(),
    toEntityId: uuid('to_entity_id')
      .references(() => entities.id, { onDelete: 'cascade' })
      .notNull(),
    relationType: text('relation_type').notNull(), // 'works_at' | 'owns_project' | 'discussed' | 'committed_to' | 'reports_to' | 'blocked_by'
    weight: real('weight').default(1.0).notNull(),
    sourceRef: text('source_ref'), // 'email:<uuid>' | 'thread:<uuid>' | 'meeting:<uuid>' | 'manual'
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userHopsIdx: index('entity_relations_hops_idx').on(table.userId, table.fromEntityId, table.toEntityId),
    relationTypeIdx: index('entity_relations_type_idx').on(table.relationType),
  }),
);
