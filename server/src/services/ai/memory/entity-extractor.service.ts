import { db } from '../../../db/index.js';
import { entities, entityRelations } from '../../../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { getAiProvider } from '../core/factory.js';
import { logger } from '../../../utils/logger.js';
import { toError } from '../../../utils/errors.js';

export interface ExtractedEntity {
  name: string;
  type: 'person' | 'company' | 'project' | 'topic' | 'decision';
  metadata?: Record<string, unknown>;
}

export interface ExtractedRelation {
  from: string;
  to: string;
  relationType: 'works_at' | 'owns_project' | 'discussed' | 'committed_to' | 'reports_to' | 'blocked_by';
  weight?: number;
}

export class EntityExtractorService {
  /**
   * Extract entities and relationships from a passage (email, meeting transcript, or user statement)
   */
  public async extractFromText(
    text: string,
    userId: string,
    sourceRef?: string
  ): Promise<{ entitiesCount: number; relationsCount: number }> {
    if (!text || text.trim().length < 20) {
      return { entitiesCount: 0, relationsCount: 0 };
    }

    const provider = getAiProvider();
    if (!provider || !provider.isAvailable()) {
      logger.warn('AI provider unavailable, skipping entity extraction');
      return { entitiesCount: 0, relationsCount: 0 };
    }

    const prompt = `Extract semantic entities (people, companies, projects, key topics) and the relationships between them from the following text.
Output JSON matching this exact structure:
{
  "entities": [
    { "name": "Name or Title", "type": "person" | "company" | "project" | "topic" | "decision", "metadata": {} }
  ],
  "relations": [
    { "from": "Name", "to": "Name", "relationType": "works_at" | "owns_project" | "discussed" | "committed_to" | "reports_to" | "blocked_by" }
  ]
}

Text to analyze:
"""
${text.slice(0, 3000)}
"""`;

    try {
      const response = await provider.generateStructuredJson<{
        entities: ExtractedEntity[];
        relations: ExtractedRelation[];
      }>({
        prompt,
        models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'],
        temperature: 0.1,
      });

      if (!response || !response.entities || response.entities.length === 0) {
        return { entitiesCount: 0, relationsCount: 0 };
      }

      const entityIdMap = new Map<string, string>();

      // 1. Ingest & Deduplicate Entities
      for (const ent of response.entities) {
        if (!ent.name || ent.name.trim().length < 2) continue;
        const cleanName = ent.name.trim();

        // Check if entity already exists for user (case-insensitive)
        const [existing] = await db
          .select({ id: entities.id })
          .from(entities)
          .where(and(eq(entities.userId, userId), sql`LOWER(${entities.name}) = LOWER(${cleanName})`))
          .limit(1);

        if (existing) {
          entityIdMap.set(cleanName.toLowerCase(), existing.id);
          continue;
        }

        // Generate embedding for entity if possible
        let embeddingLiteral: number[] | null = null;
        try {
          embeddingLiteral = await provider.generateEmbedding(cleanName, { dimensions: 768 });
        } catch {}

        const [created] = await db
          .insert(entities)
          .values({
            userId,
            name: cleanName,
            type: ent.type || 'topic',
            metadata: ent.metadata || {},
            embedding: embeddingLiteral ? sql`${sql.raw(`'[${embeddingLiteral.join(',')}]'`)}::vector` : null,
          })
          .returning({ id: entities.id });

        if (created) {
          entityIdMap.set(cleanName.toLowerCase(), created.id);
        }
      }

      // 2. Ingest Directed Relationships
      let relationsCount = 0;
      if (response.relations && Array.isArray(response.relations)) {
        for (const rel of response.relations) {
          const fromId = entityIdMap.get(rel.from?.toLowerCase().trim());
          const toId = entityIdMap.get(rel.to?.toLowerCase().trim());

          if (!fromId || !toId || fromId === toId) continue;

          // Check if relation already exists; if so, reinforce weight
          const [existingRel] = await db
            .select({ id: entityRelations.id, weight: entityRelations.weight })
            .from(entityRelations)
            .where(
              and(
                eq(entityRelations.userId, userId),
                eq(entityRelations.fromEntityId, fromId),
                eq(entityRelations.toEntityId, toId),
                eq(entityRelations.relationType, rel.relationType)
              )
            )
            .limit(1);

          if (existingRel) {
            await db
              .update(entityRelations)
              .set({
                weight: existingRel.weight + 0.5,
                updatedAt: new Date(),
              })
              .where(eq(entityRelations.id, existingRel.id));
            relationsCount++;
          } else {
            await db.insert(entityRelations).values({
              userId,
              fromEntityId: fromId,
              toEntityId: toId,
              relationType: rel.relationType || 'discussed',
              weight: rel.weight || 1.0,
              sourceRef: sourceRef || 'extractor',
            });
            relationsCount++;
          }
        }
      }

      logger.info(
        { userId, extractedEntities: response.entities.length, storedRelations: relationsCount },
        'Entity and relationship extraction completed'
      );

      return { entitiesCount: entityIdMap.size, relationsCount };
    } catch (err: unknown) {
      const error = toError(err);
      logger.warn({ userId, err: error.message }, 'Failed to extract entities, continuing non-fatally');
      return { entitiesCount: 0, relationsCount: 0 };
    }
  }
}

export const entityExtractorService = new EntityExtractorService();
