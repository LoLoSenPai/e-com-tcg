import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getProductBySlug,
  getProducts,
  getProductsBySlugs,
  getProductsBySlugsStrict,
  ProductLookupError,
} from "../src/lib/products";

describe("strict product lookup", () => {
  it("fails instead of returning sample products without MongoDB", async () => {
    const previousMongoUri = process.env.MONGODB_URI;
    delete process.env.MONGODB_URI;

    try {
      await assert.rejects(
        () => getProductsBySlugsStrict(["booster-pokemon"]),
        ProductLookupError,
      );
    } finally {
      if (previousMongoUri) {
        process.env.MONGODB_URI = previousMongoUri;
      }
    }
  });

  it("keeps sample products available for local development without MongoDB", async () => {
    const previousMongoUri = process.env.MONGODB_URI;
    const previousNodeEnv = process.env.NODE_ENV;
    delete process.env.MONGODB_URI;
    process.env.NODE_ENV = "development";

    try {
      const products = await getProducts();
      assert.equal(products.length > 0, true);
      assert.equal(await getProductBySlug(products[0].slug), products[0]);
      assert.deepEqual(await getProductsBySlugs([products[0].slug]), [
        products[0],
      ]);
    } finally {
      if (previousMongoUri) {
        process.env.MONGODB_URI = previousMongoUri;
      }
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it("does not expose sample products in production without MongoDB", async () => {
    const previousMongoUri = process.env.MONGODB_URI;
    const previousNodeEnv = process.env.NODE_ENV;
    delete process.env.MONGODB_URI;
    process.env.NODE_ENV = "production";

    try {
      await assert.rejects(() => getProducts(), ProductLookupError);
      await assert.rejects(
        () => getProductBySlug("booster-pokemon"),
        ProductLookupError,
      );
      await assert.rejects(
        () => getProductsBySlugs(["booster-pokemon"]),
        ProductLookupError,
      );
    } finally {
      if (previousMongoUri) {
        process.env.MONGODB_URI = previousMongoUri;
      }
      process.env.NODE_ENV = previousNodeEnv;
    }
  });
});
