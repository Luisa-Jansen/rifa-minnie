/* Autenticação do painel administrativo.
   Sessão via cookie assinado com HMAC-SHA256 — sem dependências,
   usando a Web Crypto do runtime do Cloudflare. */

const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64url = (bytes) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromB64url = (str) => {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(str);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
};

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export async function signToken(usuario, secret, days = 30) {
  const exp = Date.now() + days * 86400000;
  const payload = `${usuario}|${exp}`;
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
  return `${toB64url(enc.encode(payload))}.${toB64url(sig)}`;
}

export async function verifyToken(token, secret) {
  if (!token || !secret || !token.includes(".")) return null;
  const [p, s] = token.split(".");
  let payload;
  try { payload = dec.decode(fromB64url(p)); } catch { return null; }
  const key = await hmacKey(secret);
  const expected = toB64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload))));
  if (expected !== s) return null;
  const [usuario, exp] = payload.split("|");
  if (!exp || Date.now() > Number(exp)) return null;
  return { usuario };
}

export function getCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export const SESSION_COOKIE = "rifa_session";
export const sessionCookie = (token, days = 30) =>
  `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${days * 86400}`;
export const clearCookie = () =>
  `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

/* Confirma que há uma sessão administrativa válida na requisição.
   Retorna o objeto de sessão ({usuario}) ou null. */
export async function requireSession(request, env) {
  if (!env.AUTH_SECRET) return null;
  return verifyToken(getCookie(request, SESSION_COOKIE), env.AUTH_SECRET);
}

/* Comparação de senha em tempo (aproximadamente) constante, para reduzir
   a superfície de ataques de temporização sobre a senha administrativa. */
export function senhaConfere(informada, correta) {
  if (typeof informada !== "string" || typeof correta !== "string") return false;
  if (informada.length !== correta.length) return false;
  let diff = 0;
  for (let i = 0; i < informada.length; i++) diff |= informada.charCodeAt(i) ^ correta.charCodeAt(i);
  return diff === 0;
}
