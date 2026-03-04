import fs from "node:fs/promises";
import path from "node:path";
import { MongoClient } from "mongodb";

const rootDir = process.cwd();
const jsonPath = path.join(rootDir, "products.json");
const localEnvPath = path.join(rootDir, ".env.local");
const sourceImagesDir = path.join(rootDir, "images", "products");
const publicImagesDir = path.join(rootDir, "public", "images", "products");

const shouldReplace = process.argv.includes("--replace");
const shouldDryRun = process.argv.includes("--dry-run");

function parseEnvFile(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function normalizePokemonSpelling(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/Pok\u00e9mon/g, "Pokemon")
    .replace(/pok\u00e9mon/g, "pokemon")
    .replace(/POK\u00c9MON/g, "POKEMON");
}

function normalizeLanguage(language) {
  if (!language) return undefined;
  const normalized = normalizePokemonSpelling(String(language))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized.includes("franc")) return "Francais";
  if (normalized.includes("japon")) return "Japonnais";
  if (normalized.includes("core") || normalized.includes("kore")) return "Coreen";
  if (normalized.includes("chinois") || normalized.includes("chinese")) return "Chinois";
  return undefined;
}

function normalizeFranchise(franchise, tags) {
  const source =
    `${normalizePokemonSpelling(franchise || "")} ${Array.isArray(tags) ? tags.join(" ") : ""}`.toLowerCase();
  if (source.includes("one piece")) return "One Piece";
  if (source.includes("pokemon")) return "Pokemon";
  if (source.includes("both")) return "Both";
  return "Pokemon";
}

function slugify(input) {
  return normalizePokemonSpelling(String(input || ""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function normalizePrice(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 100 && Number.isInteger(value)) return value;
    return Math.round(value * 100);
  }
  if (typeof value === "string") {
    const clean = value.replace(",", ".").replace(/[^\d.]/g, "");
    const n = Number.parseFloat(clean);
    if (Number.isFinite(n)) {
      if (Number.isInteger(n) && n >= 100) return n;
      return Math.round(n * 100);
    }
  }
  return 0;
}

function sortTags(tags) {
  return [...new Set(tags)].sort((a, b) => a.localeCompare(b, "fr"));
}

function normalizeComparableProduct(doc) {
  return {
    name: String(doc.name || ""),
    slug: String(doc.slug || ""),
    category: String(doc.category || "Display"),
    franchise: doc.franchise || undefined,
    language: doc.language || undefined,
    price: Number(doc.price || 0),
    description: String(doc.description || ""),
    badge: doc.badge || undefined,
    image: doc.image || undefined,
    tags: sortTags(Array.isArray(doc.tags) ? doc.tags.map(String) : []),
    stock: Number.isFinite(Number(doc.stock)) ? Number(doc.stock) : 0,
    featured: Boolean(doc.featured),
  };
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== "object") return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (!deepEqual(keysA, keysB)) return false;
  for (const key of keysA) {
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

async function loadEnv() {
  const file = await fs.readFile(localEnvPath, "utf8");
  const parsed = parseEnvFile(file);
  return {
    MONGODB_URI: process.env.MONGODB_URI || parsed.MONGODB_URI,
    MONGODB_DB: process.env.MONGODB_DB || parsed.MONGODB_DB || "nebula_tcg",
  };
}

async function listImageFiles(dir) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function copyImages() {
  let missingFolder = false;
  try {
    await fs.access(sourceImagesDir);
  } catch {
    missingFolder = true;
  }

  if (missingFolder) {
    return { copied: 0, missingFolder: true, sourceFiles: [] };
  }

  const sourceFiles = await listImageFiles(sourceImagesDir);
  if (shouldDryRun) {
    return { copied: sourceFiles.length, missingFolder: false, sourceFiles };
  }

  await fs.mkdir(publicImagesDir, { recursive: true });
  let copied = 0;
  for (const name of sourceFiles) {
    const src = path.join(sourceImagesDir, name);
    const dst = path.join(publicImagesDir, name);
    await fs.copyFile(src, dst);
    copied += 1;
  }
  return { copied, missingFolder: false, sourceFiles };
}

function normalizeProduct(raw) {
  const name = normalizePokemonSpelling(raw.name || "").trim();
  const category =
    normalizePokemonSpelling(raw.category || "Display").trim() || "Display";
  const slug = slugify(raw.slug || name);
  const language = normalizeLanguage(raw.language);
  const franchise = normalizeFranchise(raw.franchise, raw.tags);
  const description = normalizePokemonSpelling(raw.description || "").trim();
  const baseBadge =
    normalizePokemonSpelling(raw.badge || "").trim() || undefined;
  const baseStock = Number.isFinite(Number(raw.stock))
    ? Math.max(0, Number(raw.stock))
    : 0;
  const price = normalizePrice(raw.price);
  const unavailable = price <= 0;
  const badge = unavailable ? baseBadge || "Indisponible" : baseBadge;
  const stock = unavailable ? 0 : baseStock;

  const tagSet = new Set(
    (Array.isArray(raw.tags) ? raw.tags : [])
      .map((tag) => normalizePokemonSpelling(String(tag)).trim())
      .filter(Boolean),
  );
  if (franchise === "Pokemon" || franchise === "One Piece") {
    tagSet.add(franchise);
  }
  if (language) {
    tagSet.add(language);
  }

  let imagePath;
  if (raw.image) {
    const file = path.basename(String(raw.image));
    imagePath = `/images/products/${file}`;
  }

  return {
    name,
    slug,
    category,
    franchise,
    language,
    price,
    description: description || `${category} ${franchise}`,
    badge,
    image: imagePath,
    tags: sortTags(Array.from(tagSet)),
    stock,
    featured: false,
  };
}

async function main() {
  const env = await loadEnv();
  if (!env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing in .env.local.");
  }

  const raw = await fs.readFile(jsonPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("products.json must contain an array.");
  }

  const { copied, missingFolder, sourceFiles } = await copyImages();
  const products = parsed.map(normalizeProduct).filter((p) => p.slug && p.name);

  const uniqueBySlug = new Map();
  for (const product of products) {
    uniqueBySlug.set(product.slug, product);
  }
  const deduped = Array.from(uniqueBySlug.values());

  const publicFiles = await listImageFiles(publicImagesDir);
  const expectedFiles =
    shouldDryRun && !missingFolder
      ? new Set([...publicFiles, ...sourceFiles])
      : new Set(publicFiles);
  const missingImages = deduped
    .map((p) => path.basename(p.image || ""))
    .filter((name) => name && !expectedFiles.has(name));

  const client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  const db = client.db(env.MONGODB_DB);
  const collection = db.collection("products");

  const slugs = deduped.map((product) => product.slug);
  const existingDocs = await collection
    .find({ slug: { $in: slugs } }, { projection: { _id: 0 } })
    .toArray();
  const existingBySlug = new Map(existingDocs.map((doc) => [doc.slug, doc]));

  let wouldInsert = 0;
  let wouldUpdate = 0;
  let unchanged = 0;
  for (const product of deduped) {
    const existing = existingBySlug.get(product.slug);
    if (!existing) {
      wouldInsert += 1;
      continue;
    }
    const same = deepEqual(
      normalizeComparableProduct(existing),
      normalizeComparableProduct(product),
    );
    if (same) {
      unchanged += 1;
    } else {
      wouldUpdate += 1;
    }
  }

  let wouldDelete = 0;
  if (shouldReplace && deduped.length > 0) {
    wouldDelete = await collection.countDocuments({
      slug: { $nin: slugs },
    });
  }

  let inserted = 0;
  let updated = 0;
  let deleted = 0;

  if (!shouldDryRun) {
    const ops = deduped.map((product) => ({
      updateOne: {
        filter: { slug: product.slug },
        update: { $set: product },
        upsert: true,
      },
    }));

    const result = await collection.bulkWrite(ops, { ordered: false });
    inserted = result.upsertedCount;
    updated = result.modifiedCount;

    if (shouldReplace && deduped.length > 0) {
      const deleteResult = await collection.deleteMany({
        slug: { $nin: slugs },
      });
      deleted = deleteResult.deletedCount || 0;
    }
  }

  await client.close();

  console.log("Import completed.");
  console.log(`Dry run: ${shouldDryRun ? "yes" : "no"}`);
  console.log(`Mode replace: ${shouldReplace ? "yes" : "no"}`);
  console.log(`JSON products read: ${parsed.length}`);
  console.log(`Products upserted set size: ${deduped.length}`);
  console.log(`Would insert: ${wouldInsert}`);
  console.log(`Would update: ${wouldUpdate}`);
  console.log(`Unchanged: ${unchanged}`);
  if (shouldReplace) {
    console.log(`Would delete old products not in JSON: ${wouldDelete}`);
  }
  if (!shouldDryRun) {
    console.log(`Inserted: ${inserted}`);
    console.log(`Updated: ${updated}`);
    if (shouldReplace) {
      console.log(`Deleted: ${deleted}`);
    }
  }
  console.log(
    `Images ${shouldDryRun ? "planned to copy" : "copied"} to public/images/products: ${copied}`,
  );
  if (missingFolder) {
    console.log("Warning: images/products folder not found, image copy skipped.");
  }
  if (missingImages.length > 0) {
    console.log(
      `Warning: ${missingImages.length} products reference missing images.`,
    );
    const sample = missingImages.slice(0, 10);
    console.log(`Examples: ${sample.join(", ")}`);
  }
}

main().catch((error) => {
  console.error("Import failed:", error.message);
  process.exit(1);
});
