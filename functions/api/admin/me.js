/* GET /api/admin/me — informa se há sessão administrativa ativa. */
import { requireSession } from "../../_auth.js";

export async function onRequestGet({ request, env }) {
  const session = await requireSession(request, env);
  return new Response(JSON.stringify({ autenticado: !!session }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
