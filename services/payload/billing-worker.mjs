import { tick } from "./src/billing/worker.ts";
import { pool } from "./src/billing/ledger.ts";
let stopped = false;
process.on("SIGTERM", () => {
  stopped = true;
});
process.on("SIGINT", () => {
  stopped = true;
});
do {
  try {
    await tick();
  } catch {
    console.error("Billing worker: cycle failed; inspect fiscal event log.");
  }
  if (process.argv.includes("--once")) break;
  if (!stopped) await new Promise((resolve) => setTimeout(resolve, 60000));
} while (!stopped);
await pool.end();
