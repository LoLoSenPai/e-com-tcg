import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCustomerUpdateDocument,
  getCustomerById,
  normalizeCustomerEmail,
  updateCustomerById,
} from "../src/lib/customers";

describe("customer helpers", () => {
  it("normalizes customer emails consistently", () => {
    assert.equal(
      normalizeCustomerEmail("  CLIENT+Demo@Example.COM "),
      "client+demo@example.com",
    );
  });

  it("rejects invalid customer ids before querying MongoDB", async () => {
    assert.equal(await getCustomerById("not-an-object-id"), null);
    assert.equal(
      await updateCustomerById("not-an-object-id", {
        name: "Client",
      }),
      null,
    );
  });

  it("builds clean MongoDB update documents for customer profile edits", () => {
    assert.deepEqual(
      buildCustomerUpdateDocument({
        email: "  CLIENT@Example.COM ",
        name: "Client",
        phone: undefined,
        defaultAddress: undefined,
      }),
      {
        $set: {
          email: "client@example.com",
          name: "Client",
        },
        $unset: {
          phone: "",
          defaultAddress: "",
        },
      },
    );
    assert.deepEqual(buildCustomerUpdateDocument({}), {});
  });
});
