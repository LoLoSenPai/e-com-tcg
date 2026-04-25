import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCheapestShippingQuote,
  getShippingQuotes,
} from "../src/lib/shipping";

describe("shipping helpers", () => {
  it("uses relay price before and after the free threshold", () => {
    assert.equal(getShippingQuotes("relay", { subtotal: 7800 })[0].amount, 390);
    assert.equal(getShippingQuotes("relay", { subtotal: 7900 })[0].amount, 0);
  });

  it("keeps home express paid while standard becomes free", () => {
    const quotes = getShippingQuotes("home", { subtotal: 11900 });
    assert.equal(quotes.find((quote) => quote.code === "home_standard")?.amount, 0);
    assert.equal(quotes.find((quote) => quote.code === "home_express")?.amount, 990);
    assert.equal(
      getCheapestShippingQuote("home", { subtotal: 11900 }).code,
      "home_standard",
    );
  });
});
