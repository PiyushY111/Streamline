import { graphRAGService } from '../../../memory/graph-rag.service.js';
import { logger } from '../../../../../utils/logger.js';

export interface DossierOutput {
  query: string;
  keyEntities: Array<{ name: string; type: string }>;
  verifiedFacts: string[];
  executiveBrief: string;
}

export class DossierResearchAgent {
  public async execute(userId: string, instruction: string): Promise<DossierOutput> {
    logger.info({ userId, instruction }, 'Dossier Research Agent executing via GraphRAG...');

    const graphResult = await graphRAGService.queryGraphRAG(userId, instruction);

    const keyEntities = graphResult.anchorEntities.concat(graphResult.traversedNodes).slice(0, 5).map((n) => ({
      name: n.name,
      type: n.type,
    }));

    const verifiedFacts = graphResult.rerankedContext.map((c) => c.text).slice(0, 4);

    const executiveBrief = verifiedFacts.length > 0
      ? `Graph-verified context:\n${verifiedFacts.join('\n')}`
      : 'No prior relationship records or notes found in knowledge graph for this topic.';

    return {
      query: instruction,
      keyEntities,
      verifiedFacts,
      executiveBrief,
    };
  }
}

export const dossierResearchAgent = new DossierResearchAgent();
