type Env = Record<string, string | undefined>;

export type BoxtalMapCredential = {
  source: "map";
  accessKey: string;
  secretKey: string;
  tokenUrl: string;
};

export function getDefaultBoxtalMapTokenUrl(env: Env = process.env) {
  return (
    env.BOXTAL_MAP_TOKEN_URL ||
    env.BOXTAL_TOKEN_URL ||
    "https://private-gateway.boxtal.com/iam/account-app/token"
  );
}

export function getBoxtalMapCredential(
  env: Env = process.env,
): BoxtalMapCredential | null {
  const accessKey = env.BOXTAL_MAP_ACCESS_KEY?.trim();
  const secretKey = env.BOXTAL_MAP_SECRET_KEY?.trim();
  if (!accessKey || !secretKey) {
    return null;
  }

  return {
    source: "map",
    accessKey,
    secretKey,
    tokenUrl: getDefaultBoxtalMapTokenUrl(env),
  };
}
