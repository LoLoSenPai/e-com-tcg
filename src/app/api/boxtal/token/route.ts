import { NextResponse } from "next/server";

export const runtime = "nodejs";

type BoxtalTokenResponse = {
  accessToken?: string;
  access_token?: string;
  token?: string;
  tokenType?: string;
  expiresIn?: number;
  expires_in?: number;
};

let tokenCache: { token: string; expiresAt: number } | null = null;

function getCachedToken() {
  if (!tokenCache) return null;
  if (Date.now() >= tokenCache.expiresAt) {
    tokenCache = null;
    return null;
  }
  return tokenCache.token;
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

export async function GET() {
  const cached = getCachedToken();
  if (cached) {
    return NextResponse.json({ accessToken: cached, cached: true });
  }

  const accessKey =
    process.env.BOXTAL_MAP_ACCESS_KEY || process.env.BOXTAL_ACCESS_KEY;
  const secretKey =
    process.env.BOXTAL_MAP_SECRET_KEY || process.env.BOXTAL_SECRET_KEY;
  const tokenUrl =
    process.env.BOXTAL_MAP_TOKEN_URL ||
    process.env.BOXTAL_TOKEN_URL ||
    "https://private-gateway.boxtal.com/iam/account-app/token";

  if (!accessKey || !secretKey) {
    return NextResponse.json(
      {
        error:
          "Missing map credentials (BOXTAL_MAP_ACCESS_KEY/BOXTAL_MAP_SECRET_KEY or BOXTAL_ACCESS_KEY/BOXTAL_SECRET_KEY)",
      },
      { status: 400 },
    );
  }

  try {
    const basic = Buffer.from(`${accessKey}:${secretKey}`).toString("base64");
    const result = await fetchToken(tokenUrl, basic);
    tokenCache = {
      token: result.accessToken,
      expiresAt: Date.now() + Math.max(60, result.expiresIn - 60) * 1000,
    };
    return NextResponse.json({
      accessToken: result.accessToken,
      cached: false,
      attempt: result.attempt,
    });
  } catch (error) {
    let parsed: {
      error?: string;
      status?: number;
      detail?: string;
      attempt?: string;
    } | null = null;
    try {
      parsed = JSON.parse(
        error instanceof Error ? error.message : "{}",
      ) as Record<string, unknown> as {
        error?: string;
        status?: number;
        detail?: string;
        attempt?: string;
      };
    } catch {
      parsed = null;
    }
    return NextResponse.json(
      {
        error: `Boxtal token failed (${parsed?.status || 502})`,
        detail: parsed?.detail || (error instanceof Error ? error.message : "Unknown"),
        attempt: parsed?.attempt,
      },
      { status: 502 },
    );
  }
}
