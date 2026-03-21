import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

// Singleton Redis client - only created if env vars are present
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

/**
 * Create a rate limiter with the given configuration.
 * Falls back to allowing all requests if Redis is unavailable.
 */
function createRateLimiter(
  prefix: string,
  limit: number,
  window: `${number} s` | `${number} m` | `${number} h` | `${number} d`
): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  return new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: `vibetalent:ratelimit:${prefix}`,
  });
}

/**
 * Extract client IP from request headers.
 */
export function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Check rate limit. Returns { success: true } if allowed, { success: false } if limited.
 * Gracefully allows requests if Redis is unavailable.
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ success: boolean }> {
  if (!limiter) return { success: true };
  try {
    const result = await limiter.limit(identifier);
    return { success: result.success };
  } catch (error) {
    console.error("Rate limit check failed, allowing request:", error);
    return { success: true };
  }
}

// Pre-configured rate limiters
export const messagesLimiter = createRateLimiter("messages", 60, "1 m");
export const reportLimiter = createRateLimiter("report", 10, "1 h");
export const reviewLimiter = createRateLimiter("review", 3, "1 d");
