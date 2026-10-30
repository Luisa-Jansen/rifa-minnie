/* GET /api/admin/participantes/:id — detalhe de um participante + seus números. */
import { json, bad, int } from "../../_shared.js";

export async function onRequestGet({ params, env }) {
  const id = int(params.id, 0);
  if (!id) return bad("ID inválido.");
  try {
    const p = await env.DB.prepare("SELECT * FROM participantes WHERE id=?").bind(id).first();
    if (!p) return bad("Participante não encontrado.", 404);
    const { results } = await env.DB.prepare(
      "SELECT numero, status FROM numeros WHERE participante_id=? ORDER BY numero"
    ).bind(id).all();
    return json({ participante: { ...p, numeros: results || [] } });
  } catch (e) {
    return bad("Falha ao carregar participante: " + e, 500);
  }
}
