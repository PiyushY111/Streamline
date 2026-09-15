import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { getUserGraph, queryGraphRAG } from '../controllers/graph.controller.js';

const router = Router();

router.use(authenticate);

// GET /api/graph — Get knowledge graph nodes and edges
router.get('/', getUserGraph);

// POST /api/graph/query — Execute multi-hop GraphRAG search with cross-encoder re-ranking
router.post('/query', queryGraphRAG);

export default router;
