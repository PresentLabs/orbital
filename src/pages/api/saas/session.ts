import type { APIRoute } from "astro";
import { configured, currentUser, json } from "@/lib/saas/server";
export const GET: APIRoute = async (ctx) =>
  json({ configured: configured(ctx), user: await currentUser(ctx) });
