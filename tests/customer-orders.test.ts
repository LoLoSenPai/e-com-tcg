import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCustomerOrdersFilter } from "../src/lib/orders";

describe("customer order visibility", () => {
  it("uses the authenticated customer id to list account orders", () => {
    assert.deepEqual(buildCustomerOrdersFilter({ _id: "customer_123" }), {
      customerId: "customer_123",
    });
  });

  it("does not expose orders by unverified email ownership", () => {
    const filter = buildCustomerOrdersFilter({
      _id: "customer_123",
      email: "client@example.com",
    });

    assert.equal(JSON.stringify(filter).includes("customerEmail"), false);
    assert.equal(buildCustomerOrdersFilter({}), null);
    assert.equal(buildCustomerOrdersFilter(null), null);
  });
});
