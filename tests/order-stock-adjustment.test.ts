import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasFailedStockAdjustment,
  OrderStockAdjustmentError,
} from "../src/lib/orders";

describe("order stock adjustment helpers", () => {
  it("detects failed stock adjustments", () => {
    assert.equal(
      hasFailedStockAdjustment([
        { slug: "booster", quantity: 1, applied: true },
        { slug: "display", quantity: 1, applied: false },
      ]),
      true,
    );
    assert.equal(
      hasFailedStockAdjustment([
        { slug: "booster", quantity: 1, applied: true },
      ]),
      false,
    );
  });

  it("carries failed adjustment details on stock errors", () => {
    const error = new OrderStockAdjustmentError("Stock failed", [
      { slug: "display", quantity: 1, applied: false },
    ]);

    assert.equal(error.name, "OrderStockAdjustmentError");
    assert.equal(error.adjustments[0].slug, "display");
  });
});
