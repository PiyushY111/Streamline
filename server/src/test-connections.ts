import { db } from './db/client.js';
import { users } from './db/schema/index.js';
import Redis from 'ioredis';
import { env } from './config/env.js';

async function testConnections() {
  console.log('Testing Neon PostgreSQL Connection...');
  const startDb = Date.now();
  const userCount = await db.select().from(users);
  const dbLatency = Date.now() - startDb;
  console.log(`✅ Neon PostgreSQL Connected! Rows in users table: ${userCount.length} (${dbLatency}ms latency)`);

  console.log('Testing Upstash Redis Connection...');
  const startRedis = Date.now();
  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2, connectTimeout: 5000 });
  const pong = await redis.ping();
  const redisLatency = Date.now() - startRedis;
  console.log(`✅ Upstash Redis Connected! Response: ${pong} (${redisLatency}ms latency)`);
  await redis.quit();

  console.log('✨ All Phase 1 database & redis infrastructure connections verified successfully!');
  process.exit(0);
}

testConnections().catch((err) => {
  console.error('❌ Connection test error:', err);
  process.exit(1);
});
