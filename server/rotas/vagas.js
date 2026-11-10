// Vagas de diária: listagem pública, CRUD do contratante e interesse do prestador

const express = require('express');
const { all, get, run } = require('../db');
const { exigirLogin, exigirTipo } = require('../auth');
const { rota, texto } = require('./util');
const { registrar } = require('../auditoria');

const router = express.Router();

const SELECT_VAGA = `
  SELECT v.*, c.nome AS categoria_nome, c.slug AS categoria_slug,
         u.nome AS contratante,
         (SELECT COUNT(*) FROM interesses i WHERE i.vaga_id = v.id) AS total_interessados
    FROM vagas v
    JOIN categorias c ON c.id = v.categoria_id
    JOIN usuarios u   ON u.id = v.contratante_id`;

function lerVaga(body) {
  return {
    categoria_id: Number(body.categoria_id),
    titulo: texto(body.titulo, 100),
    descricao: texto(body.descricao, 1000),
    bairro: texto(body.bairro, 80),
    data_servico: /^\d{4}-\d{2}-\d{2}$/.test(body.data_servico || '') ? body.data_servico : null,
    horario: texto(body.horario, 40),
  };
}

// GET /api/vagas?categoria=slug&status=aberta
router.get('/', rota(async (req, res) => {
  const filtros = ['u.ativo = 1'];
  const params = [];
  filtros.push('v.status = ?');
  params.push(req.query.status === 'encerrada' ? 'encerrada' : 'aberta');
  if (req.query.categoria && req.query.categoria !== 'todos') {
    filtros.push('c.slug = ?');
    params.push(req.query.categoria);
  }
  res.json(await all(`${SELECT_VAGA} WHERE ${filtros.join(' AND ')} ORDER BY v.data_servico, v.criado_em DESC`, params));
}));

// GET /api/vagas/minhas -> vagas do contratante logado
router.get('/minhas', exigirLogin, exigirTipo('contratante'), rota(async (req, res) => {
  res.json(await all(`${SELECT_VAGA} WHERE v.contratante_id = ? ORDER BY v.criado_em DESC`, [req.usuario.id]));
}));

// POST /api/vagas -> publicar
router.post('/', exigirLogin, exigirTipo('contratante'), rota(async (req, res) => {
  const vaga = lerVaga(req.body);
  if (!vaga.titulo) return res.status(400).json({ erro: 'Informe o título da vaga.' });
  if (!(await get('SELECT id FROM categorias WHERE id = ?', [vaga.categoria_id]))) {
    return res.status(400).json({ erro: 'Escolha a categoria do serviço.' });
  }
  const r = await run(
    `INSERT INTO vagas (contratante_id, categoria_id, titulo, descricao, bairro, data_servico, horario)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.usuario.id, vaga.categoria_id, vaga.titulo, vaga.descricao, vaga.bairro, vaga.data_servico, vaga.horario]
  );
  await registrar(req, 'publicou_vaga', vaga.titulo);
  res.status(201).json(await get(`${SELECT_VAGA} WHERE v.id = ?`, [r.id]));
}));

// Confere se a vaga pertence ao contratante logado (admin pode tudo)
async function vagaDoUsuario(req, res) {
  const vaga = await get('SELECT * FROM vagas WHERE id = ?', [req.params.id]);
  if (!vaga) { res.status(404).json({ erro: 'Vaga não encontrada.' }); return null; }
  if (vaga.contratante_id !== req.usuario.id && req.usuario.tipo !== 'admin') {
    res.status(403).json({ erro: 'Essa vaga não é sua.' });
    return null;
  }
  return vaga;
}

// PUT /api/vagas/:id -> editar ou encerrar/reabrir
router.put('/:id', exigirLogin, exigirTipo('contratante', 'admin'), rota(async (req, res) => {
  const atual = await vagaDoUsuario(req, res);
  if (!atual) return;
  const nova = lerVaga({ ...atual, ...req.body });
  const status = ['aberta', 'encerrada'].includes(req.body.status) ? req.body.status : atual.status;
  await run(
    `UPDATE vagas SET categoria_id = ?, titulo = ?, descricao = ?, bairro = ?, data_servico = ?,
            horario = ?, status = ? WHERE id = ?`,
    [nova.categoria_id, nova.titulo || atual.titulo, nova.descricao, nova.bairro,
     nova.data_servico, nova.horario, status, atual.id]
  );
  res.json(await get(`${SELECT_VAGA} WHERE v.id = ?`, [atual.id]));
}));

// DELETE /api/vagas/:id
router.delete('/:id', exigirLogin, exigirTipo('contratante', 'admin'), rota(async (req, res) => {
  const atual = await vagaDoUsuario(req, res);
  if (!atual) return;
  await run('DELETE FROM vagas WHERE id = ?', [atual.id]);
  await registrar(req, 'excluiu_vaga', atual.titulo);
  res.json({ ok: true });
}));

// GET /api/vagas/:id/interessados -> só o dono da vaga vê
router.get('/:id/interessados', exigirLogin, exigirTipo('contratante', 'admin'), rota(async (req, res) => {
  const vaga = await vagaDoUsuario(req, res);
  if (!vaga) return;
  res.json(await all(
    `SELECT i.id, i.mensagem, i.criado_em, p.id AS prestador_id, p.titulo, p.whatsapp, p.instagram,
            p.bairro, u.nome
       FROM interesses i
       JOIN prestadores p ON p.id = i.prestador_id
       JOIN usuarios u    ON u.id = p.usuario_id
      WHERE i.vaga_id = ?
      ORDER BY i.criado_em DESC`,
    [vaga.id]
  ));
}));

// POST /api/vagas/:id/interesse -> prestador demonstra interesse
router.post('/:id/interesse', exigirLogin, exigirTipo('prestador'), rota(async (req, res) => {
  const vaga = await get('SELECT id, status FROM vagas WHERE id = ?', [req.params.id]);
  if (!vaga) return res.status(404).json({ erro: 'Vaga não encontrada.' });
  if (vaga.status !== 'aberta') return res.status(400).json({ erro: 'Essa vaga já foi encerrada.' });

  const prestador = await get('SELECT id FROM prestadores WHERE usuario_id = ?', [req.usuario.id]);
  if (!prestador) return res.status(400).json({ erro: 'Complete seu perfil de prestador primeiro.' });

  const ja = await get('SELECT id FROM interesses WHERE vaga_id = ? AND prestador_id = ?', [vaga.id, prestador.id]);
  if (ja) return res.status(409).json({ erro: 'Você já demonstrou interesse nessa vaga.' });

  await run('INSERT INTO interesses (vaga_id, prestador_id, mensagem) VALUES (?, ?, ?)',
    [vaga.id, prestador.id, texto(req.body.mensagem, 300)]);
  res.status(201).json({ ok: true });
}));

// DELETE /api/vagas/:id/interesse -> prestador desiste
router.delete('/:id/interesse', exigirLogin, exigirTipo('prestador'), rota(async (req, res) => {
  const r = await run(
    `DELETE FROM interesses WHERE vaga_id = ?
        AND prestador_id = (SELECT id FROM prestadores WHERE usuario_id = ?)`,
    [req.params.id, req.usuario.id]
  );
  if (!r.alteracoes) return res.status(404).json({ erro: 'Interesse não encontrado.' });
  res.json({ ok: true });
}));

module.exports = router;
