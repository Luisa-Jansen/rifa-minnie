/* POST /api/reservar — solicitação PÚBLICA de reserva.
   O visitante informa nome, telefone e números escolhidos.
   Os números passam a 'reservado' (amarelo) e a participação fica
   'aguardando' pagamento. A confirmação do Pix é SEMPRE manual, feita
   pela administradora — esta rota nunca marca nada como pago.

   A atribuição é atômica: se qualquer número já tiver sido pego, a
   solicitação inteira é recusada e nada é reservado. */
import { json, bad, readBody, str, parseNumeros, valorNumero, atribuirNumeros } from "./_shared.js";

export async function onRequestPost({ request, env }) {
  const b = await readBody(request);
  if (!b) return bad("Dados inválidos.");

  const nome = str(b.nome, 120);
  const telefone = str(b.telefone, 40);
  const numeros = parseNumeros(b.numeros);

  if (!nome) return bad("Informe seu nome completo.");
  if (!telefone) return bad("Informe seu telefone ou WhatsApp.");
  if (!numeros) return bad("Selecione ao menos um número válido (01 a 100).");

  try {
    const valor = await valorNumero(env);
    const valor_total = numeros.length * valor;

    const r = await atribuirNumeros(env, {
      nome, telefone, origem: "publico", status: "aguardando", valor_total,
    }, numeros);

    if (!r.ok) {
      const lista = r.conflito.map((n) => String(n).padStart(2, "0")).join(", ");
      return bad(`Os números ${lista} acabaram de ser reservados por outra pessoa. Atualize a grade e escolha outros.`, 409);
    }

    await env.DB.prepare(
      `INSERT INTO historico (usuario, acao, participante_atual, motivo)
       VALUES ('publico', 'reserva_publica', ?, ?)`
    ).bind(nome, `Reserva de ${numeros.length} número(s): ${numeros.join(", ")}`).run();

    return json({
      ok: true,
      id: r.id,
      nome,
      numeros,
      quantidade: numeros.length,
      valor_total,
    }, 201);
  } catch (e) {
    return bad("Falha ao registrar a reserva: " + e, 500);
  }
}
