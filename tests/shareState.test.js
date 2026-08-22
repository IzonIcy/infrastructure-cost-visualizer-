import { describe, expect, it } from "vitest";
import { decodeShareState, encodeShareState } from "../shareState.js";

const SAMPLE_STATE = {
  rows: [
    { service: "API", category: "Compute", model: "on-demand", qty: 2, units: 730, price: 0.1, discount: 0 },
    { service: "DB", category: "Database", model: "reserved", qty: 1, units: 730, price: 0.2, discount: 10 },
  ],
  currency: "USD",
  growthRate: 5,
  scenarioName: "prod baseline",
  monthlyBudget: 500,
};

describe("encodeShareState / decodeShareState", () => {
  it("roundtrips a state object through a hash fragment", () => {
    const hash = encodeShareState(SAMPLE_STATE);
    expect(hash.startsWith("#s=")).toBe(true);
    expect(decodeShareState(hash)).toEqual(SAMPLE_STATE);
  });

  it("produces URL-safe output with no padding or reserved characters", () => {
    const hash = encodeShareState({ rows: [], note: "a+b/c=d" });
    const encoded = hash.slice(3);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeShareState(hash)).toEqual({ rows: [], note: "a+b/c=d" });
  });

  it("returns null for absent, foreign, or corrupt hashes", () => {
    expect(decodeShareState("")).toBeNull();
    expect(decodeShareState(null)).toBeNull();
    expect(decodeShareState("#section-anchor")).toBeNull();
    // Truncated base64 payload must not throw.
    const hash = encodeShareState(SAMPLE_STATE);
    expect(decodeShareState(hash.slice(0, hash.length - 8))).toBeNull();
  });

  it("rejects payloads whose rows are not an array", () => {
    const hash = encodeShareState({ rows: "nope" });
    // Encoder accepts any object; decoder validates structure.
    expect(decodeShareState(hash)).toBeNull();
  });

  it("throws when encoding a non-object", () => {
    expect(() => encodeShareState(null)).toThrow();
    expect(() => encodeShareState("state")).toThrow();
  });
});
