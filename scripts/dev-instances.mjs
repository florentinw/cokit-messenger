#!/usr/bin/env node
/**
 * Start Tauri instance A (Vite + window), wait for Vite, then start B (and optionally C).
 * Usage: node scripts/dev-instances.mjs [b|c]
 *   (default: A + B)
 */
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const extra = process.argv[2]; // undefined | "c"
const children = [];

function run(script) {
  const child = spawn("pnpm", ["run", script], {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(130));

async function waitForVite(url = "http://localhost:1420", attempts = 400) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // not up yet
    }
    await delay(300);
  }
  throw new Error(`Timed out waiting for Vite on ${url}`);
}

const a = run("tauri:dev:a");
a.on("exit", (code) => {
  if (code !== null && code !== 0) shutdown(code);
});

try {
  await waitForVite();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  shutdown(1);
}

await delay(1000);
run("tauri:dev:b");

if (extra === "c") {
  await delay(500);
  run("tauri:dev:c");
}

await Promise.all(
  children.map(
    (child) =>
      new Promise((resolve) => {
        child.on("exit", resolve);
      }),
  ),
);
