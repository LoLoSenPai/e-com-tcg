import { NextResponse } from "next/server";

export const runtime = "nodejs";

type BoxtalTokenResponse = {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
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

export async function GET() {
  const cached = getCachedToken();
  if (cached) {
    return NextResponse.json({ accessToken: cached, cached: true });
  }

  const accessKey = process.env.BOXTAL_ACCESS_KEY;
  const secretKey = process.env.BOXTAL_SECRET_KEY;
  const tokenUrl =
    process.env.BOXTAL_TOKEN_URL ||
    "https://private-gateway.boxtal.com/iam/account-app/token";

  if (!accessKey || !secretKey) {
    return NextResponse.json(
      { error: "Missing BOXTAL_ACCESS_KEY/BOXTAL_SECRET_KEY" },
      { status: 400 },
    );
  }

  const basic = Buffer.from(`${accessKey}:${secretKey}`).toString("base64");
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "User-Agent": "returners/1.0",
    },
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    return NextResponse.json(
      {
        error: `Boxtal token failed (${response.status})`,
        detail: text.slice(0, 300) || undefined,
      },
      { status: 502 },
    );
  }

  let payload: BoxtalTokenResponse | null = null;
  try {
    payload = JSON.parse(text) as BoxtalTokenResponse;
  } catch {
    payload = null;
  }

  const accessToken = payload?.accessToken;
  const expiresIn = Number(payload?.expiresIn || 300);

  if (!accessToken) {
    return NextResponse.json(
      { error: "Invalid Boxtal token payload" },
      { status: 502 },
    );
  }

  tokenCache = {
    token: accessToken,
    expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000,
  };

  return NextResponse.json({ accessToken, cached: false });
}
