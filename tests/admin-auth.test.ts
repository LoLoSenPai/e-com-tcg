import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyAdminToken } from "../src/lib/admin-auth";

describe("admin auth helpers", () => {
  it("verifies admin tokens after trimming input and configured secret", () => {
    assert.equal(verifyAdminToken(" secret-token ", "secret-token"), true);
    assert.equal(verifyAdminToken("secret-token", " secret-token "), true);
  });

  it("rejects missing, non-string and incorrect admin tokens", () => {
    assert.equal(verifyAdminToken("", "secret-token"), false);
    assert.equal(verifyAdminToken(undefined, "secret-token"), false);
    assert.equal(verifyAdminToken("other-token", "secret-token"), false);
    assert.equal(verifyAdminToken("secret-token", ""), false);
  });
});
