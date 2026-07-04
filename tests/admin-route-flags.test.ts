import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAdminDebugRouteEnabled,
  isAdminMaintenanceRouteEnabled,
  isFlagEnabled,
} from "../src/lib/admin-route-flags";

describe("admin route flags", () => {
  it("parses boolean env flags conservatively", () => {
    assert.equal(isFlagEnabled("FLAG", { FLAG: "true" }), true);
    assert.equal(isFlagEnabled("FLAG", { FLAG: " TRUE " }), true);
    assert.equal(isFlagEnabled("FLAG", { FLAG: "1" }), false);
    assert.equal(isFlagEnabled("FLAG", { FLAG: "yes" }), false);
    assert.equal(isFlagEnabled("FLAG", {}), false);
  });

  it("keeps maintenance and debug routes enabled outside production", () => {
    assert.equal(
      isAdminMaintenanceRouteEnabled({ NODE_ENV: "development" }),
      true,
    );
    assert.equal(isAdminDebugRouteEnabled({ NODE_ENV: "test" }), true);
  });

  it("requires explicit production flags for maintenance and debug routes", () => {
    assert.equal(
      isAdminMaintenanceRouteEnabled({ NODE_ENV: "production" }),
      false,
    );
    assert.equal(isAdminDebugRouteEnabled({ NODE_ENV: "production" }), false);
    assert.equal(
      isAdminMaintenanceRouteEnabled({
        NODE_ENV: "production",
        ENABLE_ADMIN_MAINTENANCE_ROUTES: "true",
      }),
      true,
    );
    assert.equal(
      isAdminDebugRouteEnabled({
        NODE_ENV: "production",
        ENABLE_ADMIN_DEBUG_ROUTES: "true",
      }),
      true,
    );
  });
});
