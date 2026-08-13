import Redis, { type RedisOptions } from 'ioredis';

export type RedisPair = {
	pub: Redis;
	sub: Redis;
};

let redisPair: RedisPair | null | undefined;
let redisUrl: string | null | undefined;

/**
 * Redis connection for the multiplayer server.
 *
 * Uses `REDIS_URL` (or `UPSTASH_REDIS_URL` / `KV_URL` as fallbacks). The socket.io
 * broadcast adapter needs real Redis Pub/Sub, so Vercel KV alone is not enough —
 * use the Upstash Redis (or Vercel Marketplace) integration, which supports the
 * Redis wire protocol including pub/sub.
 *
 * Returns `null` when no URL is configured so the app still runs locally and on
 * a single instance using the default in-memory adapter.
 */
export function getRedis(): RedisPair | null {
	if (redisPair !== undefined) return redisPair;

	const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || process.env.KV_URL;
	if (!url) {
		redisPair = null;
		redisUrl = null;
		return null;
	}

	const options: RedisOptions = {
		maxRetriesPerRequest: null,
		enableOfflineQueue: false,
		connectTimeout: 10_000
	};

	const pub = new Redis(url, options);
	const sub = pub.duplicate();
	redisPair = { pub, sub };
	redisUrl = url;
	return redisPair;
}

export function getRedisUrl(): string | null {
	return redisUrl ?? null;
}
