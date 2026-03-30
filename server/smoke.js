import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const app = createApp({ repoRoot });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const server = app.listen(0);
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

try {
  const home = await fetch(`${base}/`);
  assert(home.ok, "home page failed");
  const html = await home.text();
  assert(html.includes("Cloud Spend Planning Desk"), "home page returned unexpected HTML");

  const health = await fetch(`${base}/api/health`);
  assert(health.ok, "health endpoint failed");
  const healthJson = await health.json();
  assert(healthJson.ok === true, "health response missing ok:true");

  const serverSource = await fetch(`${base}/server/app.js`);
  assert(serverSource.status === 404, "server source should not be public");

  const dataFile = await fetch(`${base}/data/scenarios.json`);
  assert(dataFile.status === 404, "data file should not be public");

  const packageFile = await fetch(`${base}/package.json`);
  assert(packageFile.status === 404, "package.json should not be public");

  const payload = {
    name: "Smoke Test Scenario",
    currency: "USD",
    growthRate: 4,
    monthlyBudget: 1234,
    rows: [
      {
        service: "Compute Node",
        category: "Compute",
        model: "on-demand",
        qty: 1,
        units: 730,
        price: 0.12,
        discount: 0
      }
    ]
  };

  const createdRes = await fetch(`${base}/api/scenarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  assert(createdRes.status === 201, "create scenario failed");
  const created = await createdRes.json();
  assert(created?.item?.id, "create response missing item.id");

  const listRes = await fetch(`${base}/api/scenarios`);
  assert(listRes.ok, "list scenarios failed");
  const list = await listRes.json();
  assert(Array.isArray(list?.items), "list response missing items[]");

  const id = created.item.id;
  const getRes = await fetch(`${base}/api/scenarios/${id}`);
  assert(getRes.ok, "get scenario failed");
  const got = await getRes.json();
  assert(got?.item?.name === payload.name, "get scenario returned wrong data");

  const patchRes = await fetch(`${base}/api/scenarios/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ monthlyBudget: 9999 })
  });
  assert(patchRes.ok, "patch scenario failed");
  const patched = await patchRes.json();
  assert(patched?.item?.monthlyBudget === 9999, "patch did not apply");

  const delRes = await fetch(`${base}/api/scenarios/${id}`, { method: "DELETE" });
  assert(delRes.status === 204, "delete scenario failed");

  // eslint-disable-next-line no-console
  console.log("Smoke test passed");
} finally {
  server.close();
}
