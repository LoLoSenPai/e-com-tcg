import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getBoxtalServerCredentialSourceOrder } from "../src/lib/boxtal";
import { getBoxtalMapCredential } from "../src/lib/boxtal-map-token";

describe("Boxtal map token credentials", () => {
  it("uses only map credentials for the public relay map token", () => {
    const credential = getBoxtalMapCredential({
      BOXTAL_MAP_ACCESS_KEY: "map-access",
      BOXTAL_MAP_SECRET_KEY: "map-secret",
      BOXTAL_MAP_TOKEN_URL: "https://map-token.example.test",
      BOXTAL_TOKEN_URL: "https://default-token.example.test",
    });

    assert.deepEqual(credential, {
      source: "map",
      accessKey: "map-access",
      secretKey: "map-secret",
      tokenUrl: "https://map-token.example.test",
    });
  });

  it("does not fall back to shipping API credentials", () => {
    const credential = getBoxtalMapCredential({
      BOXTAL_API_ACCESS_KEY: "api-access",
      BOXTAL_API_SECRET_KEY: "api-secret",
      BOXTAL_TOKEN_URL: "https://default-token.example.test",
    } as NodeJS.ProcessEnv);

    assert.equal(credential, null);
  });

  it("keeps map credentials out of server shipping calls", () => {
    const sources = getBoxtalServerCredentialSourceOrder({
      BOXTAL_API_ACCESS_KEY: "api-access",
      BOXTAL_API_SECRET_KEY: "api-secret",
      BOXTAL_MAP_ACCESS_KEY: "map-access",
      BOXTAL_MAP_SECRET_KEY: "map-secret",
    });

    assert.deepEqual(sources, ["api"]);
  });
});
