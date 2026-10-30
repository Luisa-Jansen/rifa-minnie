/* GET /api/admin/dashboard — resumo para o painel administrativo. */
import { json, bad, computeStats } from "../_shared.js";

export async function onRequestGet({ env }) {
  try {
    const stats = await computeStats(env);
    return json({ stats });
  } catch (e) {
    return bad("Falha ao carregar o dashboard: " + e, 500);
  }
}
