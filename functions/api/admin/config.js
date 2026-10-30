/* /api/admin/config
   GET — todas as configurações editáveis.
   PUT — atualiza uma ou várias chaves. Corpo: { chave: valor, ... }

   Chaves aceitas (lista branca): textos, prêmio, foto, Pix e valor do número. */
import { json, bad, readBody, lerConfig } from "../_shared.js";

const CHAVES_PERMITIDAS = new Set([
  "valor_numero", "premio_titulo", "premio_descricao", "apresentacao",
  "foto_mini", "pix_chave", "pix_titular", "pix_qrcode", "pix_copiaecola",
  "premio_imagens",
]);

export async function onRequestGet({ env }) {
  try {
    return json({ config: await lerConfig(env) });
  } catch (e) {
    return bad("Falha ao carregar configurações: " + e, 500);
  }
}

export async function onRequestPut({ request, env }) {
  const b = await readBody(request);
  if (!b || typeof b !== "object") return bad("Dados inválidos.");

  const entradas = Object.entries(b).filter(([k]) => CHAVES_PERMITIDAS.has(k));
  if (!entradas.length) return bad("Nenhuma configuração válida informada.");

  try {
    const stmts = entradas.map(([chave, valor]) =>
      env.DB.prepare(
        `INSERT INTO config (chave, valor, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor, updated_at=datetime('now')`
      ).bind(chave, valor == null ? null : String(valor))
    );
    await env.DB.batch(stmts);
    return json({ ok: true, config: await lerConfig(env) });
  } catch (e) {
    return bad("Falha ao salvar configurações: " + e, 500);
  }
}
