/* POST /api/admin/liberar — LIBERAÇÃO AUTORIZADA de número(s).
   Esta é a ÚNICA forma de devolver um número atribuído para 'disponivel'.
   Exige, além da sessão válida, a reconfirmação da SENHA administrativa
   (validada no backend) e um MOTIVO. Cada liberação é registrada no histórico
   com o participante anterior.

   Corpo: { numeros: [..], senha, motivo }  (ou { numero, senha, motivo }) */
import { json, bad, readBody, str, parseNumeros, pad2 } from "../_shared.js";
import { senhaConfere } from "../../_auth.js";

export async function onRequestPost({ request, env }) {
  if (!env.AUTH_PASSWORD) return bad("Painel não configurado.", 503);

  const b = await readBody(request);
  const senha = str(b?.senha, 200) || "";
  const motivo = str(b?.motivo, 300);
  const numeros = parseNumeros(b?.numeros || (b?.numero != null ? [b.numero] : []));

  // Reconfirma a senha administrativa no backend — não basta estar logada.
  if (!senhaConfere(senha, env.AUTH_PASSWORD)) {
    return bad("Senha administrativa incorreta. Liberação não autorizada.", 401);
  }
  if (!numeros) return bad("Informe o(s) número(s) a liberar.");
  if (!motivo) return bad("Informe o motivo da liberação.");

  try {
    const liberados = [];
    for (const numero of numeros) {
      const n = await env.DB.prepare(
        `SELECT n.numero, n.status, p.nome AS part_nome
           FROM numeros n LEFT JOIN participantes p ON p.id = n.participante_id
          WHERE n.numero=?`
      ).bind(numero).first();

      if (!n || n.status === "disponivel") continue; // nada a liberar

      await env.DB.batch([
        env.DB.prepare(
          `UPDATE numeros SET status='disponivel', participante_id=NULL, reserved_at=NULL, paid_at=NULL WHERE numero=?`
        ).bind(numero),
        env.DB.prepare(
          `INSERT INTO historico (usuario, acao, numero, participante_anterior, motivo)
           VALUES ('admin', 'liberar_numero', ?, ?, ?)`
        ).bind(numero, n.part_nome || null, motivo),
      ]);
      liberados.push(numero);
    }

    if (!liberados.length) {
      return bad("Nenhum número elegível para liberação (já estavam disponíveis).", 409);
    }
    return json({ ok: true, liberados, mensagem: `Número(s) liberado(s): ${liberados.map(pad2).join(", ")}.` });
  } catch (e) {
    return bad("Falha ao liberar número(s): " + e, 500);
  }
}
