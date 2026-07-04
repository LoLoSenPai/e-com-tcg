import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { serializeJsonLd } from "../src/lib/json-ld";
import {
  getAbsoluteProductImageUrl,
  normalizeProductImageSource,
} from "../src/lib/product-media";

describe("JSON-LD serialization", () => {
  it("escapes script-breaking characters", () => {
    const serialized = serializeJsonLd({
      description: '</script><script>alert("x")</script>',
    });

    assert.equal(serialized.includes("</script>"), false);
    assert.equal(serialized.includes("\\u003c/script\\u003e"), true);
  });
});

describe("product media helpers", () => {
  it("normalizes safe product image sources only", () => {
    assert.equal(normalizeProductImageSource("/images/demo.svg"), "/images/demo.svg");
    assert.equal(
      normalizeProductImageSource("https://blob.vercel-storage.com/card.png"),
      "https://blob.vercel-storage.com/card.png",
    );
    assert.equal(normalizeProductImageSource("//evil.example/card.png"), undefined);
    assert.equal(normalizeProductImageSource("javascript:alert(1)"), undefined);
  });

  it("builds absolute image URLs without throwing on unsafe values", () => {
    assert.equal(
      getAbsoluteProductImageUrl("/images/demo.svg", "https://returners.example"),
      "https://returners.example/images/demo.svg",
    );
    assert.equal(
      getAbsoluteProductImageUrl("javascript:alert(1)", "https://returners.example"),
      undefined,
    );
  });
});
