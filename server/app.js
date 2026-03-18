import express from "express";
import helmet from "helmet";
import path from "node:path";
import { createScenariosRouter } from "./scenarios/router.js";

export function createApp({ repoRoot }) {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", true);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "same-site" },
      contentSecurityPolicy: false
    })
  );

  app.use(express.json({ limit: "256kb" }));

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use("/api/scenarios", createScenariosRouter({ repoRoot }));

  app.use(express.static(repoRoot, { extensions: ["html"] }));

  app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = Number(err?.status) || 500;
    const safeMessage =
      status >= 500 ? "Internal server error" : String(err?.message || "Request failed");
    res.status(status).json({ error: safeMessage });
  });

  return app;
}

