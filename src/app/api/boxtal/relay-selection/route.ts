import { NextRequest, NextResponse } from "next/server";
import { BoxtalApiError, resolveBoxtalRelayPoint } from "@/lib/boxtal";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { signRelayPointSelection } from "@/lib/relay-selection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const limit = checkRateLimit({
    key: `boxtal-relay-selection:${ip}`,
    max: 100,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many relay selection requests" },
      {
        status: 429,
        headers: {
          ...noStoreHeaders,
          "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
        },
      },
    );
  }

  const body = await request.json().catch(() => null);

  let relayPoint;
  try {
    relayPoint = await resolveBoxtalRelayPoint(body?.relayPoint);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Relay point validation failed",
      },
      {
        status: error instanceof BoxtalApiError ? error.status : 502,
        headers: noStoreHeaders,
      },
    );
  }

  const result = signRelayPointSelection(relayPoint);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: 400, headers: noStoreHeaders },
    );
  }

  return NextResponse.json(
    {
      relayPoint: {
        ...result.relayPoint,
        selectionToken: result.token,
      },
    },
    { headers: noStoreHeaders },
  );
}
