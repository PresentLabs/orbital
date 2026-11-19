import type { APIRoute } from "astro";
import { currentUser, json, payload, sameOrigin } from "@/lib/saas/server";
import { canWrite, sectionForKey } from "@/lib/saas/permissions";
const validKey = (key: unknown) =>
  typeof key === "string" &&
  /^(settings|(?:tasks|boards|nodes|pages|events|spaces|edges|goals|focus):[a-zA-Z0-9 _-]{1,100})$/.test(
    key,
  );
export const GET: APIRoute = async (ctx) => {
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión" }, 401);
  try {
    const [documents,branding]=await Promise.all([payload(ctx,"documents?limit=1000&depth=0&where[deletedAt][exists]=false"),payload(ctx,"branding")]);
    return json({...documents,palette:branding.palette});
  } catch {
    return json({ error: "Servicio no disponible" }, 503);
  }
};
export const PUT: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return json({ error: "Origen inválido" }, 403);
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión" }, 401);
  try {
    if (Number(ctx.request.headers.get("content-length")) > 2200000)
      return json({ error: "Documento demasiado grande" }, 413);
    const { key, value } = await ctx.request.json();
    const section = sectionForKey(key);
    if (!section || !canWrite(user, section))
      return json({ error: "No puedes modificar esta sección." }, 403);
    if (
      !validKey(key) ||
      !value ||
      typeof value !== "object" ||
      JSON.stringify(value).length > 2100000
    )
      return json({ error: "Documento inválido" }, 400);
    const found = await payload(
      ctx,
      "documents?limit=1&depth=0&where[key][equals]=" + encodeURIComponent(key),
    );
    const body = JSON.stringify({
      key,
      value,
      deletedAt: null,
      trashGroup: null,
    });
    if (found.docs[0])
      return json(
        await payload(ctx, "documents/" + found.docs[0].id, {
          method: "PATCH",
          body,
        }),
      );
    return json(await payload(ctx, "documents", { method: "POST", body }));
  } catch {
    return json({ error: "No se pudo guardar" }, 503);
  }
};
export const DELETE: APIRoute = async (ctx) => {
  if (!sameOrigin(ctx)) return json({ error: "Origen inválido" }, 403);
  const user = await currentUser(ctx);
  if (!user) return json({ error: "Inicia sesión." }, 401);
  try {
    const { key } = await ctx.request.json();
    const section = sectionForKey(key);
    if (!section || !canWrite(user, section))
      return json({ error: "No puedes modificar esta sección." }, 403);
    if (!validKey(key)) return json({ error: "Clave inválida" }, 400);
    const found = await payload(
      ctx,
      "documents?limit=1&depth=0&where[key][equals]=" + encodeURIComponent(key),
    );
    if (found.docs[0] && !found.docs[0].deletedAt) {
      if (key.startsWith("nodes:") || key.startsWith("edges:")) {
        await payload(ctx, "discard-canvas-document", {method: "POST", body: JSON.stringify({key})});
        return json({ok: true});
      }
      const date = new Date().toISOString();
      await payload(ctx, "documents/" + found.docs[0].id, {
        method: "PATCH",
        body: JSON.stringify({ deletedAt: date }),
      });
      if (
        key.startsWith("spaces:") ||
        key.startsWith("pages:") ||
        key.startsWith("boards:") ||
        key.startsWith("nodes:")
      ) {
        const docs = (
          await payload(
            ctx,
            "documents?limit=1000&where[deletedAt][exists]=false",
          )
        ).docs;
        const nodes = docs.filter(
          (d: any) =>
            d.key.startsWith("nodes:") &&
            (key.startsWith("spaces:")
              ? d.value.space === key.slice(7)
              : key.startsWith("pages:") && d.value.pageId === key.slice(6)),
        );
        const nodeIds = new Set(nodes.map((d: any) => d.value.id));
        if (key.startsWith("nodes:")) nodeIds.add(key.slice(6));
        const children = [
          ...nodes,
          ...docs.filter(
            (d: any) =>
              key.startsWith("boards:") &&
              d.key.startsWith("tasks:") &&
              (d.value.boardId || "general") === key.slice(7),
          ),
          ...docs.filter(
            (d: any) =>
              d.key.startsWith("edges:") &&
              (nodeIds.has(d.value.from) || nodeIds.has(d.value.to)),
          ),
        ];
        for (const child of children)
          await payload(ctx, "documents/" + child.id, {
            method: "PATCH",
            body: JSON.stringify({ deletedAt: date, trashGroup: key }),
          });
      }
    }
    return json({ ok: true });
  } catch {
    return json({ error: "No se pudo eliminar" }, 503);
  }
};
