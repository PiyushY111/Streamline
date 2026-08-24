import { createDbClient } from './index.js';
import { env } from '../config/env.js';

export const db = createDbClient(env.DATABASE_URL);
