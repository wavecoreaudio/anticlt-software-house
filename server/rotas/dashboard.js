// Registro de procura (público) + números da dashboard e gestão de usuários (admin)

const express = require('express');
const { all, get, run } = require('../db');
const { exigirLogin, exigirTipo, gerarHash, conferirSenha } = require('../auth');
const { rota, texto, soDigitos } = require('./util');
const { registrar } = require('../auditoria');

const acessos = express.Router();
const dashboard = express.Router();
const conta = express.Router();

// ---------------- Acessos ----------------
// POST /api/acessos { tipo: 'busca' | 'visualizacao' | 'contato', categoria?, prestador_id? }
acessos.post('/', rota(async (req, res) => {
  const tipo = req.body.tipo;
  if (!['busca', 'visualizacao', 'contato'].includes(tipo)) return res.status(400).json({ erro: 'Tipo inválido.' });

  let categoriaId = null;
  if (req.body.categoria) {
    const c = await get('SELECT id FROM categorias WHERE slug = ? OR id = ?', [req.body.categoria, req.body.categoria]);
    categoriaId = c ? c.id : null;
  }
  let prestadorId = null;
  if (req.body.prestador_id) {
    const p = await get('SELECT id, categoria_id FROM prestadores WHERE id = ?', [req.body.prestador_id]);
    if (p) { prestadorId = p.id; categoriaId = categoriaId || p.categoria_id; }
  }
  if (!categoriaId && !prestadorId) return res.json({ ok: true }); // "Todos": não conta

  await run('INSERT INTO acessos (categoria_id, prestador_id, tipo) VALUES (?, ?, ?)', [categoriaId, prestadorId, tipo]);
  res.status(201).json({ ok: true });
}));

// ---------------- Dashboard (admin) ----------------
dashboard.use(exigirLogin, exigirTipo('admin'));

// GET /api/dashboard?dias=30
dashboard.get('/', rota(async (req, res) => {
  const dias = Math.max(7, Math.min(90, Number(req.query.dias) || 30));
  const desde = `-${dias - 1} days`;

  const totais = await get(`
    SELECT
      (SELECT COUNT(*) FROM usuarios WHERE tipo <> 'admin')                       AS usuarios,
      (SELECT COUNT(*) FROM usuarios WHERE tipo = 'prestador')                    AS prestadores,
      (SELECT COUNT(*) FROM usuarios WHERE tipo = 'contratante')                  AS contratantes,
      (SELECT COUNT(*) FROM vagas WHERE status = 'aberta')                        AS vagas_abertas,
      (SELECT COUNT(*) FROM vagas)                                                AS vagas_total,
      (SELECT COUNT(*) FROM interesses)                                           AS interesses,
      (SELECT COUNT(*) FROM avaliacoes)                                           AS avaliacoes,
      (SELECT ROUND(AVG(nota), 1) FROM avaliacoes)                                AS media_geral,
      (SELECT COUNT(*) FROM mensagens
          WHERE date(criado_em) >= date('now', 'localtime', ?))                   AS mensagens_periodo,
      (SELECT COUNT(*) FROM usuarios WHERE tipo <> 'admin'
          AND date(criado_em) >= date('now', 'localtime', ?))                     AS novos_periodo,
      (SELECT COUNT(*) FROM acessos WHERE tipo = 'contato'
          AND date(criado_em) >= date('now', 'localtime', ?))                     AS contatos_periodo`,
    [desde, desde, desde]);

  // Cadastros por dia, preenchendo os dias sem cadastro com zero
  const porDia = await all(`
    SELECT date(criado_em) AS dia,
           SUM(tipo = 'prestador')   AS prestadores,
           SUM(tipo = 'contratante') AS contratantes
      FROM usuarios
     WHERE tipo <> 'admin' AND date(criado_em) >= date('now', 'localtime', ?)
     GROUP BY dia`, [desde]);
  const mapa = Object.fromEntries(porDia.map((d) => [d.dia, d]));
  const cadastros_por_dia = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const linha = mapa[dia] || {};
    cadastros_por_dia.push({ dia, prestadores: linha.prestadores || 0, contratantes: linha.contratantes || 0 });
  }

  // Serviços mais procurados no período (buscas + visualizações + contatos)
  const procura = await all(`
    SELECT c.id, c.nome, c.slug,
           SUM(a.tipo = 'busca')        AS buscas,
           SUM(a.tipo = 'visualizacao') AS visualizacoes,
           SUM(a.tipo = 'contato')      AS contatos,
           COUNT(a.id)                  AS total
      FROM categorias c
      LEFT JOIN acessos a ON a.categoria_id = c.id AND date(a.criado_em) >= date('now', 'localtime', ?)
     GROUP BY c.id
     ORDER BY total DESC, c.nome`, [desde]);

  const por_categoria = await all(`
    SELECT c.nome, c.slug,
           (SELECT COUNT(*) FROM prestadores p WHERE p.categoria_id = c.id) AS prestadores,
           (SELECT COUNT(*) FROM vagas v WHERE v.categoria_id = c.id AND v.status = 'aberta') AS vagas_abertas,
           (SELECT COUNT(*) FROM interesses i JOIN vagas v ON v.id = i.vaga_id WHERE v.categoria_id = c.id) AS interesses
      FROM categorias c
     ORDER BY prestadores DESC, c.nome`);

  const ultimas_inscricoes = await all(`
    SELECT u.id, u.nome, u.email, u.tipo, u.criado_em, u.ativo, c.nome AS categoria
      FROM usuarios u
      LEFT JOIN prestadores p ON p.usuario_id = u.id
      LEFT JOIN categorias c  ON c.id = p.categoria_id
     WHERE u.tipo <> 'admin'
     ORDER BY u.criado_em DESC, u.id DESC
     LIMIT 8`);

  const prestadores_mais_vistos = await all(`
    SELECT p.id, u.nome, c.nome AS categoria, COUNT(a.id) AS visualizacoes,
           SUM(a.tipo = 'contato') AS contatos
      FROM acessos a
      JOIN prestadores p ON p.id = a.prestador_id
      JOIN usuarios u    ON u.id = p.usuario_id
      JOIN categorias c  ON c.id = p.categoria_id
     WHERE date(a.criado_em) >= date('now', 'localtime', ?)
     GROUP BY p.id
     ORDER BY visualizacoes DESC
     LIMIT 5`, [desde]);

  const melhores_avaliados = await all(`
    SELECT p.id, u.nome, c.nome AS categoria, ROUND(AVG(a.nota), 1) AS media, COUNT(a.id) AS avaliacoes
      FROM avaliacoes a
      JOIN prestadores p ON p.id = a.prestador_id
      JOIN usuarios u    ON u.id = p.usuario_id
      JOIN categorias c  ON c.id = p.categoria_id
     GROUP BY p.id
     ORDER BY media DESC, avaliacoes DESC
     LIMIT 5`);

  res.json({ dias, totais, cadastros_por_dia, procura, por_categoria, ultimas_inscricoes, prestadores_mais_vistos, melhores_avaliados });
}));

// ---------- Exportar CSV (abre no Excel) ----------
function paraCSV(cabecalho, linhas) {
  const celula = (v) => {
    const t = v === null || v === undefined ? '' : String(v);
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  // ";" é o separador que o Excel em português espera; o \uFEFF faz os acentos abrirem certo
  return '\uFEFF' + [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n');
}

// Cada coluna tem apelido próprio (c1, c2...) para nomes iguais não se sobreporem
const EXPORTACOES = {
  usuarios: {
    arquivo: 'inscricoes',
    cabecalho: ['ID', 'Nome', 'E-mail', 'Tipo', 'Telefone', 'Área', 'Situação', 'Cadastro'],
    sql: `SELECT u.id AS c1, u.nome AS c2, u.email AS c3, CASE u.tipo WHEN 'contratante' THEN 'cliente' ELSE u.tipo END AS c4,
                 u.telefone AS c5, c.nome AS c6, CASE u.ativo WHEN 1 THEN 'ativo' ELSE 'desativado' END AS c7, u.criado_em AS c8
            FROM usuarios u LEFT JOIN prestadores p ON p.usuario_id = u.id LEFT JOIN categorias c ON c.id = p.categoria_id
           WHERE u.tipo <> 'admin' ORDER BY u.criado_em DESC`,
  },
  procura: {
    arquivo: 'servicos-mais-procurados',
    cabecalho: ['Categoria', 'Buscas', 'Visualizações', 'Contatos', 'Total'],
    sql: `SELECT c.nome AS c1, SUM(a.tipo = 'busca') AS c2, SUM(a.tipo = 'visualizacao') AS c3,
                 SUM(a.tipo = 'contato') AS c4, COUNT(a.id) AS c5
            FROM categorias c LEFT JOIN acessos a ON a.categoria_id = c.id
           GROUP BY c.id ORDER BY COUNT(a.id) DESC`,
  },
  vagas: {
    arquivo: 'vagas',
    cabecalho: ['ID', 'Título', 'Categoria', 'Cliente', 'Bairro', 'Data', 'Horário', 'Situação', 'Interessados', 'Publicada em'],
    sql: `SELECT v.id AS c1, v.titulo AS c2, c.nome AS c3, u.nome AS c4, v.bairro AS c5, v.data_servico AS c6,
                 v.horario AS c7, v.status AS c8, (SELECT COUNT(*) FROM interesses i WHERE i.vaga_id = v.id) AS c9, v.criado_em AS c10
            FROM vagas v JOIN categorias c ON c.id = v.categoria_id JOIN usuarios u ON u.id = v.contratante_id
           ORDER BY v.criado_em DESC`,
  },
};

// GET /api/dashboard/exportar/:tipo  (usuarios | procura | vagas)
dashboard.get('/exportar/:tipo', rota(async (req, res) => {
  const exp = EXPORTACOES[req.params.tipo];
  if (!exp) return res.status(404).json({ erro: 'Relatório não encontrado.' });
  const linhas = (await all(exp.sql)).map((l) => Object.values(l));
  await registrar(req, 'exportar_csv', `Relatório: ${exp.arquivo}`);
  const data = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="anticlt-${exp.arquivo}-${data}.csv"`);
  res.send(paraCSV(exp.cabecalho, linhas));
}));

// GET /api/dashboard/auditoria?acao=&pagina=1 -> registro de ações
dashboard.get('/auditoria', rota(async (req, res) => {
  const limite = 25;
  const pagina = Math.max(1, Number(req.query.pagina) || 1);
  const filtros = [];
  const params = [];
  if (req.query.acao) { filtros.push('acao = ?'); params.push(req.query.acao); }
  const onde = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
  const { total } = await get(`SELECT COUNT(*) AS total FROM auditoria ${onde}`, params);
  const itens = await all(`SELECT * FROM auditoria ${onde} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, limite, (pagina - 1) * limite]);
  const acoes = await all('SELECT acao, COUNT(*) AS total FROM auditoria GROUP BY acao ORDER BY acao');
  res.json({ itens, total, pagina, paginas: Math.max(1, Math.ceil(total / limite)), acoes });
}));

// GET /api/dashboard/usuarios?tipo=&busca=
dashboard.get('/usuarios', rota(async (req, res) => {
  const filtros = ["u.tipo <> 'admin'"];
  const params = [];
  if (['prestador', 'contratante'].includes(req.query.tipo)) { filtros.push('u.tipo = ?'); params.push(req.query.tipo); }
  if (req.query.busca) {
    filtros.push('(u.nome LIKE ? OR u.email LIKE ?)');
    params.push(`%${req.query.busca}%`, `%${req.query.busca}%`);
  }
  res.json(await all(`
    SELECT u.id, u.nome, u.email, u.tipo, u.telefone, u.ativo, u.criado_em, c.nome AS categoria
      FROM usuarios u
      LEFT JOIN prestadores p ON p.usuario_id = u.id
      LEFT JOIN categorias c  ON c.id = p.categoria_id
     WHERE ${filtros.join(' AND ')}
     ORDER BY u.criado_em DESC`, params));
}));

// PATCH /api/dashboard/usuarios/:id { ativo: true|false }
dashboard.patch('/usuarios/:id', rota(async (req, res) => {
  const ativo = req.body.ativo ? 1 : 0;
  const r = await run("UPDATE usuarios SET ativo = ? WHERE id = ? AND tipo <> 'admin'", [ativo, req.params.id]);
  if (!r.alteracoes) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  if (!ativo) await run('DELETE FROM sessoes WHERE usuario_id = ?', [req.params.id]);
  const alvo = await get('SELECT email FROM usuarios WHERE id = ?', [req.params.id]);
  await registrar(req, ativo ? 'admin_ativou_usuario' : 'admin_desativou_usuario', alvo?.email);
  res.json({ ok: true });
}));

// DELETE /api/dashboard/usuarios/:id
dashboard.delete('/usuarios/:id', rota(async (req, res) => {
  const alvo = await get("SELECT email FROM usuarios WHERE id = ? AND tipo <> 'admin'", [req.params.id]);
  if (!alvo) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  await run('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
  await registrar(req, 'admin_excluiu_usuario', alvo.email);
  res.json({ ok: true });
}));

// ---------------- Minha conta (qualquer usuário logado) ----------------
conta.use(exigirLogin);

// PUT /api/conta { nome?, telefone?, senha_atual?, nova_senha? }
conta.put('/', rota(async (req, res) => {
  const nome = texto(req.body.nome, 80) || req.usuario.nome;
  const telefone = req.body.telefone !== undefined ? soDigitos(req.body.telefone) : req.usuario.telefone;
  await run('UPDATE usuarios SET nome = ?, telefone = ? WHERE id = ?', [nome, telefone, req.usuario.id]);

  if (req.body.nova_senha) {
    const u = await get('SELECT senha_hash FROM usuarios WHERE id = ?', [req.usuario.id]);
    if (!conferirSenha(String(req.body.senha_atual || ''), u.senha_hash)) {
      return res.status(400).json({ erro: 'Senha atual incorreta.' });
    }
    if (String(req.body.nova_senha).length < 6) return res.status(400).json({ erro: 'A nova senha precisa ter 6 caracteres ou mais.' });
    await run('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [gerarHash(String(req.body.nova_senha)), req.usuario.id]);
    // Troca de senha derruba as outras sessões abertas
    await run('DELETE FROM sessoes WHERE usuario_id = ? AND token <> ?', [req.usuario.id, req.token]);
    await registrar(req, 'trocou_senha');
  }
  res.json({ ok: true, usuario: { ...req.usuario, nome, telefone } });
}));

// DELETE /api/conta -> exclui a própria conta (e tudo ligado a ela, via ON DELETE CASCADE)
// GET /api/conta/dados -> LGPD: baixa uma cópia de todos os dados da própria conta
conta.get('/dados', rota(async (req, res) => {
  const id = req.usuario.id;
  const usuario = await get('SELECT id, nome, email, tipo, telefone, criado_em, aceitou_termos_em FROM usuarios WHERE id = ?', [id]);
  const perfil = await get('SELECT * FROM prestadores WHERE usuario_id = ?', [id]);
  const dados = {
    gerado_em: new Date().toISOString(),
    usuario,
    perfil_prestador: perfil || null,
    fotos: perfil ? await all('SELECT caminho, legenda FROM fotos WHERE prestador_id = ?', [perfil.id]) : [],
    vagas_publicadas: await all('SELECT * FROM vagas WHERE contratante_id = ?', [id]),
    interesses: perfil ? await all('SELECT * FROM interesses WHERE prestador_id = ?', [perfil.id]) : [],
    avaliacoes_feitas: await all('SELECT prestador_id, nota, comentario, criado_em FROM avaliacoes WHERE cliente_id = ?', [id]),
    avaliacoes_recebidas: perfil ? await all('SELECT nota, comentario, criado_em FROM avaliacoes WHERE prestador_id = ?', [perfil.id]) : [],
    favoritos: await all('SELECT prestador_id, criado_em FROM favoritos WHERE cliente_id = ?', [id]),
    mensagens_enviadas: await all('SELECT conversa_id, texto, criado_em FROM mensagens WHERE autor_id = ?', [id]),
  };
  await registrar(req, 'baixou_dados_lgpd');
  res.setHeader('Content-Disposition', `attachment; filename="meus-dados-anticlt.json"`);
  res.json(dados);
}));

conta.delete('/', rota(async (req, res) => {
  if (req.usuario.tipo === 'admin') return res.status(400).json({ erro: 'A conta de administrador não pode ser excluída.' });
  await registrar(req, 'excluiu_propria_conta', req.usuario.email);
  await run('DELETE FROM usuarios WHERE id = ?', [req.usuario.id]);
  res.json({ ok: true });
}));

module.exports = { acessos, dashboard, conta };
