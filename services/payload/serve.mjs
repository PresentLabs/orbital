import { spawn } from "node:child_process";
for (const file of [".env.local", ".env"])
  try {
    process.loadEnvFile(file);
  } catch {}
const dev = process.argv.includes("--dev");
let stopping = false,
  retention;
const web = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    dev ? "dev" : "start",
    "-p",
    process.env.PORT || "3001",
    "-H",
    process.env.HOST || "127.0.0.1",
  ],
  { stdio: "inherit", env: process.env },
);
function startRetention() {
  if (stopping) return;
  retention = spawn(
    process.execPath,
    ["--experimental-strip-types", "retention.mjs"],
    { stdio: "inherit", env: process.env },
  );
  retention.on("exit", () => {
    if (!stopping) {
      console.error("La revisión de papelera se reiniciará en 5 segundos.");
      setTimeout(startRetention, 5000);
    }
  });
}
startRetention();
function stop() {
  stopping = true;
  web.kill("SIGTERM");
  retention?.kill("SIGTERM");
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
web.on("exit", (code) => {
  stopping = true;
  retention?.kill();
  process.exit(code || 0);
});
