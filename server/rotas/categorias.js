// CRUD de categorias (leitura pública, escrita só do admin)

const express = require('express');
const { all, get, run } = require('../db');
const { exigirLogin, exigirTipo } = require('../auth');
const { rota, texto, lerJSON } = require('./util');
const { registrar } = require('../auditoria');

const router = express.Router();

// GET /api/categorias -> lista com a quantidade de prestadores e vagas abertas
router.get('/', rota(async (req, res) => {
  const categorias = await all(`
    SELECT c.*,
           (SELECT COUNT(*) FROM prestadores p JOIN usuarios u ON u.id = p.usuario_id
             WHERE p.categoria_id = c.id AND u.ativo = 1) AS total_prestadores,
           (SELECT COUNT(*) FROM vagas v WHERE v.categoria_id = c.id AND v.status = 'aberta') AS vagas_abertas
      FROM categorias c
     ORDER BY c.nome`);
  res.json(categorias);
}));

// GET /api/categorias/:id/campos -> perguntas específicas do cadastro
router.get('/:id/campos', rota(async (req, res) => {
  const campos = await all(
    'SELECT id, chave, rotulo, tipo, opcoes, obrigatorio FROM campos_categoria WHERE categoria_id = ? ORDER BY ordem',
    [req.params.id]
  );
  res.json(campos.map((c) => ({ ...c, opcoes: lerJSON(c.opcoes, []), obrigatorio: !!c.obrigatorio })));
}));

// A partir daqui, só admin
router.use(exigirLogin, exigirTipo('admin'));

function slugify(nome) {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// POST /api/categorias
router.post('/', rota(async (req, res) => {
  const nome = texto(req.body.nome, 60);
  if (!nome) return res.status(400).json({ erro: 'Informe o nome da categoria.' });
  const slug = slugify(nome);
  if (await get('SELECT id FROM categorias WHERE slug = ?', [slug])) {
    return res.status(409).json({ erro: 'Essa categoria já existe.' });
  }
  const r = await run('INSERT INTO categorias (slug, nome, descricao, icone) VALUES (?, ?, ?, ?)',
    [slug, nome, texto(req.body.descricao, 200), texto(req.body.icone, 30) || 'ferramenta']);
  await registrar(req, 'admin_criou_categoria', nome);
  res.status(201).json(await get('SELECT * FROM categorias WHERE id = ?', [r.id]));
}));

// PUT /api/categorias/:id
router.put('/:id', rota(async (req, res) => {
  const atual = await get('SELECT * FROM categorias WHERE id = ?', [req.params.id]);
  if (!atual) return res.status(404).json({ erro: 'Categoria não encontrada.' });
  const nome = texto(req.body.nome, 60) || atual.nome;
  await run('UPDATE categorias SET nome = ?, descricao = ? WHERE id = ?',
    [nome, texto(req.body.descricao, 200) ?? atual.descricao, atual.id]);
  await registrar(req, 'admin_editou_categoria', nome);
  res.json(await get('SELECT * FROM categorias WHERE id = ?', [atual.id]));
}));

// DELETE /api/categorias/:id (bloqueia se ainda tiver prestador ou vaga)
router.delete('/:id', rota(async (req, res) => {
  const uso = await get(`
    SELECT (SELECT COUNT(*) FROM prestadores WHERE categoria_id = ?) +
           (SELECT COUNT(*) FROM vagas WHERE categoria_id = ?) AS total`, [req.params.id, req.params.id]);
  if (uso.total > 0) {
    return res.status(409).json({ erro: 'Não dá para excluir: há prestadores ou vagas nessa categoria.' });
  }
  const alvo = await get('SELECT nome FROM categorias WHERE id = ?', [req.params.id]);
  if (!alvo) return res.status(404).json({ erro: 'Categoria não encontrada.' });
  await run('DELETE FROM categorias WHERE id = ?', [req.params.id]);
  await registrar(req, 'admin_excluiu_categoria', alvo.nome);
  res.json({ ok: true });
}));

module.exports = router;
