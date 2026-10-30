/* GET /api/config — configurações públicas da campanha (textos, prêmio, Pix,
   foto da Mini, valor do número). Usado para renderizar a landing page.
   A edição é feita pela rota protegida /api/admin/config. */
import { json, bad, lerConfig } from "./_shared.js";

export async function onRequestGet({ env }) {
  try {
    const cfg = await lerConfig(env);
    return json({ config: cfg });
  } catch (e) {
    return bad("Falha ao carregar configurações: " + e, 500);
  }
}
