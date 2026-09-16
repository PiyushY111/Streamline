import { Router, Request, Response } from 'express';
import { getPrometheusMetrics } from '../utils/metrics.js';

const router = Router();

/**
 * Standard Prometheus Metrics Scrape Endpoint
 * Content-Type: text/plain; version=0.0.4; charset=utf-8
 */
router.get('/', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(getPrometheusMetrics());
});

export default router;
