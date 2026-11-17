import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ModuleError } from "../modules/security.ts";
export async function engine(input: Record<string, unknown>): Promise<any> {
  const file =
    process.env.BILLING_ENGINE_PATH ||
    fileURLToPath(
      new URL("../../../../modules/billing-cl/engine.php", import.meta.url),
    );
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.PHP_BINARY || "php", [file], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    let text = "",
      done = false;
    const fail = () => {
      if (done) return;
      done = true;
      reject(
        new ModuleError(
          "Motor tributario no disponible o respuesta incierta. Revisa la cola; no repitas con otra clave.",
          503,
        ),
      );
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      fail();
    }, 155000);
    child.stdout.on("data", (b) => {
      text += b;
      if (text.length > 24000000) {
        child.kill("SIGKILL");
        fail();
      }
    });
    child.stderr.resume();
    child.stdin.on("error", () => {});
    child.on("error", () => {
      clearTimeout(timer);
      fail();
    });
    child.on("close", () => {
      clearTimeout(timer);
      if (done) return;
      try {
        const r = JSON.parse(text);
        done = true;
        if (r.ok) resolve(r.result);
        else reject(new ModuleError(r.error, r.retryable ? 503 : 422));
      } catch {
        fail();
      }
    });
    child.stdin.end(JSON.stringify(input));
  });
}
