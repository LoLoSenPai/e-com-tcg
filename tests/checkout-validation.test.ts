import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCheckoutBaseUrl,
  getProductionSiteUrlProblem,
  maxCheckoutItems,
  normalizeCheckoutItems,
} from "../src/lib/checkout-validation";

describe("checkout validation", () => {
  it("aggregates duplicate slugs before stock validation", () => {
    assert.deepEqual(
      normalizeCheckoutItems([
        { slug: " booster-pokemon ", quantity: 1 },
        { slug: "booster-pokemon", quantity: 2.8 },
        { slug: "display-one-piece", quantity: "3" },
        { slug: "", quantity: 10 },
        { slug: "ignored", quantity: 0 },
      ]),
      [
        { slug: "booster-pokemon", quantity: 3 },
        { slug: "display-one-piece", quantity: 3 },
      ],
    );
  });

  it("uses the configured site URL for Stripe redirects in production", () => {
    assert.equal(
      getCheckoutBaseUrl({
        configuredSiteUrl: "https://returners.example/path",
        requestOrigin: "https://malicious.example",
        requestUrl: "https://e-com-tcg.vercel.app/api/checkout",
        isProduction: true,
      }),
      "https://returners.example",
    );
  });

  it("does not silently truncate carts above the product limit", () => {
    const items = Array.from({ length: maxCheckoutItems + 1 }, (_, index) => ({
      slug: `product-${index}`,
      quantity: 1,
    }));

    assert.equal(normalizeCheckoutItems(items).length, maxCheckoutItems + 1);
  });

  it("does not trust request origin for production Stripe redirects", () => {
    assert.equal(
      getCheckoutBaseUrl({
        configuredSiteUrl: "",
        requestOrigin: "https://malicious.example",
        requestUrl: "https://e-com-tcg.vercel.app/api/checkout",
        isProduction: true,
      }),
      "",
    );
  });

  it("requires a public HTTPS site URL for production Stripe redirects", () => {
    assert.equal(getProductionSiteUrlProblem("https://returners.example"), null);
    assert.equal(
      getCheckoutBaseUrl({
        configuredSiteUrl: "https://returners.example/path",
        requestOrigin: "https://malicious.example",
        requestUrl: "https://e-com-tcg.vercel.app/api/checkout",
        isProduction: true,
      }),
      "https://returners.example",
    );
    assert.equal(
      getProductionSiteUrlProblem("http://localhost:3000"),
      "Production URL must use https",
    );
    assert.equal(
      getCheckoutBaseUrl({
        configuredSiteUrl: "http://localhost:3000",
        requestOrigin: "https://e-com-tcg.vercel.app",
        requestUrl: "https://e-com-tcg.vercel.app/api/checkout",
        isProduction: true,
      }),
      "",
    );
    assert.equal(
      getProductionSiteUrlProblem("https://localhost:3000"),
      "Production URL must be public, not localhost",
    );
  });

  it("uses the request origin first in development", () => {
    assert.equal(
      getCheckoutBaseUrl({
        configuredSiteUrl: "http://localhost:3000",
        requestOrigin: "http://localhost:3001",
        requestUrl: "http://localhost:3001/api/checkout",
        isProduction: false,
      }),
      "http://localhost:3001",
    );
  });
});
