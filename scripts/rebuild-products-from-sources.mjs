import fs from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const outputJsonPath = path.join(rootDir, "products.json");
const outputImagesDir = path.join(rootDir, "public", "images", "products");
const dryRun = process.argv.includes("--dry-run");

const pokehubCategoryPages = [
  "https://www.pokehub.fr/categorie-produit/pokemon-coreen/",
  "https://www.pokehub.fr/categorie-produit/pokemon-coreen/page/2/",
  "https://www.pokehub.fr/categorie-produit/pokemon-coreen/page/3/",
];
const nippontcgSitemapUrl = "https://www.nippontcg.fr/1_fr_0_sitemap.xml";

function normalizePokemonWord(value) {
  return String(value || "")
    .replace(/Pok\u00e9mon/g, "Pokemon")
    .replace(/pok\u00e9mon/g, "pokemon")
    .replace(/POK\u00c9MON/g, "POKEMON");
}

function decodeHtmlEntities(input) {
  return String(input || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8211;|&ndash;/g, "\u2013")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&euro;/g, "\u20ac")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function cleanText(input) {
  return normalizePokemonWord(
    decodeHtmlEntities(input).replace(/\s+/g, " ").trim(),
  );
}

function priceToCents(price) {
  if (!price) return 0;
  const text = String(price).replace(",", ".").replace(/[^\d.]/g, "");
  const value = Number.parseFloat(text);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

function extFromUrl(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith(".png")) return "png";
  if (pathname.endsWith(".webp")) return "webp";
  return "jpg";
}

function slugFromUrl(url) {
  return String(new URL(url).pathname.split("/").filter(Boolean).at(-1) || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeProduct({
  name,
  slug,
  language,
  price,
  description,
  image,
}) {
  const unavailable = price <= 0;
  return {
    name: cleanText(name),
    slug,
    category: "Display",
    franchise: "Pokemon",
    language,
    price,
    description: cleanText(description),
    badge: unavailable ? "Indisponible" : "",
    image,
    tags: ["Pokemon"],
    stock: unavailable ? 0 : 10,
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept-language": "fr-FR,fr;q=0.9",
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} for ${url}`);
  }
  return response.text();
}

async function downloadImage(url, slug) {
  const extension = extFromUrl(url);
  const filename = `${slug}.${extension}`;
  const localPath = path.join(outputImagesDir, filename);

  if (!dryRun) {
    await fs.mkdir(outputImagesDir, { recursive: true });
    const response = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0" },
    });
    if (!response.ok) {
      throw new Error(`Image ${response.status} ${url}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(localPath, bytes);
  }

  return `/images/products/${filename}`;
}

async function scrapePokehub() {
  const links = new Set();

  for (const pageUrl of pokehubCategoryPages) {
    const html = await fetchText(pageUrl);
    const found = [
      ...html.matchAll(
        /<a[^>]+href="([^"]+)"[^>]*class="woocommerce-LoopProduct-link[^"]*"/gi,
      ),
    ].map((match) => match[1]);
    for (const url of found) {
      links.add(url);
    }
  }

  const products = [];
  for (const url of [...links]) {
    const html = await fetchText(url);
    const slug = slugFromUrl(url);

    const titleMatch = html.match(
      /<meta\s+property="og:title"\s+content="([^"]+)"/i,
    );
    const descriptionMatch = html.match(
      /<meta\s+property="og:description"\s+content="([^"]+)"/i,
    );
    const imageMatch = html.match(
      /<meta\s+property="og:image"\s+content="([^"]+)"/i,
    );
    const priceMatch = html.match(
      /<meta\s+property="product:price:amount"\s+content="([^"]+)"/i,
    );

    const name = titleMatch?.[1]?.replace(/\s*-\s*PokeHub\s*$/i, "").trim();
    const description = descriptionMatch?.[1] || "";
    const imageUrl = imageMatch?.[1] || "";
    const price = priceToCents(priceMatch?.[1] || "");

    if (!name || !slug || !imageUrl) {
      continue;
    }

    const image = await downloadImage(imageUrl, slug);
    products.push(
      makeProduct({
        name,
        slug,
        language: "Coreen",
        price,
        description,
        image,
      }),
    );
  }

  return products;
}

function parseNippontcgProductUrlsFromSitemap(xml) {
  const locs = [...xml.matchAll(/<loc><!\[CDATA\[([^\]]+)\]\]><\/loc>/g)].map(
    (match) => match[1],
  );
  return locs.filter((url) => /display-pokemon-japonais/.test(url));
}

async function scrapeNippontcg() {
  const sitemapXml = await fetchText(nippontcgSitemapUrl);
  const urls = parseNippontcgProductUrlsFromSitemap(sitemapXml);
  const products = [];

  for (const url of urls) {
    const html = await fetchText(url);
    const slug = slugFromUrl(url);

    const titleMatch =
      html.match(/<h1[^>]*class="h1 page-title"[^>]*>\s*<span>([\s\S]*?)<\/span>/i) ||
      html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
    const descriptionMatch = html.match(
      /<meta\s+property="og:description"\s+content="([^"]+)"/i,
    );
    const imageMatch =
      html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
      html.match(/<meta\s+property="product:image"\s+content="([^"]+)"/i);
    const priceMatch =
      html.match(/<meta\s+property="product:price:amount"\s+content="([^"]+)"/i) ||
      html.match(/class="product-price[^"]*"\s+content="([^"]+)"/i);

    const rawTitle = titleMatch?.[1] || "";
    const name = rawTitle
      .replace(/\s*-\s*Nippon TCG\s*$/i, "")
      .replace(/<[^>]+>/g, "")
      .trim();
    const description = descriptionMatch?.[1] || "";
    const imageUrl = imageMatch?.[1] || "";
    const price = priceToCents(priceMatch?.[1] || "");

    if (!name || !slug || !imageUrl) {
      continue;
    }

    const image = await downloadImage(imageUrl, slug);
    products.push(
      makeProduct({
        name,
        slug,
        language: "Japonnais",
        price,
        description,
        image,
      }),
    );
  }

  return products;
}

async function main() {
  const [pokehubProducts, nippontcgProducts] = await Promise.all([
    scrapePokehub(),
    scrapeNippontcg(),
  ]);

  const bySlug = new Map();
  for (const product of [...pokehubProducts, ...nippontcgProducts]) {
    bySlug.set(product.slug, product);
  }
  const products = [...bySlug.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "fr"),
  );

  if (!dryRun) {
    await fs.writeFile(outputJsonPath, JSON.stringify(products, null, 2), "utf8");
  }

  const byLanguage = products.reduce((acc, product) => {
    acc[product.language] = (acc[product.language] || 0) + 1;
    return acc;
  }, {});

  console.log("Rebuild completed.");
  console.log(`Dry run: ${dryRun ? "yes" : "no"}`);
  console.log(`Products total: ${products.length}`);
  console.log(`Pokehub/Coreen: ${pokehubProducts.length}`);
  console.log(`Nippontcg/Japonnais: ${nippontcgProducts.length}`);
  console.log(`By language: ${JSON.stringify(byLanguage)}`);
  console.log(
    `Images ${dryRun ? "planned" : "written"} in public/images/products.`,
  );
}

main().catch((error) => {
  console.error("Rebuild failed:", error.message);
  process.exit(1);
});
