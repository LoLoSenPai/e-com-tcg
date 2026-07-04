import type { Product } from "@/lib/types";
import { isSafeProductImageSource } from "@/lib/product-media";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const validFranchises = new Set(["Pokemon", "One Piece", "Both"]);

type ValidationSuccess = {
  ok: true;
  product: Partial<Product>;
};

type ValidationFailure = {
  ok: false;
  error: string;
};

type ValidationOptions = {
  partial?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function hasOwnInputField(input: Record<string, unknown>, field: string) {
  return Object.prototype.hasOwnProperty.call(input, field);
}

function parsePositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegativeInteger(value: unknown) {
  if (!hasValue(value)) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function normalizeProductTags(value: unknown) {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value
      .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
      .filter(Boolean);
  }

  if (value === undefined || value === null) {
    return undefined;
  }

  return null;
}

export function validateAdminProductInput(
  input: unknown,
  options: ValidationOptions = {},
): ValidationSuccess | ValidationFailure {
  if (!isRecord(input)) {
    return { ok: false, error: "Invalid payload" };
  }

  const partial = Boolean(options.partial);
  const product: Partial<Product> = {};

  const requiredStringFields: Array<keyof Pick<Product, "name" | "slug" | "category" | "description">> = [
    "name",
    "slug",
    "category",
    "description",
  ];

  for (const field of requiredStringFields) {
    const value = readString(input[field]);
    if (!value && !partial) {
      return { ok: false, error: `Missing ${field}` };
    }
    if (value) {
      product[field] = value;
    }
  }

  if (product.slug && !slugPattern.test(product.slug)) {
    return {
      ok: false,
      error: "Slug must use lowercase letters, numbers and hyphens only",
    };
  }

  if (hasValue(input.price) || !partial) {
    const price = parsePositiveInteger(input.price);
    if (price === null) {
      return { ok: false, error: "Price must be a positive integer in cents" };
    }
    product.price = price;
  }

  const stock = parseNonNegativeInteger(input.stock);
  if (stock === null) {
    return { ok: false, error: "Stock must be a non-negative integer" };
  }
  if (stock !== undefined) {
    product.stock = stock;
  }

  const franchise = readString(input.franchise);
  if (franchise) {
    if (!validFranchises.has(franchise)) {
      return { ok: false, error: "Invalid franchise" };
    }
    product.franchise = franchise as Product["franchise"];
  }

  const language = readString(input.language);
  if (language) {
    product.language = language as Product["language"];
  } else if (partial && hasOwnInputField(input, "language")) {
    product.language = undefined;
  }

  const badge = readString(input.badge);
  if (badge) {
    product.badge = badge;
  } else if (partial && hasOwnInputField(input, "badge")) {
    product.badge = undefined;
  }

  const image = readString(input.image);
  if (image) {
    if (!isSafeProductImageSource(image)) {
      return { ok: false, error: "Image must be a relative path or HTTPS URL" };
    }
    product.image = image;
  } else if (partial && hasOwnInputField(input, "image")) {
    product.image = undefined;
  }

  const tags = normalizeProductTags(input.tags);
  if (tags === null) {
    return { ok: false, error: "Invalid tags" };
  }
  if (tags !== undefined) {
    product.tags = tags;
  }

  return { ok: true, product };
}
