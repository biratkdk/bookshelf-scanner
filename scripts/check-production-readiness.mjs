import { stat, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const checks = [
  {
    label: "global CSS budget",
    file: "packages/frontend/src/styles/global.css",
    maxBytes: 140 * 1024,
  },
  {
    label: "demo shelf image budget",
    file: "packages/frontend/public/fairy/bookshelf-demo.jpg",
    maxBytes: 2 * 1024 * 1024,
  },
];
const requiredFiles = [
  "api/index.js",
  "vercel.json",
  ".vercelignore",
  ".env.example",
  "packages/frontend/public/demo/goodreads-sample.csv"
];

const failures = [];
for (const file of requiredFiles) {
  try {
    await stat(path.join(root, file));
  } catch {
    failures.push(`required deployment file missing: ${file}`);
  }
}

for (const check of checks) {
  const fullPath = path.join(root, check.file);
  const info = await stat(fullPath);
  if (info.size > check.maxBytes) {
    failures.push(`${check.label}: ${check.file} is ${info.size} bytes, max ${check.maxBytes}`);
  }
}

const distPath = path.join(root, "packages/frontend/dist");
try {
  const distEntries = await readdir(distPath);
  if (!distEntries.includes("index.html")) {
    failures.push("frontend build output missing index.html");
  }
} catch {
  failures.push("frontend build output missing; run npm run build first");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Production readiness checks passed.");
