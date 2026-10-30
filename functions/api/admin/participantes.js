/* /api/admin/participantes
   GET  — lista participantes com seus números (para o gerenciamento/pesquisa).
   POST — cadastro manual: registra a pessoa e atribui vários números de uma vez. */
import { json, bad, readBody, str, parseNumeros, valorNumero, atribuirNumeros, pad2 } from "../_shared.js";

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT p.*,
              (SELECT GROUP_CONCAT(n.numero)
                 FROM numeros n WHERE n.participante_id = p.id) AS numeros_csv,
              (SELECT COUNT(*)
                 FROM numeros n WHERE n.participante_id = p.id) AS qtd_numeros
         FROM participantes p
        ORDER BY p.created_at DESC, p.id DESC`
    ).all();

    const participantes = (results || []).map((r) => ({
      ...r,
      numeros: r.numeros_csv
        ? r.numeros_csv.split(",").map((n) => parseInt(n, 10)).sort((a, b) => a - b)
        : [],
    }));
    return json({ participantes });
  } catch (e) {
    return bad("Falha ao carregar participantes: " + e, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const b = await readBody(request);
  if (!b) return bad("Dados inválidos.");

  const nome = str(b.nome, 120);
  const telefone = str(b.telefone, 40);
  const numeros = parseNumeros(b.numeros);
  // Status inicial do cadastro manual: 'aguardando' (padrão) ou 'pago'.
  const status = b.status === "pago" ? "pago" : "aguardando";

  if (!nome) return bad("Informe o nome completo.");
  if (!telefone) return bad("Informe o telefone/WhatsApp.");
  if (!numeros) return bad("Selecione ao menos um número válido (01 a 100).");

  try {
    const valor = await valorNumero(env);
    const valor_total = numeros.length * valor;

    const r = await atribuirNumeros(env, { nome, telefone, origem: "admin", status, valor_total }, numeros);
    if (!r.ok) {
      const lista = r.conflito.map(pad2).join(", ");
      return bad(`Os números ${lista} já estão reservados/pagos por outra pessoa. Escolha outros.`, 409);
    }

    await env.DB.prepare(
      `INSERT INTO historico (usuario, acao, participante_atual, motivo)
       VALUES ('admin', 'cadastro', ?, ?)`
    ).bind(nome, `Cadastro (${status}) de ${numeros.length} número(s): ${numeros.join(", ")}`).run();

    return json({ ok: true, id: r.id, nome, telefone, numeros, quantidade: numeros.length, valor_total, status }, 201);
  } catch (e) {
    return bad("Falha ao cadastrar participante: " + e, 500);
  }
}
