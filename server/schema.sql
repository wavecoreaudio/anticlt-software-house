-- =============================================================
-- ANTI CLT Web System - estrutura do banco (SQLite3)
-- O arquivo do banco fica em data/anticlt.db e é criado sozinho
-- na primeira vez que o servidor sobe.
-- =============================================================

PRAGMA foreign_keys = ON;

-- Todas as contas do sistema: prestador, contratante ou admin
CREATE TABLE IF NOT EXISTS usuarios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT    NOT NULL,
  email       TEXT    NOT NULL UNIQUE,
  senha_hash  TEXT    NOT NULL,              -- formato salt:hash (scrypt)
  tipo        TEXT    NOT NULL CHECK (tipo IN ('prestador', 'contratante', 'admin')),
  telefone    TEXT,
  ativo       INTEGER NOT NULL DEFAULT 1,
  aceitou_termos_em TEXT,                    -- LGPD: quando aceitou os termos
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Sessões de login (token enviado no cabeçalho Authorization)
CREATE TABLE IF NOT EXISTS sessoes (
  token       TEXT PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Categorias de serviço (abas do portfólio)
CREATE TABLE IF NOT EXISTS categorias (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  nome        TEXT    NOT NULL,
  descricao   TEXT,
  icone       TEXT    -- nome do ícone desenhado no front (ver js/icones.js)
);

-- Perguntas específicas do cadastro de cada categoria.
-- Ex.: o eletricista informa área de atuação e se tem NR-10.
CREATE TABLE IF NOT EXISTS campos_categoria (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria_id  INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  chave         TEXT    NOT NULL,
  rotulo        TEXT    NOT NULL,
  tipo          TEXT    NOT NULL CHECK (tipo IN ('texto', 'select', 'multipla')),
  opcoes        TEXT,                        -- JSON com a lista de opções
  obrigatorio   INTEGER NOT NULL DEFAULT 0,
  ordem         INTEGER NOT NULL DEFAULT 0
);

-- Perfil público do prestador (aparece no portfólio)
CREATE TABLE IF NOT EXISTS prestadores (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id         INTEGER NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  categoria_id       INTEGER NOT NULL REFERENCES categorias(id),
  titulo             TEXT    NOT NULL,       -- ex.: "Eletricista residencial"
  bio                TEXT,
  bairro             TEXT,
  cidade             TEXT    NOT NULL DEFAULT 'Porto Velho - RO',
  whatsapp           TEXT,
  instagram          TEXT,
  anos_experiencia   INTEGER DEFAULT 0,
  dados_especificos  TEXT,                   -- JSON com as respostas de campos_categoria
  criado_em          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Fotos do carrossel de cada prestador
CREATE TABLE IF NOT EXISTS fotos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  prestador_id  INTEGER NOT NULL REFERENCES prestadores(id) ON DELETE CASCADE,
  caminho       TEXT    NOT NULL,
  legenda       TEXT,
  ordem         INTEGER NOT NULL DEFAULT 0
);

-- Vagas de diária publicadas por contratantes
CREATE TABLE IF NOT EXISTS vagas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  contratante_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  categoria_id    INTEGER NOT NULL REFERENCES categorias(id),
  titulo          TEXT    NOT NULL,
  descricao       TEXT,
  bairro          TEXT,
  cidade          TEXT    NOT NULL DEFAULT 'Porto Velho - RO',
  data_servico    TEXT,
  horario         TEXT,
  status          TEXT    NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'encerrada')),
  criado_em       TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Prestador que demonstrou interesse numa vaga
CREATE TABLE IF NOT EXISTS interesses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  vaga_id       INTEGER NOT NULL REFERENCES vagas(id) ON DELETE CASCADE,
  prestador_id  INTEGER NOT NULL REFERENCES prestadores(id) ON DELETE CASCADE,
  mensagem      TEXT,
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (vaga_id, prestador_id)
);

-- Registro de procura: alimenta o "serviços mais procurados" da dashboard
CREATE TABLE IF NOT EXISTS acessos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria_id  INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  prestador_id  INTEGER REFERENCES prestadores(id) ON DELETE SET NULL,
  tipo          TEXT    NOT NULL CHECK (tipo IN ('busca', 'visualizacao', 'contato')),
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ---------------- Versão 2 ----------------

-- Avaliação (1 a 5 estrelas) que um cliente dá a um prestador.
-- Cada cliente avalia cada prestador uma vez (pode editar depois).
CREATE TABLE IF NOT EXISTS avaliacoes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  prestador_id  INTEGER NOT NULL REFERENCES prestadores(id) ON DELETE CASCADE,
  cliente_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nota          INTEGER NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario    TEXT,
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (prestador_id, cliente_id)
);

-- Prestadores que o cliente salvou
CREATE TABLE IF NOT EXISTS favoritos (
  cliente_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  prestador_id  INTEGER NOT NULL REFERENCES prestadores(id) ON DELETE CASCADE,
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  PRIMARY KEY (cliente_id, prestador_id)
);

-- Chat: uma conversa por par cliente + prestador
CREATE TABLE IF NOT EXISTS conversas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  prestador_id  INTEGER NOT NULL REFERENCES prestadores(id) ON DELETE CASCADE,
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (cliente_id, prestador_id)
);

CREATE TABLE IF NOT EXISTS mensagens (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  conversa_id   INTEGER NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
  autor_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  texto         TEXT    NOT NULL,
  lida          INTEGER NOT NULL DEFAULT 0,
  criado_em     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Registro de ações importantes (quem fez o quê e quando)
CREATE TABLE IF NOT EXISTS auditoria (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  usuario     TEXT,                          -- nome guardado mesmo se a conta for apagada
  acao        TEXT    NOT NULL,
  detalhe     TEXT,
  ip          TEXT,
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa   ON mensagens(conversa_id, id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_prestador ON avaliacoes(prestador_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_data       ON auditoria(criado_em);
CREATE INDEX IF NOT EXISTS idx_prestadores_categoria ON prestadores(categoria_id);
CREATE INDEX IF NOT EXISTS idx_vagas_categoria      ON vagas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_acessos_categoria    ON acessos(categoria_id, tipo);
