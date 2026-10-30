# 🐾 Rifa Solidária da Mini

Landing page pública **+** painel administrativo discreto, na **mesma página**, para
gerenciar a rifa solidária em prol do tratamento de leishmaniose da Mini.

- **100 números** (01 a 100) · **R$ 20,00** cada · prêmio: **ensaio fotográfico**
- Banco de dados **persistente e real** (não é demonstração) com proteção dos números
- Mesma arquitetura dos seus outros projetos: **Cloudflare Pages + Functions + D1**

---

## 🧱 Arquitetura

| Camada | Tecnologia |
|---|---|
| Frontend | HTML + CSS + JavaScript (estático, em `public/`) |
| Backend | Cloudflare Pages **Functions** (`functions/`) |
| Banco | Cloudflare **D1** (SQLite persistente) |
| Autenticação | Cookie de sessão assinado com **HMAC-SHA256**, validado no backend |

```
public/            → landing page (index.html, css/, js/, img/)
functions/
  _auth.js         → sessão (HMAC), verificação de senha
  _middleware.js   → landing é pública; /api/admin/* exige sessão
  api/
    grade.js       → GET estado dos 100 números (sem telefones) + indicadores
    config.js      → GET configurações públicas
    reservar.js    → POST reserva pública (atômica, anti-duplicidade)
    _shared.js     → helpers + atribuição atômica de números + stats
    admin/         → login, logout, me, dashboard, participantes,
                     pagamento, liberar, historico, config
schema.sql         → tabelas + seed dos 100 números e configurações
wrangler.toml      → configuração do Cloudflare
```

---

## 🚀 Como rodar localmente

```bash
# 1. Instale as dependências do wrangler (uma vez)
npm install -g wrangler        # ou use npx wrangler nos comandos abaixo

# 2. Crie o banco local e carregue as 100 casas + configurações
npm run db:local

# 3. Suba o servidor local (http://127.0.0.1:8788)
npm run dev
```

A **senha administrativa local** está em `.dev.vars` (`AUTH_PASSWORD="mini2026"`).
Troque à vontade — esse arquivo **não** é versionado.

---

## ☁️ Como publicar no Cloudflare (produção)

```bash
# 1. Faça login na sua conta Cloudflare
wrangler login

# 2. Crie o banco D1 de produção
wrangler d1 create rifa-minnie
#    → copie o "database_id" retornado e cole em wrangler.toml

# 3. Carregue o schema no banco REMOTO
npm run db:remote

# 4. Publique o site
npm run deploy
```

### Variáveis de ambiente (produção) — **obrigatórias**

No painel do Cloudflare → seu projeto Pages → **Settings → Variables and Secrets**,
crie (como *Secret*):

| Variável | O que é |
|---|---|
| `AUTH_SECRET` | Texto longo e aleatório para assinar as sessões |
| `AUTH_PASSWORD` | A senha que a administradora usará para entrar no painel |

> Sem essas variáveis, o login do painel é recusado (503). A landing pública
> continua funcionando normalmente.

---

## 🎨 Como usar

### Visitante (público)
1. Vê a campanha, a foto da Mini, o prêmio e os indicadores de arrecadação.
2. Na grade, toca nos números **verdes** (disponíveis) para selecioná-los.
3. Clica em **Participar**, informa nome + telefone e confirma a reserva.
4. Os números ficam **amarelos** (reservados) e as instruções de **Pix** aparecem.
5. O pagamento é confirmado **manualmente** pela administradora (nunca automático).

### Administradora
1. Rodapé → **Área administrativa** → digite a senha.
2. Abas do painel:
   - **Resumo**: total, disponíveis, reservados, pagos, participantes, recebido, pendente.
   - **Cadastrar**: registra uma pessoa e vários números de uma vez; ao concluir,
     abre o **pop-up de WhatsApp** com a mensagem pronta para copiar.
   - **Participantes**: lista com busca (nome/telefone/número); confirmar pagamento,
     marcar pendente, cancelar, **liberar números** e copiar a **mensagem de pagamento**.
   - **Histórico**: registro de todas as operações (auditoria).
   - **Configurações**: foto da Mini, textos, prêmio, **Pix** (chave, titular, QR, copia-e-cola)
     e valor por número — tudo editável sem mexer no código.

---

## 🔒 Regras de segurança implementadas

- **Landing pública**, painel protegido por sessão validada no **backend** (não no frontend).
- **Telefones nunca aparecem** na grade pública.
- **Bloqueio dos números**: um número atribuído some de "disponível" e fica vinculado ao
  participante. **Não pode** ser liberado por clique comum.
- **Liberação exige autorização**: a ação "Solicitar liberação de número" **reconfirma a
  senha administrativa no backend** e exige um **motivo**; tudo é registrado no histórico.
- **Cancelar uma participação não libera** os números automaticamente.
- **Operações atômicas**: a atribuição usa `UPDATE ... WHERE status='disponivel'` com
  conferência da contagem, impedindo que duas pessoas reservem o mesmo número.
- **Pagamento confirmado só manualmente** — nunca há confirmação automática de recebimento.

---

## 🧪 Testes realizados (local)

Fluxo validado de ponta a ponta via API:

- ✅ 100 números carregados; indicadores corretos
- ✅ Reserva pública de múltiplos números + cálculo do total
- ✅ Tentativa de reservar número já ocupado → recusada (HTTP 409)
- ✅ Login (senha certa 200 / errada 401) e proteção das rotas admin (401)
- ✅ Cadastro manual com vários números
- ✅ Confirmação de pagamento → número fica vermelho, arrecadação atualizada
- ✅ Liberação: senha errada 401, sem motivo 400, correta libera e registra no histórico
- ✅ Sincronização da grade pública após cada operação
- ✅ Histórico de auditoria completo

---

## 🎁 Profissional do prêmio

O ensaio fotográfico é oferecido por **Marcela Garrote**. Em todos os pontos onde o prêmio
é divulgado (card da campanha e seção do prêmio), o nome **Marcela Garrote** e o
**@garrotefotografia** são links clicáveis que abrem o perfil oficial em nova aba:
<https://www.instagram.com/garrotefotografia/>. Esses links são fixos no HTML (sempre
aparecem, mesmo que a descrição do prêmio seja editada no painel).

## 🖼️ Foto da Mini

A foto está em `public/img/minnie.jpg`. Para trocar, substitua o arquivo **ou** altere
a URL no painel → Configurações → *Foto da Mini*.

---

## 💡 Notas

- A grade pública se atualiza sozinha a cada **20 segundos** (atualização periódica confiável),
  além de atualizar imediatamente após qualquer operação.
- Os dados ficam no **D1** (persistentes); `localStorage` não é usado como banco.
