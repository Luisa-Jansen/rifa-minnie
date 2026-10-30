/* ============================================================
   RIFA SOLIDÁRIA DA MINI — lógica do frontend
   Landing pública + painel administrativo (mesma página).
   ============================================================ */
import { API } from "./api.js";

/* ---------- Estado ---------- */
let CFG = {};               // configurações da campanha
let GRADE = [];             // [{numero, status}]
let VALOR = 20;             // valor por número
const selPub = new Set();   // números selecionados na grade pública
const selCad = new Set();   // números selecionados no cadastro admin
let PARTICIPANTES = [];      // cache da listagem admin
let pollId = null;

/* ---------- Helpers ---------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const pad2 = (n) => String(n).padStart(2, "0");
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const numerosFmt = (arr) => arr.map(pad2).join(", ");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("oculto");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add("oculto"), 2600);
}

function abrir(id) { $("#" + id).classList.remove("oculto"); }
function fechar(id) { $("#" + id).classList.add("oculto"); }

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = texto; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }
}

/* ============================================================
   LANDING PÚBLICA
   ============================================================ */

async function carregarConfig() {
  try {
    const { config } = await API.config();
    CFG = config || {};
    VALOR = Number(CFG.valor_numero) > 0 ? Number(CFG.valor_numero) : 20;
    renderLanding();
  } catch (e) { console.error(e); }
}

function renderLanding() {
  $("#apresentacao").textContent = (CFG.apresentacao || "").replace(/\\n/g, "\n");
  if (CFG.foto_mini) $("#foto-mini").src = CFG.foto_mini;
  $("#premio-titulo").textContent = CFG.premio_titulo || "um ensaio fotográfico!";
  $("#premio-descricao").textContent = CFG.premio_descricao || "";
  $("#info-valor").textContent = brl(VALOR);
  $("#info-total").textContent = CFG.total_numeros || "100";

  // Imagens do prêmio
  const box = $("#premio-imagens");
  box.innerHTML = "";
  (CFG.premio_imagens || "").split(",").map((s) => s.trim()).filter(Boolean).forEach((url) => {
    const img = document.createElement("img");
    img.src = url; img.alt = "Imagem do ensaio fotográfico"; img.loading = "lazy";
    box.appendChild(img);
  });
}

async function carregarGrade() {
  try {
    const { numeros, stats } = await API.grade();
    GRADE = numeros || [];
    renderGrade();
    renderStats(stats);
  } catch (e) { console.error(e); }
}

function renderGrade() {
  const cont = $("#grade-numeros");
  cont.innerHTML = "";
  for (const n of GRADE) {
    const b = document.createElement("button");
    b.className = `num ${n.status}`;
    b.textContent = pad2(n.numero);
    b.dataset.numero = n.numero;
    if (selPub.has(n.numero)) b.classList.add("selecionado");
    if (n.status === "disponivel") {
      b.addEventListener("click", () => toggleSelPub(n.numero));
    } else {
      b.disabled = true;
      b.title = n.status === "pago" ? "Número já pago" : "Número reservado";
    }
    cont.appendChild(b);
  }
}

function toggleSelPub(numero) {
  if (selPub.has(numero)) selPub.delete(numero); else selPub.add(numero);
  renderGrade();
  renderSelecao();
}

function renderSelecao() {
  const qtd = selPub.size;
  const arr = [...selPub].sort((a, b) => a - b);
  $("#sel-qtd").textContent = qtd;
  $("#sel-numeros").textContent = qtd ? numerosFmt(arr) : "";
  $("#sel-total").textContent = brl(qtd * VALOR);
  $("#selecao-bar").classList.toggle("oculto", qtd === 0);
}

function renderStats(s) {
  if (!s) return;
  $("#st-pagos").textContent = s.pagos;
  $("#st-reservados").textContent = s.reservados;
  $("#st-disponiveis").textContent = s.disponiveis;
  $("#st-arrecadado").textContent = brl(s.arrecadado);
  const pct = s.total ? Math.round((s.pagos / s.total) * 100) : 0;
  $("#progresso-barra").style.width = pct + "%";
  $("#progresso-label").textContent = pct + "% pagos";
  $("#progressbar").setAttribute("aria-valuenow", String(pct));
}

/* ---------- Reserva pública ---------- */

function abrirReserva() {
  if (selPub.size === 0) { toast("Selecione ao menos um número."); return; }
  const arr = [...selPub].sort((a, b) => a - b);
  $("#reserva-numeros").innerHTML = arr.map((n) => `<span class="chip">${pad2(n)}</span>`).join("");
  $("#reserva-qtd").textContent = arr.length;
  $("#reserva-total").textContent = brl(arr.length * VALOR);
  $("#reserva-erro").classList.add("oculto");
  $("#form-reserva").reset();
  renderPix();
  abrir("modal-reserva");
}

function renderPix() {
  const temChave = !!CFG.pix_chave;
  const temQr = !!CFG.pix_qrcode;
  const temCec = !!CFG.pix_copiaecola;
  $("#pix-sem-dados").classList.toggle("oculto", temChave || temQr || temCec);
  $("#pix-dados").classList.toggle("oculto", !(temChave || temQr || temCec));
  const qr = $("#pix-qr");
  if (temQr) { qr.src = CFG.pix_qrcode; qr.classList.remove("oculto"); } else qr.classList.add("oculto");
  $("#pix-chave").textContent = CFG.pix_chave || "—";
  $("#pix-titular").textContent = CFG.pix_titular || "—";
  $("#pix-cec").value = CFG.pix_copiaecola || "";
  $("#pix-cec-box").classList.toggle("oculto", !temCec);
}

async function enviarReserva(e) {
  e.preventDefault();
  const nome = $("#reserva-nome").value.trim();
  const telefone = $("#reserva-telefone").value.trim();
  const numeros = [...selPub].sort((a, b) => a - b);
  const errBox = $("#reserva-erro");
  errBox.classList.add("oculto");
  try {
    const r = await API.reservar({ nome, telefone, numeros });
    fechar("modal-reserva");
    // Resumo de sucesso
    $("#reserva-ok-resumo").innerHTML =
      `<span class="chips">${r.numeros.map((n) => `<span class="chip">${pad2(n)}</span>`).join("")}</span>` +
      `<span class="resumo-total">${r.quantidade} número(s) · <strong>${brl(r.valor_total)}</strong></span>`;
    abrir("modal-reserva-ok");
    selPub.clear();
    renderSelecao();
    await carregarGrade();
  } catch (err) {
    errBox.textContent = err.message;
    errBox.classList.remove("oculto");
    if (err.status === 409) await carregarGrade();
  }
}

/* ============================================================
   ADMINISTRAÇÃO
   ============================================================ */

async function abrirAreaAdmin() {
  try {
    const { autenticado } = await API.me();
    if (autenticado) { abrirPainel(); }
    else { $("#login-erro").classList.add("oculto"); $("#form-login").reset(); abrir("modal-login"); }
  } catch {
    abrir("modal-login");
  }
}

async function fazerLogin(e) {
  e.preventDefault();
  const senha = $("#login-senha").value;
  const err = $("#login-erro");
  err.classList.add("oculto");
  try {
    await API.login(senha);
    fechar("modal-login");
    abrirPainel();
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove("oculto");
  }
}

async function logout() {
  try { await API.logout(); } catch {}
  fechar("modal-admin");
  toast("Sessão encerrada.");
}

function abrirPainel() {
  abrir("modal-admin");
  trocarAba("dashboard");
}

function trocarAba(aba) {
  $$(".aba").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === aba));
  $$(".aba-conteudo").forEach((s) => s.classList.toggle("ativa", s.dataset.painel === aba));
  if (aba === "dashboard") carregarDashboard();
  if (aba === "cadastrar") renderCadGrade();
  if (aba === "participantes") carregarParticipantes();
  if (aba === "historico") carregarHistorico();
  if (aba === "config") carregarConfigAdmin();
}

/* ---------- Dashboard ---------- */
async function carregarDashboard() {
  try {
    const { stats } = await API.dashboard();
    const cards = [
      ["Total", stats.total], ["Disponíveis", stats.disponiveis],
      ["Reservados", stats.reservados], ["Pagos", stats.pagos],
      ["Participantes", stats.participantes], ["Recebido", brl(stats.arrecadado)],
      ["Pendente", brl(stats.pendente)], ["Valor/número", brl(stats.valor_numero)],
    ];
    $("#dash-grid").innerHTML = cards.map(([l, v]) =>
      `<div class="dash-card"><strong>${v}</strong><span>${l}</span></div>`).join("");
  } catch (e) { toast("Erro ao carregar resumo."); }
}

/* ---------- Cadastro manual ---------- */
function renderCadGrade() {
  const cont = $("#cad-grade");
  cont.innerHTML = "";
  for (const n of GRADE) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `num ${n.status}`;
    b.textContent = pad2(n.numero);
    if (selCad.has(n.numero)) b.classList.add("selecionado");
    if (n.status === "disponivel") {
      b.addEventListener("click", () => {
        if (selCad.has(n.numero)) selCad.delete(n.numero); else selCad.add(n.numero);
        renderCadGrade(); renderCadResumo();
      });
    } else { b.disabled = true; }
    cont.appendChild(b);
  }
  renderCadResumo();
}

function renderCadResumo() {
  const arr = [...selCad].sort((a, b) => a - b);
  $("#cad-qtd").textContent = arr.length;
  $("#cad-sel").textContent = numerosFmt(arr);
  $("#cad-total").textContent = brl(arr.length * VALOR);
}

async function enviarCadastro(e) {
  e.preventDefault();
  const nome = $("#cad-nome").value.trim();
  const telefone = $("#cad-telefone").value.trim();
  const numeros = [...selCad].sort((a, b) => a - b);
  const pago = $("#cad-pago").checked;
  const err = $("#cad-erro");
  err.classList.add("oculto");
  if (!numeros.length) { err.textContent = "Selecione ao menos um número."; err.classList.remove("oculto"); return; }
  try {
    const r = await API.cadastrar({ nome, telefone, numeros, status: pago ? "pago" : "aguardando" });
    selCad.clear();
    $("#form-cadastro").reset();
    await carregarGrade();     // atualiza grade pública
    renderCadGrade();
    // Pop-up WhatsApp
    abrirPopupWhats("cadastro", { nome: r.nome, numeros: r.numeros, valor_total: r.valor_total, quantidade: r.quantidade });
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove("oculto");
  }
}

/* ---------- Participantes ---------- */
async function carregarParticipantes() {
  try {
    const { participantes } = await API.participantes();
    PARTICIPANTES = participantes || [];
    renderParticipantes();
  } catch { toast("Erro ao carregar participantes."); }
}

function renderParticipantes() {
  const termo = $("#busca-part").value.trim().toLowerCase();
  const lista = PARTICIPANTES.filter((p) => {
    if (!termo) return true;
    const nums = (p.numeros || []).map(pad2).join(" ") + " " + (p.numeros || []).join(" ");
    return (p.nome || "").toLowerCase().includes(termo)
      || (p.telefone || "").toLowerCase().includes(termo)
      || nums.includes(termo);
  });
  const cont = $("#lista-part");
  if (!lista.length) { cont.innerHTML = `<p class="nota">Nenhum participante encontrado.</p>`; return; }
  cont.innerHTML = lista.map((p) => {
    const nums = (p.numeros || []).map(pad2).join(", ") || "—";
    const st = p.status;
    const acoesPag = st === "pago"
      ? `<button class="btn btn-sec btn-sm" data-acao="aguardando" data-id="${p.id}">Marcar pendente</button>
         <button class="btn btn-sec btn-sm" data-acao="msg-pago" data-id="${p.id}">Msg pagamento</button>`
      : st === "cancelado"
        ? `<button class="btn btn-sec btn-sm" data-acao="pago" data-id="${p.id}">Confirmar pagamento</button>`
        : `<button class="btn btn-primary btn-sm" data-acao="pago" data-id="${p.id}">Confirmar pagamento</button>
           <button class="btn btn-sec btn-sm" data-acao="cancelar" data-id="${p.id}">Cancelar</button>`;
    return `<div class="part-card">
      <div class="part-head">
        <div><div class="part-nome">${esc(p.nome)}</div><div class="part-tel">${esc(p.telefone)}</div></div>
        <span class="badge badge-${st}">${st}</span>
      </div>
      <div class="part-nums"><strong>${(p.numeros || []).length}</strong> número(s): ${esc(nums)} · <strong>${brl(p.valor_total)}</strong></div>
      <div class="part-acoes">
        ${acoesPag}
        <button class="btn btn-perigo btn-sm" data-acao="liberar" data-id="${p.id}">Liberar nº</button>
      </div>
    </div>`;
  }).join("");

  $$("#lista-part [data-acao]").forEach((btn) => {
    btn.addEventListener("click", () => acaoParticipante(btn.dataset.acao, Number(btn.dataset.id)));
  });
}

async function acaoParticipante(acao, id) {
  const p = PARTICIPANTES.find((x) => x.id === id);
  if (!p) return;

  if (acao === "pago") {
    try {
      await API.pagamento(id, "pago");
      toast("Pagamento confirmado!");
      await Promise.all([carregarParticipantes(), carregarGrade()]);
      // Oferece a mensagem de confirmação de pagamento
      abrirPopupWhats("pagamento", { nome: p.nome, numeros: p.numeros });
    } catch (e) { toast(e.message); }
  } else if (acao === "aguardando") {
    try { await API.pagamento(id, "aguardando"); toast("Voltou para pendente."); await Promise.all([carregarParticipantes(), carregarGrade()]); }
    catch (e) { toast(e.message); }
  } else if (acao === "cancelar") {
    if (!confirm("Cancelar esta participação? Os números permanecerão bloqueados até liberação autorizada.")) return;
    try { await API.pagamento(id, "cancelado"); toast("Participação cancelada."); await Promise.all([carregarParticipantes(), carregarGrade()]); }
    catch (e) { toast(e.message); }
  } else if (acao === "msg-pago") {
    abrirPopupWhats("pagamento", { nome: p.nome, numeros: p.numeros });
  } else if (acao === "liberar") {
    abrirLiberar(p);
  }
}

/* ---------- Liberação autorizada ---------- */
let liberarNumeros = [];
function abrirLiberar(p) {
  liberarNumeros = (p.numeros || []).slice();
  $("#liberar-sub").innerHTML = `Liberar os números <strong>${numerosFmt(liberarNumeros) || "—"}</strong> de <strong>${esc(p.nome)}</strong>? Esta ação devolve os números para disponível e fica registrada no histórico.`;
  $("#form-liberar").reset();
  $("#liberar-erro").classList.add("oculto");
  abrir("modal-liberar");
}

async function enviarLiberar(e) {
  e.preventDefault();
  const motivo = $("#liberar-motivo").value.trim();
  const senha = $("#liberar-senha").value;
  const err = $("#liberar-erro");
  err.classList.add("oculto");
  if (!liberarNumeros.length) { err.textContent = "Nenhum número para liberar."; err.classList.remove("oculto"); return; }
  try {
    const r = await API.liberar(liberarNumeros, senha, motivo);
    fechar("modal-liberar");
    toast(r.mensagem || "Número(s) liberado(s).");
    await Promise.all([carregarParticipantes(), carregarGrade()]);
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove("oculto");
  }
}

/* ---------- Histórico ---------- */
async function carregarHistorico() {
  try {
    const { historico } = await API.historico();
    const cont = $("#lista-hist");
    if (!historico.length) { cont.innerHTML = `<p class="nota">Nenhuma operação registrada ainda.</p>`; return; }
    cont.innerHTML = historico.map((h) => {
      const partes = [];
      if (h.numero != null) partes.push(`Nº ${pad2(h.numero)}`);
      if (h.participante_atual) partes.push(esc(h.participante_atual));
      if (h.participante_anterior) partes.push(`(antes: ${esc(h.participante_anterior)})`);
      return `<div class="hist-item">
        <div><span class="hist-acao">${esc(h.acao)}</span> — ${partes.join(" · ")}</div>
        ${h.motivo ? `<div>${esc(h.motivo)}</div>` : ""}
        <div class="hist-data">${esc(h.created_at)} · ${esc(h.usuario)}</div>
      </div>`;
    }).join("");
  } catch { toast("Erro ao carregar histórico."); }
}

/* ---------- Configurações ---------- */
async function carregarConfigAdmin() {
  try {
    const { config } = await API.getConfig();
    $("#cfg-valor").value = config.valor_numero || "";
    $("#cfg-apresentacao").value = config.apresentacao || "";
    $("#cfg-foto").value = config.foto_mini || "";
    $("#cfg-premio-titulo").value = config.premio_titulo || "";
    $("#cfg-premio-descricao").value = config.premio_descricao || "";
    $("#cfg-premio-imagens").value = config.premio_imagens || "";
    $("#cfg-pix-chave").value = config.pix_chave || "";
    $("#cfg-pix-titular").value = config.pix_titular || "";
    $("#cfg-pix-qrcode").value = config.pix_qrcode || "";
    $("#cfg-pix-cec").value = config.pix_copiaecola || "";
  } catch { toast("Erro ao carregar configurações."); }
}

async function salvarConfig(e) {
  e.preventDefault();
  const dados = {
    valor_numero: $("#cfg-valor").value,
    apresentacao: $("#cfg-apresentacao").value,
    foto_mini: $("#cfg-foto").value,
    premio_titulo: $("#cfg-premio-titulo").value,
    premio_descricao: $("#cfg-premio-descricao").value,
    premio_imagens: $("#cfg-premio-imagens").value,
    pix_chave: $("#cfg-pix-chave").value,
    pix_titular: $("#cfg-pix-titular").value,
    pix_qrcode: $("#cfg-pix-qrcode").value,
    pix_copiaecola: $("#cfg-pix-cec").value,
  };
  const msg = $("#cfg-msg");
  try {
    const { config } = await API.salvarConfig(dados);
    CFG = config; VALOR = Number(config.valor_numero) > 0 ? Number(config.valor_numero) : 20;
    renderLanding();
    msg.textContent = "Configurações salvas com sucesso!";
    msg.classList.remove("oculto");
    setTimeout(() => msg.classList.add("oculto"), 2500);
  } catch (ex) { toast(ex.message); }
}

/* ---------- Pop-ups WhatsApp ---------- */
function mensagemCadastro({ nome, numeros, valor_total }) {
  return `Oi, ${nome}!\n\n` +
    `Seus números da Rifa Solidária da Minnie foram registrados!\n\n` +
    `Seus números: ${numerosFmt(numeros)}\n\n` +
    `Valor total: ${brl(valor_total)}\n\n` +
    `Obrigada por participar e ajudar a Minnie no tratamento contra a leishmaniose!\n\n` +
    `Boa sorte e muito obrigada pelo carinho!`;
}
function mensagemPagamento({ nome, numeros }) {
  return `Oi, ${nome}!\n\n` +
    `Passando para confirmar que seu pagamento da Rifa Solidária da Minnie foi recebido!\n\n` +
    `Seus números confirmados são: ${numerosFmt(numeros)}.\n\n` +
    `Muito obrigada por ajudar a Minnie em seu tratamento e por fazer parte dessa corrente de solidariedade!\n\n` +
    `Boa sorte!`;
}

function abrirPopupWhats(tipo, dados) {
  const nums = (dados.numeros || []).slice().sort((a, b) => a - b);
  const quantidade = dados.quantidade ?? nums.length;
  const texto = tipo === "pagamento"
    ? mensagemPagamento({ nome: dados.nome, numeros: nums })
    : mensagemCadastro({ nome: dados.nome, numeros: nums, valor_total: dados.valor_total });

  $("#whats-titulo").textContent = tipo === "pagamento" ? "Confirmação de pagamento" : "Cadastro realizado com sucesso!";
  $("#whats-resumo").innerHTML =
    `<div class="part-nome">${esc(dados.nome)}</div>` +
    `<span class="chips">${nums.map((n) => `<span class="chip">${pad2(n)}</span>`).join("")}</span>` +
    `<span class="resumo-total">${quantidade} número(s)${dados.valor_total != null ? ` · <strong>${brl(dados.valor_total)}</strong>` : ""}</span>`;
  $("#whats-msg").value = texto;
  $("#whats-copiado").classList.add("oculto");
  abrir("modal-whats");
}

async function copiarWhats() {
  const ok = await copiar($("#whats-msg").value);
  const aviso = $("#whats-copiado");
  if (ok) { aviso.classList.remove("oculto"); }
  else { toast("Não foi possível copiar. Selecione e copie manualmente."); }
}

/* ============================================================
   POPUP "COMPRE MINHA RIFA"
   Lembrete emocional exibido enquanto o visitante escolhe os
   números. Não interrompe a navegação inicial, não reaparece
   na mesma sessão após ser fechado e não bloqueia a seleção.
   ============================================================ */
const POPUP_KEY = "popupCompreVisto";
let popupTimer = null;

function fecharPopupCompre() {
  const ov = $("#popup-compre");
  if (!ov || ov.classList.contains("oculto")) return;
  ov.classList.add("oculto");
  ov.setAttribute("aria-hidden", "true");
  // Marca como visto para não reaparecer nesta sessão de navegação.
  try { sessionStorage.setItem(POPUP_KEY, "1"); } catch { /* ignore */ }
}

function abrirPopupCompre() {
  const ov = $("#popup-compre");
  if (!ov) return;
  let visto = false;
  try { visto = sessionStorage.getItem(POPUP_KEY) === "1"; } catch { /* ignore */ }
  if (visto) return;
  ov.classList.remove("oculto");
  ov.setAttribute("aria-hidden", "false");
}

function configurarPopupCompre() {
  const ov = $("#popup-compre");
  const grade = $("#grade");
  if (!ov || !grade) return;

  // Fechar: botão X e clique fora da imagem.
  $("#popup-compre-x").addEventListener("click", fecharPopupCompre);
  ov.addEventListener("click", (e) => { if (e.target === ov) fecharPopupCompre(); });

  // Dispara quando o visitante chega à área de seleção dos números,
  // após alguns segundos de interação, sem interromper o início.
  const agendar = () => {
    let visto = false;
    try { visto = sessionStorage.getItem(POPUP_KEY) === "1"; } catch { /* ignore */ }
    if (visto || popupTimer) return;
    popupTimer = setTimeout(abrirPopupCompre, 3500);
  };

  if ("IntersectionObserver" in window) {
    const obs = new IntersectionObserver((entradas) => {
      for (const ent of entradas) {
        if (ent.isIntersecting) { agendar(); obs.disconnect(); break; }
      }
    }, { threshold: 0.3 });
    obs.observe(grade);
  } else {
    // Fallback simples: agenda ao detectar scroll até a grade.
    const aoRolar = () => {
      const r = grade.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.8) {
        agendar();
        window.removeEventListener("scroll", aoRolar);
      }
    };
    window.addEventListener("scroll", aoRolar, { passive: true });
  }
}

/* ============================================================
   INICIALIZAÇÃO E EVENTOS
   ============================================================ */

function ligarEventos() {
  // Fechar modais (botões com data-fechar)
  $$("[data-fechar]").forEach((b) => b.addEventListener("click", () => fechar(b.dataset.fechar)));
  // Fechar ao clicar no overlay (fora do conteúdo)
  $$(".modal-overlay").forEach((ov) => ov.addEventListener("click", (e) => {
    if (e.target === ov) ov.classList.add("oculto");
  }));

  // Público
  $("#btn-participar").addEventListener("click", abrirReserva);
  $("#form-reserva").addEventListener("submit", enviarReserva);
  $("#btn-copiar-pix").addEventListener("click", async () => {
    const ok = await copiar(CFG.pix_copiaecola || "");
    toast(ok ? "Código Pix copiado!" : "Não foi possível copiar.");
  });

  // Admin — acesso
  $("#btn-area-admin").addEventListener("click", abrirAreaAdmin);
  $("#form-login").addEventListener("submit", fazerLogin);
  $("#btn-logout").addEventListener("click", logout);
  $$(".aba").forEach((b) => b.addEventListener("click", () => trocarAba(b.dataset.aba)));

  // Admin — cadastro, participantes, config, liberar
  $("#form-cadastro").addEventListener("submit", enviarCadastro);
  $("#busca-part").addEventListener("input", renderParticipantes);
  $("#form-config").addEventListener("submit", salvarConfig);
  $("#form-liberar").addEventListener("submit", enviarLiberar);

  // WhatsApp
  $("#btn-copiar-whats").addEventListener("click", copiarWhats);

  // Esc fecha o modal visível mais acima
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const popup = $("#popup-compre");
    if (popup && !popup.classList.contains("oculto")) { fecharPopupCompre(); return; }
    const abertos = $$(".modal-overlay:not(.oculto)");
    if (abertos.length) abertos[abertos.length - 1].classList.add("oculto");
  });

  // Popup emocional "Compre minha rifa" na seleção de números
  configurarPopupCompre();
}

function iniciarPolling() {
  // Atualização periódica confiável da grade pública (a cada 20s),
  // pausada enquanto o painel admin está aberto para não atrapalhar a edição.
  pollId = setInterval(() => {
    if ($("#modal-admin").classList.contains("oculto")) carregarGrade();
  }, 20000);
}

(async function init() {
  ligarEventos();
  await carregarConfig();
  await carregarGrade();
  iniciarPolling();
})();
