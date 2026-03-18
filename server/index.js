import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const app = createApp({ repoRoot });

const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${port}`);
});

server.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("Server error:", err);
  process.exitCode = 1;
});

