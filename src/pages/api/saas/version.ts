import type { APIRoute } from "astro";
import { json } from "@/lib/saas/server";

export const GET: APIRoute = () =>
  json({ version: import.meta.env.PUBLIC_ORBITA_BUILD || "" });
