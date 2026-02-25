import crypto from "crypto";

const iterations = 120_000;
const keylen = 64;
const digest = "sha512";

function pbkdf2Async(password: string, salt: string) {
  return new Promise<string>((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, keylen, digest, (err, derived) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(derived.toString("hex"));
    });
  });
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await pbkdf2Async(password, salt);
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") {
    return false;
  }
  const salt = parts[2];
  const expected = parts[3];
  const actual = await pbkdf2Async(password, salt);
  return safeEqual(actual, expected);
}
