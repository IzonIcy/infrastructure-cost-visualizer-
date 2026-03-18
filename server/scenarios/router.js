import express from "express";
import { z } from "zod";
import { ScenarioPatchSchema, ScenarioSchema } from "./schema.js";
import { createScenarioStore } from "./store.js";

const IdSchema = z.string().uuid();

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function notFound() {
  const err = new Error("Scenario not found");
  err.status = 404;
  return err;
}

export function createScenariosRouter({ repoRoot }) {
  const router = express.Router();
  const store = createScenarioStore({ repoRoot });

  router.get("/", async (_req, res, next) => {
    try {
      const items = await store.list();
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const parsed = ScenarioSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message || "Invalid payload");
      const created = await store.create(parsed.data);
      res.status(201).json({ item: created });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const idParsed = IdSchema.safeParse(req.params.id);
      if (!idParsed.success) throw badRequest("Invalid scenario id");
      const item = await store.get(idParsed.data);
      if (!item) throw notFound();
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", async (req, res, next) => {
    try {
      const idParsed = IdSchema.safeParse(req.params.id);
      if (!idParsed.success) throw badRequest("Invalid scenario id");
      const patchParsed = ScenarioPatchSchema.safeParse(req.body);
      if (!patchParsed.success)
        throw badRequest(patchParsed.error.issues[0]?.message || "Invalid patch payload");
      const updated = await store.update(idParsed.data, patchParsed.data);
      if (!updated) throw notFound();
      res.json({ item: updated });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      const idParsed = IdSchema.safeParse(req.params.id);
      if (!idParsed.success) throw badRequest("Invalid scenario id");
      const ok = await store.remove(idParsed.data);
      if (!ok) throw notFound();
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

