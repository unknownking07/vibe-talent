import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { stagingOnlyResponse } from "@/lib/staging";
import { nonceKey, nonceMessage, NONCE_TTL_SECONDS } from "@/lib/wallet-link";

// Issues a single-use, time-bounded nonce for wallet-ownership proof. Without
// it a signature captured from one link attempt could be replayed to bind the
// same wallet again later.

export async function GET() {
  const gate = stagingOnlyResponse();
  if (gate) return gate;

  const authClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    // Fail closed: with nowhere to store the nonce we cannot make the
    // signature single-use, and a replayable proof is worse than no feature.
    return NextResponse.json(
      { error: "Wallet linking is unavailable right now." },
      { status: 503 },
    );
  }

  const nonce = crypto.randomUUID();
  const redis = new Redis({ url, token });
  await redis.set(nonceKey(user.id), nonce, { ex: NONCE_TTL_SECONDS });

  return NextResponse.json(
    { message: nonceMessage(nonce), expiresInSeconds: NONCE_TTL_SECONDS },
    { headers: { "Cache-Control": "no-store" } },
  );
}
