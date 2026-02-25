import crypto from "crypto";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";

type PasswordResetDoc = {
  _id?: ObjectId;
  customerId: string;
  email: string;
  tokenHash: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
};

const collectionName = "password_resets";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken({
  customerId,
  email,
}: {
  customerId: string;
  email: string;
}) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1h
  const db = await getDb();
  await db.collection<PasswordResetDoc>(collectionName).insertOne({
    customerId,
    email: email.toLowerCase(),
    tokenHash: hashToken(token),
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  });
  return token;
}

export async function consumePasswordResetToken({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const db = await getDb();
  const nowIso = new Date().toISOString();
  const result = await db.collection<PasswordResetDoc>(collectionName).findOneAndUpdate(
    {
      email: email.toLowerCase(),
      tokenHash: hashToken(token),
      usedAt: { $exists: false },
      expiresAt: { $gt: nowIso },
    },
    { $set: { usedAt: nowIso } },
    { returnDocument: "after" },
  );
  return result || null;
}
