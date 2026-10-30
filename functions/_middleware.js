/* Middleware global.
   A LANDING PAGE é pública (qualquer visitante vê a campanha e a grade).
   Apenas as rotas administrativas (/api/admin/*) exigem sessão válida,
   validada no backend — exceto o próprio login. */
import { requireSession } from "./_auth.js";

const ADMIN_PREFIX = "/api/admin/";
const ADMIN_PUBLIC = new Set(["/api/admin/login", "/api/admin/logout", "/api/admin/me"]);

export async function onRequest(context) {
  const { request, env, next } = context;
  const path = new URL(request.url).pathname;

  // Só interceptamos rotas administrativas. Todo o resto (landing, grade,
  // reserva pública, assets) segue livremente.
  if (!path.startsWith(ADMIN_PREFIX) || ADMIN_PUBLIC.has(path)) return next();

  const session = await requireSession(request, env);
  if (session) return next();

  return new Response(JSON.stringify({ error: "Não autenticado." }), {
    status: 401,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
