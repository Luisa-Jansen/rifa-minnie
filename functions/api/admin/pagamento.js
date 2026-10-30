/* POST /api/admin/pagamento — altera o status de pagamento de uma participação.
   Corpo: { participante_id, status: 'pago' | 'aguardando' | 'cancelado' }

   • 'pago'       → números do participante viram VERMELHO (pago), registra data/hora.
   • 'aguardando' → volta os números para AMARELO (reservado), limpa a confirmação.
   • 'cancelado'  → marca a participação como cancelada, mas NÃO libera os números
                    automaticamente. A liberação exige a ação autorizada /admin/liberar. */
import { json, bad, readBody, int, computeStats } from "../_shared.js";

const STATUS_VALIDOS = new Set(["pago", "aguardando", "cancelado"]);

export async function onRequestPost({ request, env }) {
  const b = await readBody(request);
  const id = int(b?.participante_id, 0);
  const status = b?.status;

  if (!id) return bad("Informe o participante.");
  if (!STATUS_VALIDOS.has(status)) return bad("Status inválido.");

  try {
    const p = await env.DB.prepare("SELECT * FROM participantes WHERE id=?").bind(id).first();
    if (!p) return bad("Participante não encontrado.", 404);

    const agora = "datetime('now')";

    if (status === "pago") {
      await env.DB.batch([
        env.DB.prepare(`UPDATE participantes SET status='pago', paid_at=${agora}, updated_at=${agora} WHERE id=?`).bind(id),
        // Só promove a 'pago' os números que ainda pertencem ao participante e não estão liberados.
        env.DB.prepare(`UPDATE numeros SET status='pago', paid_at=${agora} WHERE participante_id=? AND status<>'disponivel'`).bind(id),
      ]);
    } else if (status === "aguardando") {
      await env.DB.batch([
        env.DB.prepare(`UPDATE participantes SET status='aguardando', paid_at=NULL, updated_at=${agora} WHERE id=?`).bind(id),
        env.DB.prepare(`UPDATE numeros SET status='reservado', paid_at=NULL WHERE participante_id=? AND status<>'disponivel'`).bind(id),
      ]);
    } else {
      // cancelado — números permanecem bloqueados até liberação autorizada.
      await env.DB.prepare(`UPDATE participantes SET status='cancelado', updated_at=${agora} WHERE id=?`).bind(id).run();
    }

    await env.DB.prepare(
      `INSERT INTO historico (usuario, acao, participante_atual, motivo)
       VALUES ('admin', 'confirmar_pagamento', ?, ?)`
    ).bind(p.nome, `Status alterado para '${status}'`).run();

    const stats = await computeStats(env);
    return json({ ok: true, status, stats });
  } catch (e) {
    return bad("Falha ao atualizar o pagamento: " + e, 500);
  }
}
