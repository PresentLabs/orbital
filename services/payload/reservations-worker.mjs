import { expireDuePaymentHolds } from "./src/reservations/holds.ts";
import { reservationPool } from "./src/reservations/store.ts";
let stopped = false;
let wake;
function stop() { stopped = true; wake?.(); }
process.on("SIGTERM",stop);
process.on("SIGINT",stop);
do {
  try { await expireDuePaymentHolds(); }
  catch { if(process.argv.includes("--once")) process.exitCode=1;console.error("Agendamiento: no se pudo completar el ciclo de vencimientos; se reintentará."); }
  if (process.argv.includes("--once")) break;
  if (!stopped) await new Promise(resolve=>{ const timer=setTimeout(()=>{wake=undefined;resolve();},30000);wake=()=>{clearTimeout(timer);wake=undefined;resolve();}; });
} while (!stopped);
await reservationPool.end();
