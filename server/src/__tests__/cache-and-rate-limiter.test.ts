import { describe, it, expect, vi } from 'vitest';
import { getCache, setCache, delCache } from '../services/cache.service.js';
import { redisConnection } from '../queues/index.js';
import { apiRateLimiter } from '../middlewares/rateLimiter.js';

describe('Redis Cache & Rate Limiter Utilities', () => {
  describe('Cache Service', () => {
    it('should retrieve parsed JSON data from cache', async () => {
      const mockData = [{ id: '1', title: 'Test Email' }];
      vi.spyOn(redisConnection, 'get').mockResolvedValue(JSON.stringify(mockData));

      const result = await getCache('test:key');
      expect(result).toEqual(mockData);
    });

    it('should return null on cache miss', async () => {
      vi.spyOn(redisConnection, 'get').mockResolvedValue(null);

      const result = await getCache('missing:key');
      expect(result).toBeNull();
    });

    it('should serialize value with setex without throwing', async () => {
      const setexSpy = vi.spyOn(redisConnection, 'setex').mockResolvedValue('OK' as any);

      await setCache('test:key', { count: 42 }, 60);
      expect(setexSpy).toHaveBeenCalledWith('test:key', 60, JSON.stringify({ count: 42 }));
    });

    it('should delete matching keys on cache invalidation', async () => {
      vi.spyOn(redisConnection, 'keys').mockResolvedValue(['emails:user1:inbox', 'emails:user1:sent']);
      const delSpy = vi.spyOn(redisConnection, 'del').mockResolvedValue(2 as any);

      await delCache('emails:user1:*');
      expect(delSpy).toHaveBeenCalledWith('emails:user1:inbox', 'emails:user1:sent');
    });
  });

  describe('Rate Limiter Middleware', () => {
    it('should export rate limiter middleware function', () => {
      expect(typeof apiRateLimiter).toBe('function');
    });
  });
});
