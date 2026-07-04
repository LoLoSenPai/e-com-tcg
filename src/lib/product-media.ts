export function isSafeProductImageSource(value: string) {
  const source = value.trim();
  if (!source) {
    return false;
  }

  if (source.startsWith("/")) {
    return !source.startsWith("//");
  }

  try {
    const url = new URL(source);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeProductImageSource(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const source = value.trim();
  if (!source || !isSafeProductImageSource(source)) {
    return undefined;
  }

  return source;
}

export function getAbsoluteProductImageUrl(
  value: unknown,
  baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
) {
  const source = normalizeProductImageSource(value);
  if (!source) {
    return undefined;
  }

  try {
    return new URL(source, baseUrl).toString();
  } catch {
    return undefined;
  }
}
