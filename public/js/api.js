/* Cliente de API — wrapper fino sobre fetch para /api/* */

async function req(method, path, body) {
  const opts = { method, headers: {}, credentials: "same-origin" };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(path, opts);
  let data = null;
  try { data = await r.json(); } catch { /* sem corpo */ }
  if (!r.ok) {
    const err = new Error((data && data.error) || `Erro ${r.status}`);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const API = {
  // ---- Público ----
  grade: () => req("GET", "/api/grade"),
  config: () => req("GET", "/api/config"),
  reservar: (dados) => req("POST", "/api/reservar", dados),

  // ---- Admin (sessão) ----
  login: (senha) => req("POST", "/api/admin/login", { senha }),
  logout: () => req("POST", "/api/admin/logout"),
  me: () => req("GET", "/api/admin/me"),

  dashboard: () => req("GET", "/api/admin/dashboard"),

  participantes: () => req("GET", "/api/admin/participantes"),
  participante: (id) => req("GET", `/api/admin/participantes/${id}`),
  cadastrar: (dados) => req("POST", "/api/admin/participantes", dados),

  pagamento: (participante_id, status) => req("POST", "/api/admin/pagamento", { participante_id, status }),
  liberar: (numeros, senha, motivo) => req("POST", "/api/admin/liberar", { numeros, senha, motivo }),

  historico: () => req("GET", "/api/admin/historico"),

  getConfig: () => req("GET", "/api/admin/config"),
  salvarConfig: (dados) => req("PUT", "/api/admin/config", dados),
};
