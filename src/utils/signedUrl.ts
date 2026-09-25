import crypto from "crypto";

const SECRET = process.env.FILE_SIGNING_SECRET || process.env.JWT_SECRET || "dev_secret";
const DEFAULT_TTL_SECONDS = 20 * 60; // 20 minutes — enough to load a large PDF

const hash = (canonicalPath: string, exp: number): string =>
  crypto.createHmac("sha256", SECRET).update(`${canonicalPath}:${exp}`).digest("hex");

// Appends a short-lived signature to a static asset path (e.g. "/uploads/pyq/x.pdf")
// so it can be handed to an entitled student without ever exposing a permanent,
// guessable public URL to paid content.
export const signPath = (canonicalPath: string, ttlSeconds = DEFAULT_TTL_SECONDS): string => {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${canonicalPath}?exp=${exp}&sig=${hash(canonicalPath, exp)}`;
};

export const verifySignedPath = (
  canonicalPath: string,
  exp: string | undefined,
  sig: string | undefined
): boolean => {
  if (!exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Math.floor(Date.now() / 1000)) return false;
  const expected = hash(canonicalPath, expNum);
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(sig);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
};
