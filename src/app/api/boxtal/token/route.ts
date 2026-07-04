import { NextResponse } from "next/server";
import {
  getBoxtalMapCredential,
  type BoxtalMapCredential,
} from "@/lib/boxtal-map-token";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

type BoxtalTokenResponse = {
  accessToken?: string;
  access_token?: string;
  token?: string;
  tokenType?: string;
  expiresIn?: number;
  expires_in?: number;
};

type CredentialSource = BoxtalMapCredential["source"];

let tokenCache:
  | { token: string; expiresAt: number; source: CredentialSource }
  | null = null;

function getCachedToken() {
  if (!tokenCache) return null;
  if (Date.now() >= tokenCache.expiresAt) {
    tokenCache = null;
    return null;
  }
  return tokenCache;
}

function getTokenValue(payload: BoxtalTokenResponse | null) {
  if (!payload) return null;
  const value = payload.accessToken || payload.access_token || payload.token;
  if (!value || typeof value !== "string") return null;
  const token = value.trim();
  return token || null;
}

function getExpiresIn(payload: BoxtalTokenResponse | null) {
  if (!payload) return 300;
  const raw = payload.expiresIn ?? payload.expires_in ?? 300;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 300;
}

function getCredentials(): BoxtalMapCredential[] {
  const credential = getBoxtalMapCredential();
  return credential ? [credential] : [];
}

function exposeDebugDetails() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_BOXTAL_MAP_DEBUG === "1"
  );
}

function tokenErrorPayload(error: string, detail?: unknown) {
  if (!exposeDebugDetails()) {
    return { error };
  }
  return { error, detail };
}

function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders,
  });
}

async function fetchToken(tokenUrl: string, basic: string) {
  const attempts: Array<{
    init: RequestInit;
    label: string;
  }> = [
    {
      label: "basic",
      init: {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "User-Agent": "returners/1.0",
        },
        cache: "no-store",
      },
    },
    {
      label: "oauth-form",
      init: {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "User-Agent": "returners/1.0",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
        cache: "no-store",
      },
    },
  ];

  let lastError:
    | {
        status: number;
        detail: string;
        attempt: string;
      }
    | null = null;

  for (const attempt of attempts) {
    const response = await fetch(tokenUrl, attempt.init);
    const text = await response.text();
    if (!response.ok) {
      lastError = {
        status: response.status,
        detail: text.slice(0, 400),
        attempt: attempt.label,
      };
      continue;
    }
    let payload: BoxtalTokenResponse | null = null;
    try {
      payload = JSON.parse(text) as BoxtalTokenResponse;
    } catch {
      payload = null;
    }
    const accessToken = getTokenValue(payload);
    if (!accessToken) {
      lastError = {
        status: 502,
        detail: `Token payload missing access token (${attempt.label})`,
        attempt: attempt.label,
      };
      continue;
    }
    return {
      accessToken,
      expiresIn: getExpiresIn(payload),
      attempt: attempt.label,
    };
  }

  throw new Error(
    JSON.stringify({
      error: "Boxtal token failed",
      status: lastError?.status || 502,
      detail: lastError?.detail || "No response",
      attempt: lastError?.attempt || "unknown",
    }),
  );
}

export async function GET(request: Request) {
  const ip = getClientIp(request.headers);
  const limit = checkRateLimit({
    key: `boxtal-map-token:${ip}`,
    max: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many Boxtal token requests" },
      {
        status: 429,
        headers: {
          ...noStoreHeaders,
          "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
        },
      },
    );
  }

  const cached = getCachedToken();
  if (cached) {
    return jsonNoStore({
      accessToken: cached.token,
      cached: true,
    });
  }

  const credentials = getCredentials();
  if (credentials.length === 0) {
    return jsonNoStore(
      tokenErrorPayload("Boxtal relay map token unavailable"),
      400,
    );
  }

  let lastError:
    | {
        status?: number;
        detail?: string;
        attempt?: string;
        source?: CredentialSource;
      }
    | null = null;

  try {
    for (const credential of credentials) {
      try {
        const basic = Buffer.from(
          `${credential.accessKey}:${credential.secretKey}`,
        ).toString("base64");
        const result = await fetchToken(credential.tokenUrl, basic);
        tokenCache = {
          token: result.accessToken,
          expiresAt: Date.now() + Math.max(60, result.expiresIn - 60) * 1000,
          source: credential.source,
        };
        return jsonNoStore({
          accessToken: result.accessToken,
          cached: false,
          ...(exposeDebugDetails()
            ? { attempt: result.attempt, source: credential.source }
            : {}),
        });
      } catch (error) {
        let parsed: {
          status?: number;
          detail?: string;
          attempt?: string;
        } | null = null;
        try {
          parsed = JSON.parse(
            error instanceof Error ? error.message : "{}",
          ) as Record<string, unknown> as {
            status?: number;
            detail?: string;
            attempt?: string;
          };
        } catch {
          parsed = null;
        }
        lastError = {
          status: parsed?.status || 502,
          detail: parsed?.detail || (error instanceof Error ? error.message : "Unknown"),
          attempt: parsed?.attempt,
          source: credential.source,
        };
      }
    }

    return jsonNoStore(
      tokenErrorPayload("Boxtal relay map token unavailable", {
        status: lastError?.status || 502,
        detail: lastError?.detail || "Unknown",
        attempt: lastError?.attempt,
        source: lastError?.source,
      }),
      502,
    );
  } catch (error) {
    return jsonNoStore(
      tokenErrorPayload(
        "Boxtal relay map token unavailable",
        error instanceof Error ? error.message : "Unknown",
      ),
      502,
    );
  }
}
