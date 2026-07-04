import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeProductTags,
  validateAdminProductInput,
} from "../src/lib/product-validation";

const validProduct = {
  name: "Booster Test",
  slug: "booster-test",
  category: "Booster",
  franchise: "Pokemon",
  language: "Francais",
  price: "590",
  description: "Un produit test",
  stock: "0",
  tags: "Pokemon, Test",
};

describe("admin product validation", () => {
  it("normalizes a complete product payload", () => {
    const result = validateAdminProductInput(validProduct);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.product.price, 590);
    assert.equal(result.product.stock, 0);
    assert.deepEqual(result.product.tags, ["Pokemon", "Test"]);
  });

  it("rejects invalid slugs, prices and stocks", () => {
    assert.equal(
      validateAdminProductInput({ ...validProduct, slug: "Booster Test" }).ok,
      false,
    );
    assert.equal(
      validateAdminProductInput({ ...validProduct, price: "12.5" }).ok,
      false,
    );
    assert.equal(
      validateAdminProductInput({ ...validProduct, stock: "-1" }).ok,
      false,
    );
  });

  it("allows partial update payloads", () => {
    const result = validateAdminProductInput(
      { slug: "new-booster-test", stock: "12", tags: [] },
      { partial: true },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(result.product.slug, "new-booster-test");
    assert.equal(result.product.stock, 12);
    assert.deepEqual(result.product.tags, []);
  });

  it("preserves clear intentions for optional update fields", () => {
    const result = validateAdminProductInput(
      { language: "", badge: "", image: "" },
      { partial: true },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.equal(
      Object.prototype.hasOwnProperty.call(result.product, "language"),
      true,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(result.product, "badge"),
      true,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(result.product, "image"),
      true,
    );
    assert.equal(result.product.language, undefined);
    assert.equal(result.product.badge, undefined);
    assert.equal(result.product.image, undefined);
  });

  it("normalizes tags without empty entries", () => {
    assert.deepEqual(normalizeProductTags(" A, , B "), ["A", "B"]);
    assert.deepEqual(normalizeProductTags([" A ", "", "B"]), ["A", "B"]);
    assert.equal(normalizeProductTags(123), null);
  });

  it("accepts only safe product image sources", () => {
    assert.equal(
      validateAdminProductInput({ ...validProduct, image: "/uploads/card.png" }).ok,
      true,
    );
    assert.equal(
      validateAdminProductInput({
        ...validProduct,
        image: "https://blob.vercel-storage.com/card.png",
      }).ok,
      true,
    );
    assert.equal(
      validateAdminProductInput({
        ...validProduct,
        image: "javascript:alert(1)",
      }).ok,
      false,
    );
    assert.equal(
      validateAdminProductInput({
        ...validProduct,
        image: "data:image/svg+xml,<svg onload=alert(1)>",
      }).ok,
      false,
    );
    assert.equal(
      validateAdminProductInput({
        ...validProduct,
        image: "//evil.example/card.png",
      }).ok,
      false,
    );
  });
});
