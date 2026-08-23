import { describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

// The store module is CommonJS-exported for tests without a DOM.
const { createScenarioStore } = await import("../server/scenarios/store.js");

function makeStore() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scen-"));
  return createScenarioStore({ repoRoot: tmp });
}

describe("scenario store write serialization", () => {
  it("persists concurrent creates without losing any of them", async () => {
    const store = makeStore();

    // Fire 20 concurrent creates. With interleaved read-modify-writes the
    // last writer used to clobber everyone else's item.
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        store.create({ name: `scenario-${i}`, rows: [] })
      ),
    );

    const items = await store.list();
    expect(items).toHaveLength(20);
    const names = new Set(items.map((item) => item.name));
    expect(names.size).toBe(20);
  });

  it("keeps the write queue alive after a failing mutation", async () => {
    const store = makeStore();

    await expect(store.update("missing-id", { name: "x" })).resolves.toBeNull();
    const item = await store.create({ name: "after-failure", rows: [] });
    expect(item.name).toBe("after-failure");
  });
});
