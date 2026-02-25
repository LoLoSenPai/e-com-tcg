import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/products";
import { categories } from "@/lib/sample-data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const products = await getProducts();

  const staticRoutes = [
    "",
    "/catalog",
    "/categories",
    "/about",
    "/contact",
    "/faq",
  ];

  const staticEntries = staticRoutes.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: path === "" ? 1 : 0.7,
  }));

  const categoryEntries = categories.map((category) => ({
    url: `${base}/categories/${encodeURIComponent(category)}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const productEntries = products.map((product) => ({
    url: `${base}/products/${encodeURIComponent(product.slug)}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [...staticEntries, ...categoryEntries, ...productEntries];
}
