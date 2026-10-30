/* GET /api/admin/historico — registro de operações administrativas (auditoria). */
import { json, bad } from "../_shared.js";

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM historico ORDER BY created_at DESC, id DESC LIMIT 300"
    ).all();
    return json({ historico: results || [] });
  } catch (e) {
    return bad("Falha ao carregar o histórico: " + e, 500);
  }
}
