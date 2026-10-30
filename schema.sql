-- ============================================================
-- RIFA SOLIDÁRIA DA MINI — Banco de dados (Cloudflare D1 / SQLite)
-- Entidades: PARTICIPANTES · NUMEROS (1..100) · HISTORICO · CONFIG
--
-- Regras de integridade:
--  • Existem exatamente 100 números (01..100), criados no seed.
--  • Um número só pode pertencer a UM participante por vez.
--  • Status do número: 'disponivel' | 'reservado' | 'pago'.
--  • A liberação de um número atribuído exige autorização administrativa
--    (validada no backend) e é registrada no HISTORICO.
-- ============================================================

-- ---------- PARTICIPANTES ----------
-- Cada registro representa uma PARTICIPAÇÃO (pessoa + seus números + pagamento).
-- O status de pagamento vive aqui e é a "fonte da verdade"; os números
-- espelham esse status para leitura rápida da grade pública.
CREATE TABLE IF NOT EXISTS participantes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nome         TEXT    NOT NULL,
  telefone     TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'aguardando', -- aguardando | pago | cancelado
  valor_total  REAL    NOT NULL DEFAULT 0,
  origem       TEXT    NOT NULL DEFAULT 'admin',       -- admin | publico
  transacao_id TEXT,                                   -- identificador de transação (opcional)
  observacao   TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  paid_at      TEXT,                                   -- data/hora da confirmação do pagamento
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_part_status ON participantes(status);
CREATE INDEX IF NOT EXISTS idx_part_nome   ON participantes(nome);

-- ---------- NÚMEROS (01..100) ----------
CREATE TABLE IF NOT EXISTS numeros (
  numero         INTEGER PRIMARY KEY,                  -- 1..100
  status         TEXT    NOT NULL DEFAULT 'disponivel',-- disponivel | reservado | pago
  participante_id INTEGER REFERENCES participantes(id) ON DELETE SET NULL,
  reserved_at    TEXT,
  paid_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_num_status ON numeros(status);
CREATE INDEX IF NOT EXISTS idx_num_part   ON numeros(participante_id);

-- ---------- HISTÓRICO ADMINISTRATIVO (auditoria) ----------
CREATE TABLE IF NOT EXISTS historico (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario              TEXT    NOT NULL DEFAULT 'admin',
  acao                 TEXT    NOT NULL,   -- cadastro | reserva_publica | confirmar_pagamento | cancelar | liberar_numero
  numero               INTEGER,            -- número afetado (quando aplicável)
  participante_anterior TEXT,              -- nome do participante anterior (em liberações)
  participante_atual    TEXT,              -- nome do participante atual/novo
  motivo               TEXT,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hist_data ON historico(created_at);
CREATE INDEX IF NOT EXISTS idx_hist_num  ON historico(numero);

-- ---------- CONFIGURAÇÕES EDITÁVEIS (chave/valor) ----------
-- Guarda textos, imagens (URL ou data URI), dados do Pix e valor do número,
-- evitando deixar fixo no código o que a administradora pode querer mudar.
CREATE TABLE IF NOT EXISTS config (
  chave     TEXT PRIMARY KEY,
  valor     TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- SEED: 100 números (01..100), todos disponíveis.
-- Idempotente — INSERT OR IGNORE não duplica caso já existam.
-- ============================================================
INSERT OR IGNORE INTO numeros (numero, status) VALUES
 (1,'disponivel'),(2,'disponivel'),(3,'disponivel'),(4,'disponivel'),(5,'disponivel'),
 (6,'disponivel'),(7,'disponivel'),(8,'disponivel'),(9,'disponivel'),(10,'disponivel'),
 (11,'disponivel'),(12,'disponivel'),(13,'disponivel'),(14,'disponivel'),(15,'disponivel'),
 (16,'disponivel'),(17,'disponivel'),(18,'disponivel'),(19,'disponivel'),(20,'disponivel'),
 (21,'disponivel'),(22,'disponivel'),(23,'disponivel'),(24,'disponivel'),(25,'disponivel'),
 (26,'disponivel'),(27,'disponivel'),(28,'disponivel'),(29,'disponivel'),(30,'disponivel'),
 (31,'disponivel'),(32,'disponivel'),(33,'disponivel'),(34,'disponivel'),(35,'disponivel'),
 (36,'disponivel'),(37,'disponivel'),(38,'disponivel'),(39,'disponivel'),(40,'disponivel'),
 (41,'disponivel'),(42,'disponivel'),(43,'disponivel'),(44,'disponivel'),(45,'disponivel'),
 (46,'disponivel'),(47,'disponivel'),(48,'disponivel'),(49,'disponivel'),(50,'disponivel'),
 (51,'disponivel'),(52,'disponivel'),(53,'disponivel'),(54,'disponivel'),(55,'disponivel'),
 (56,'disponivel'),(57,'disponivel'),(58,'disponivel'),(59,'disponivel'),(60,'disponivel'),
 (61,'disponivel'),(62,'disponivel'),(63,'disponivel'),(64,'disponivel'),(65,'disponivel'),
 (66,'disponivel'),(67,'disponivel'),(68,'disponivel'),(69,'disponivel'),(70,'disponivel'),
 (71,'disponivel'),(72,'disponivel'),(73,'disponivel'),(74,'disponivel'),(75,'disponivel'),
 (76,'disponivel'),(77,'disponivel'),(78,'disponivel'),(79,'disponivel'),(80,'disponivel'),
 (81,'disponivel'),(82,'disponivel'),(83,'disponivel'),(84,'disponivel'),(85,'disponivel'),
 (86,'disponivel'),(87,'disponivel'),(88,'disponivel'),(89,'disponivel'),(90,'disponivel'),
 (91,'disponivel'),(92,'disponivel'),(93,'disponivel'),(94,'disponivel'),(95,'disponivel'),
 (96,'disponivel'),(97,'disponivel'),(98,'disponivel'),(99,'disponivel'),(100,'disponivel');

-- ============================================================
-- SEED: configurações padrão (editáveis depois no painel).
-- ============================================================
INSERT OR IGNORE INTO config (chave, valor) VALUES
 ('valor_numero', '20'),
 ('total_numeros', '100'),
 ('premio_titulo', 'um ensaio fotográfico!'),
 ('premio_descricao', ''),
 ('apresentacao', 'Estamos realizando esta rifa para ajudar a Minnie em seu tratamento contra a leishmaniose. Cada número adquirido representa uma contribuição importante para que ela tenha acesso à medicação e aos cuidados necessários.\n\nAlém de ajudar a Minnie, você ainda concorre a um ensaio fotográfico!'),
 ('foto_mini', '/img/minnie.jpg'),
 ('pix_chave', ''),
 ('pix_titular', ''),
 ('pix_qrcode', ''),
 ('pix_copiaecola', '');
