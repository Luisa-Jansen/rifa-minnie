/* Helpers compartilhados das Functions da Rifa */

export const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });

export const bad = (msg, status = 400) => json({ error: msg }, status);

export async function readBody(request) {
  try { return await request.json(); }
  catch { return null; }
}

export const str = (v, max = 500) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s.slice(0, max) : null;
};

export const int = (v, def = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};

/* Normaliza e valida uma lista de números da rifa.
   Aceita array de números/strings; devolve inteiros 1..100 únicos e ordenados.
   Retorna null se algum valor for inválido/fora do intervalo. */
export function parseNumeros(input, total = 100) {
  if (!Array.isArray(input) || input.length === 0) return null;
  const set = new Set();
  for (const raw of input) {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > total) return null;
    set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

/* Formata um número como "01", "07", "100". */
export const pad2 = (n) => String(n).padStart(2, "0");

/* Lê todas as configurações como objeto { chave: valor }. */
export async function lerConfig(env) {
  const { results } = await env.DB.prepare("SELECT chave, valor FROM config").all();
  const cfg = {};
  for (const r of results || []) cfg[r.chave] = r.valor;
  return cfg;
}

/* Valor unitário do número (lido da config, com fallback 20). */
export async function valorNumero(env) {
  const row = await env.DB.prepare("SELECT valor FROM config WHERE chave='valor_numero'").first();
  const v = row ? Number(row.valor) : 20;
  return Number.isFinite(v) && v > 0 ? v : 20;
}

/* Indicadores da campanha. Só contabiliza como arrecadado o que está PAGO. */
export async function computeStats(env) {
  const valor = await valorNumero(env);
  const row = await env.DB.prepare(
    `SELECT
       SUM(status='disponivel') AS disponiveis,
       SUM(status='reservado')  AS reservados,
       SUM(status='pago')       AS pagos,
       COUNT(*)                 AS total
     FROM numeros`
  ).first();
  const p = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM participantes WHERE status<>'cancelado'"
  ).first();
  const disponiveis = Number(row?.disponiveis || 0);
  const reservados = Number(row?.reservados || 0);
  const pagos = Number(row?.pagos || 0);
  const total = Number(row?.total || 0);
  return {
    total,
    disponiveis,
    reservados,
    pagos,
    participantes: Number(p?.n || 0),
    valor_numero: valor,
    arrecadado: pagos * valor,       // só pagamentos confirmados
    pendente: reservados * valor,    // reservas aguardando (não contam como arrecadado)
  };
}

/* Atribui atomicamente um conjunto de números a um participante.
   Pré-condição: os números precisam estar 'disponivel'. Usa UPDATE condicional
   e confere a contagem de linhas alteradas; se não bater, compensa (libera o que
   tiver prendido e apaga o participante) e devolve um conflito — evitando que
   duas pessoas reservem o mesmo número simultaneamente.

   participante: { nome, telefone, origem, status('aguardando'|'pago'), valor_total }
   Retorna { ok:true, id } ou { ok:false, conflito:[...numeros ocupados] }. */
export async function atribuirNumeros(env, participante, numeros) {
  const { nome, telefone, origem = "admin", status = "aguardando", valor_total } = participante;
  const agora = "datetime('now')";

  // Confere disponibilidade atual (diagnóstico para mensagem de conflito).
  const ph = numeros.map(() => "?").join(",");
  const { results: atuais } = await env.DB.prepare(
    `SELECT numero, status FROM numeros WHERE numero IN (${ph})`
  ).bind(...numeros).all();
  const ocupados = (atuais || []).filter((r) => r.status !== "disponivel").map((r) => r.numero);
  if (ocupados.length) return { ok: false, conflito: ocupados };

  // Cria o participante.
  const ins = await env.DB.prepare(
    `INSERT INTO participantes (nome, telefone, status, valor_total, origem, paid_at)
     VALUES (?,?,?,?,?, ${status === "pago" ? agora : "NULL"})`
  ).bind(nome, telefone, status, valor_total, origem).run();
  const pid = ins.meta.last_row_id;

  // Atribui os números SOMENTE se ainda estiverem disponíveis (trava anti-corrida).
  const numStatus = status === "pago" ? "pago" : "reservado";
  const upd = await env.DB.prepare(
    `UPDATE numeros
        SET status=?, participante_id=?, reserved_at=${agora},
            paid_at=${status === "pago" ? agora : "NULL"}
      WHERE numero IN (${ph}) AND status='disponivel'`
  ).bind(numStatus, pid, ...numeros).run();

  if ((upd.meta.changes || 0) !== numeros.length) {
    // Alguém pegou um número entre a checagem e o update: desfaz tudo.
    await env.DB.prepare(
      `UPDATE numeros SET status='disponivel', participante_id=NULL, reserved_at=NULL, paid_at=NULL
        WHERE participante_id=?`
    ).bind(pid).run();
    await env.DB.prepare("DELETE FROM participantes WHERE id=?").bind(pid).run();
    // Recalcula quais ficaram ocupados para informar o solicitante.
    const { results: novos } = await env.DB.prepare(
      `SELECT numero FROM numeros WHERE numero IN (${ph}) AND status<>'disponivel'`
    ).bind(...numeros).all();
    return { ok: false, conflito: (novos || []).map((r) => r.numero) };
  }

  return { ok: true, id: pid };
}
