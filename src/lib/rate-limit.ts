type Entry = {
  count: number;
  resetAt: number;
};

declare global {
  var _rateLimitStore: Map<string, Entry> | undefined;
}

const store = global._rateLimitStore || new Map<string, Entry>();
global._rateLimitStore = store;

export function getClientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return headers.get("x-real-ip") || "unknown";
}

export function checkRateLimit({
  key,
  max,
  windowMs,
}: {
  key: string;
  max: number;
  windowMs: number;
}) {
  const now = Date.now();
  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (current.count >= max) {
    return { allowed: false, retryAfterMs: current.resetAt - now };
  }
  current.count += 1;
  store.set(key, current);
  return { allowed: true, retryAfterMs: 0 };
}
