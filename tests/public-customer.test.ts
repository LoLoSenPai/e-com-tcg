import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toPublicCustomerProfile } from "../src/lib/public-customer";
import type { Customer } from "../src/lib/types";

describe("public customer projection", () => {
  it("removes internal ids and password hashes from customer payloads", () => {
    const customer: Customer = {
      _id: "507f1f77bcf86cd799439011",
      email: "client@example.com",
      name: "Client",
      phone: "+33600000000",
      passwordHash: "secret_hash",
      defaultAddress: {
        line1: "1 rue publique",
        postalCode: "75001",
        city: "Paris",
      },
      createdAt: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T10:00:00.000Z",
    };
    const publicCustomer = toPublicCustomerProfile(customer);

    assert.deepEqual(publicCustomer, {
      email: "client@example.com",
      name: "Client",
      phone: "+33600000000",
      defaultAddress: {
        line1: "1 rue publique",
        postalCode: "75001",
        city: "Paris",
      },
    });
    const serialized = JSON.stringify(publicCustomer);
    assert.equal(serialized.includes("507f1f77bcf86cd799439011"), false);
    assert.equal(serialized.includes("secret_hash"), false);
  });
});
