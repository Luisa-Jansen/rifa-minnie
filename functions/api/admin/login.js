/* POST /api/admin/login — autentica a administradora (senha validada no backend).
   Emite um cookie de sessão assinado (HMAC). A senha correta vive apenas no
   ambiente do servidor (env.AUTH_PASSWORD), nunca no frontend. */
import { readBody, str } from "../_shared.js";
import { signToken, sessionCookie, senhaConfere } from "../../_auth.js";

const reply = (data, status, cookie) => {
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  if (cookie) headers["Set-Cookie"] = cookie;
  return new Response(JSON.stringify(data), { status, headers });
};

export async function onRequestPost({ request, env }) {
  if (!env.AUTH_SECRET || !env.AUTH_PASSWORD) {
    return reply({ error: "Painel não configurado. Defina AUTH_SECRET e AUTH_PASSWORD no servidor." }, 503);
  }
  const b = await readBody(request);
  const senha = str(b?.senha, 200) || "";
  if (!senhaConfere(senha, env.AUTH_PASSWORD)) {
    return reply({ error: "Senha incorreta." }, 401);
  }
  const token = await signToken("admin", env.AUTH_SECRET);
  return reply({ ok: true }, 200, sessionCookie(token));
}
