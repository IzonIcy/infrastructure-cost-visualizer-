import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  return crypto.randomUUID();
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (err) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

async function atomicWriteJson(filePath, data) {
  const dir = path.dirname(filePath);
  await ensureDir(dir);
  const tmp = `${filePath}.${createId()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, filePath);
}

export function createScenarioStore({ repoRoot }) {
  const dataDir = path.join(repoRoot, "data");
  const dbPath = path.join(dataDir, "scenarios.json");

  async function loadDb() {
    const db = await readJson(dbPath);
    if (!db || !Array.isArray(db.items)) return { items: [] };
    return { items: db.items };
  }

  async function saveDb(db) {
    await atomicWriteJson(dbPath, db);
  }

  return {
    async list() {
      const db = await loadDb();
      return db.items
        .map(({ id, name, createdAt, updatedAt }) => ({
          id,
          name,
          createdAt,
          updatedAt
        }))
        .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    },

    async get(id) {
      const db = await loadDb();
      return db.items.find((x) => x.id === id) || null;
    },

    async create(payload) {
      const db = await loadDb();
      const item = {
        id: createId(),
        ...payload,
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      db.items.unshift(item);
      await saveDb(db);
      return item;
    },

    async update(id, patch) {
      const db = await loadDb();
      const idx = db.items.findIndex((x) => x.id === id);
      if (idx === -1) return null;
      const updated = { ...db.items[idx], ...patch, updatedAt: nowIso() };
      db.items.splice(idx, 1);
      db.items.unshift(updated);
      await saveDb(db);
      return updated;
    },

    async remove(id) {
      const db = await loadDb();
      const next = db.items.filter((x) => x.id !== id);
      if (next.length === db.items.length) return false;
      db.items = next;
      await saveDb(db);
      return true;
    }
  };
}
