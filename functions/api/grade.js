/* GET /api/grade — estado público dos 100 números + indicadores.
   NÃO expõe nome nem telefone dos participantes: apenas número e status. */
import { json, bad, computeStats } from "./_shared.js";

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT numero, status FROM numeros ORDER BY numero"
    ).all();
    const stats = await computeStats(env);
    return json({ numeros: results || [], stats });
  } catch (e) {
    return bad("Falha ao carregar a grade: " + e, 500);
  }
}
