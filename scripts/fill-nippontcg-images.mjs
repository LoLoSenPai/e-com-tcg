import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const productsJsonPath = path.join(rootDir, "products.json");
const publicImagesDir = path.join(rootDir, "public", "images", "products");
const sitemapUrl = "https://www.nippontcg.fr/1_fr_0_sitemap.xml";
const dryRun = process.argv.includes("--dry-run");

const stopWords = new Set([
  "display",
  "displays",
  "pokemon",
  "japonais",
  "japonaise",
  "scelle",
  "scellee",
  "booster",
  "box",
  "officielle",
  "edition",
  "edtion",
  "tcg",
  "nippon",
  "precommandes",
  "cartes",
  "carte",
  "game",
  "set",
  "pack",
  "promo",
]);

function normalizeText(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/pok-mon|pokmon/g, "pokemon")
    .replace(/dition/g, "edition")
    .replace(/scell\b/g, "scelle")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugToTokens(input) {
  const normalized = normalizeText(input);
  if (!normalized) return [];
  return normalized
    .split(" ")
    .filter(Boolean)
    .filter((token) => !stopWords.has(token));
}

function jaccardScore(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function parseSitemapEntries(xml) {
  const entries = [];
  const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) || [];

  for (const block of urlBlocks) {
    const locMatch =
      block.match(/<loc><!\[CDATA\[([\s\S]*?)\]\]><\/loc>/) ||
      block.match(/<loc>([\s\S]*?)<\/loc>/);
    const imageMatch =
      block.match(/<image:loc><!\[CDATA\[([\s\S]*?)\]\]><\/image:loc>/) ||
      block.match(/<image:loc>([\s\S]*?)<\/image:loc>/);

    const loc = locMatch?.[1]?.trim();
    const image = imageMatch?.[1]?.trim();
    if (!loc || !image) continue;

    const url = new URL(loc);
    const lastSegment = url.pathname.split("/").filter(Boolean).at(-1) || "";

    entries.push({
      url: loc,
      imageUrl: image,
      slug: lastSegment,
      tokens: slugToTokens(lastSegment),
    });
  }

  return entries;
}

function getFileExtensionFromUrl(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith(".png")) return "png";
  if (pathname.endsWith(".webp")) return "webp";
  return "jpg";
}

async function downloadToPublic(imageUrl, targetSlug) {
  const ext = getFileExtensionFromUrl(imageUrl);
  const filename = `${targetSlug}.${ext}`;
  const diskPath = path.join(publicImagesDir, filename);

  if (!dryRun) {
    await fs.mkdir(publicImagesDir, { recursive: true });
    const response = await fetch(imageUrl, {
      headers: { "user-agent": "Mozilla/5.0" },
    });
    if (!response.ok) {
      throw new Error(`Failed image download ${response.status}`);
    }
    const data = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(diskPath, data);
  }

  return `/images/products/${filename}`;
}

function bestMatch(product, entries) {
  const source = `${product.slug || ""} ${product.name || ""}`;
  const productTokens = slugToTokens(source);
  const normalizedSlug = normalizeText(product.slug || "");

  let winner = null;

  for (const entry of entries) {
    let score = jaccardScore(productTokens, entry.tokens);
    const entryNormalizedSlug = normalizeText(entry.slug);

    if (normalizedSlug && normalizedSlug === entryNormalizedSlug) {
      score = 2;
    } else if (
      normalizedSlug &&
      entryNormalizedSlug &&
      (normalizedSlug.includes(entryNormalizedSlug) ||
        entryNormalizedSlug.includes(normalizedSlug))
    ) {
      score = Math.max(score, 1.2);
    }

    if (!winner || score > winner.score) {
      winner = { entry, score };
    }
  }

  if (!winner) return null;
  if (winner.score < 0.34) return null;
  return winner;
}

async function main() {
  const rawProducts = await fs.readFile(productsJsonPath, "utf8");
  const products = JSON.parse(rawProducts);
  if (!Array.isArray(products)) {
    throw new Error("products.json must contain an array.");
  }

  const xml = await (await fetch(sitemapUrl, { headers: { "user-agent": "Mozilla/5.0" } })).text();
  const entries = parseSitemapEntries(xml).filter((entry) => {
    const u = new URL(entry.url);
    return (
      u.hostname === "www.nippontcg.fr" &&
      (u.pathname.includes("display") || u.pathname.includes("booster"))
    );
  });

  const candidates = products.filter(
    (p) =>
      p?.language === "Japonnais" &&
      (!p.image || String(p.image).trim() === ""),
  );

  let matched = 0;
  let updated = 0;
  let downloaded = 0;
  const unmatched = [];

  for (const product of candidates) {
    const match = bestMatch(product, entries);
    if (!match) {
      unmatched.push(product.name || product.slug || "(unknown)");
      continue;
    }

    matched += 1;
    try {
      const localPath = await downloadToPublic(match.entry.imageUrl, product.slug);
      if (product.image !== localPath) {
        product.image = localPath;
        updated += 1;
      }
      downloaded += 1;
    } catch {
      unmatched.push(product.name || product.slug || "(unknown)");
    }
  }

  if (!dryRun) {
    await fs.writeFile(productsJsonPath, JSON.stringify(products, null, 2), "utf8");
  }

  console.log("Nippontcg image fill completed.");
  console.log(`Dry run: ${dryRun ? "yes" : "no"}`);
  console.log(`Sitemap entries scanned: ${entries.length}`);
  console.log(`Products with missing image (Japonnais): ${candidates.length}`);
  console.log(`Matched: ${matched}`);
  console.log(`Images downloaded: ${downloaded}`);
  console.log(`Products updated in JSON: ${updated}`);
  console.log(`Unmatched: ${unmatched.length}`);
  if (unmatched.length > 0) {
    console.log(`Examples unmatched: ${unmatched.slice(0, 10).join(" | ")}`);
  }
}

main().catch((error) => {
  console.error("Script failed:", error.message);
  process.exit(1);
});
