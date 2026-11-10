// Favoritos (cliente salva prestadores) e chat entre cliente e prestador

const express = require('express');
const { all, get, run } = require('../db');
const { exigirLogin, exigirTipo } = require('../auth');
const { rota, texto } = require('./util');

const favoritos = express.Router();
const conversas = express.Router();

// =================== Favoritos ===================
favoritos.use(exigirLogin, exigirTipo('contratante'));

// GET /api/favoritos -> prestadores salvos pelo cliente
favoritos.get('/', rota(async (req, res) => {
  res.json(await all(
    `SELECT p.id, p.titulo, p.bairro, p.whatsapp, u.nome, c.nome AS categoria_nome, c.slug AS categoria_slug,
            f.criado_em AS salvo_em,
            (SELECT caminho FROM fotos WHERE prestador_id = p.id ORDER BY ordem, id LIMIT 1) AS capa,
            (SELECT ROUND(AVG(nota), 1) FROM avaliacoes WHERE prestador_id = p.id) AS media_avaliacao,
            (SELECT COUNT(*) FROM avaliacoes WHERE prestador_id = p.id) AS total_avaliacoes
       FROM favoritos f
       JOIN prestadores p ON p.id = f.prestador_id
       JOIN usuarios u    ON u.id = p.usuario_id
       JOIN categorias c  ON c.id = p.categoria_id
      WHERE f.cliente_id = ? AND u.ativo = 1
      ORDER BY f.criado_em DESC`, [req.usuario.id]));
}));

// POST /api/favoritos/:prestadorId
favoritos.post('/:prestadorId', rota(async (req, res) => {
  const p = await get('SELECT id FROM prestadores WHERE id = ?', [req.params.prestadorId]);
  if (!p) return res.status(404).json({ erro: 'Prestador não encontrado.' });
  await run('INSERT OR IGNORE INTO favoritos (cliente_id, prestador_id) VALUES (?, ?)', [req.usuario.id, p.id]);
  res.status(201).json({ ok: true });
}));

// DELETE /api/favoritos/:prestadorId
favoritos.delete('/:prestadorId', rota(async (req, res) => {
  await run('DELETE FROM favoritos WHERE cliente_id = ? AND prestador_id = ?', [req.usuario.id, req.params.prestadorId]);
  res.json({ ok: true });
}));

// =================== Chat ===================
conversas.use(exigirLogin, exigirTipo('contratante', 'prestador'));

// Id do perfil de prestador do usuário logado (ou null se for cliente)
async function meuPrestadorId(usuario) {
  if (usuario.tipo !== 'prestador') return null;
  const p = await get('SELECT id FROM prestadores WHERE usuario_id = ?', [usuario.id]);
  return p ? p.id : null;
}

// Garante que o usuário participa da conversa
async function conversaDoUsuario(req, res) {
  const c = await get('SELECT * FROM conversas WHERE id = ?', [req.params.id]);
  const meuPrestador = await meuPrestadorId(req.usuario);
  if (!c || (c.cliente_id !== req.usuario.id && c.prestador_id !== meuPrestador)) {
    res.status(404).json({ erro: 'Conversa não encontrada.' });
    return null;
  }
  return c;
}

// POST /api/conversas
//   cliente:   { prestador_id }  -> conversa com aquele prestador
//   prestador: { vaga_id }       -> conversa com o cliente dono da vaga
// Se a conversa já existir, devolve a mesma.
conversas.post('/', rota(async (req, res) => {
  let clienteId;
  let prestadorId;

  if (req.usuario.tipo === 'contratante') {
    const p = await get('SELECT id FROM prestadores WHERE id = ?', [req.body.prestador_id]);
    if (!p) return res.status(404).json({ erro: 'Prestador não encontrado.' });
    clienteId = req.usuario.id;
    prestadorId = p.id;
  } else {
    const v = await get('SELECT contratante_id FROM vagas WHERE id = ?', [req.body.vaga_id]);
    if (!v) return res.status(404).json({ erro: 'Vaga não encontrada.' });
    prestadorId = await meuPrestadorId(req.usuario);
    if (!prestadorId) return res.status(400).json({ erro: 'Complete seu perfil de prestador primeiro.' });
    clienteId = v.contratante_id;
  }

  await run('INSERT OR IGNORE INTO conversas (cliente_id, prestador_id) VALUES (?, ?)', [clienteId, prestadorId]);
  const c = await get('SELECT id FROM conversas WHERE cliente_id = ? AND prestador_id = ?', [clienteId, prestadorId]);
  res.status(201).json({ id: c.id });
}));

// GET /api/conversas -> minhas conversas, com última mensagem e não lidas
conversas.get('/', rota(async (req, res) => {
  const meuPrestador = await meuPrestadorId(req.usuario);
  const souCliente = req.usuario.tipo === 'contratante';
  res.json(await all(
    `SELECT c.id,
            ${souCliente ? 'up.nome' : 'uc.nome'} AS com_quem,
            ${souCliente ? 'p.titulo' : "'Cliente'"} AS detalhe,
            p.id AS prestador_id,
            (SELECT texto FROM mensagens m WHERE m.conversa_id = c.id ORDER BY m.id DESC LIMIT 1) AS ultima,
            COALESCE((SELECT MAX(criado_em) FROM mensagens m WHERE m.conversa_id = c.id), c.criado_em) AS atualizado_em,
            (SELECT COUNT(*) FROM mensagens m WHERE m.conversa_id = c.id AND m.autor_id <> ? AND m.lida = 0) AS nao_lidas
       FROM conversas c
       JOIN prestadores p ON p.id = c.prestador_id
       JOIN usuarios up   ON up.id = p.usuario_id
       JOIN usuarios uc   ON uc.id = c.cliente_id
      WHERE ${souCliente ? 'c.cliente_id = ?' : 'c.prestador_id = ?'}
      ORDER BY atualizado_em DESC`,
    [req.usuario.id, souCliente ? req.usuario.id : meuPrestador]
  ));
}));

// GET /api/conversas/nao-lidas -> total para o contador do cabeçalho
conversas.get('/nao-lidas', rota(async (req, res) => {
  const meuPrestador = await meuPrestadorId(req.usuario);
  const { total } = await get(
    `SELECT COUNT(*) AS total FROM mensagens m JOIN conversas c ON c.id = m.conversa_id
      WHERE m.autor_id <> ? AND m.lida = 0 AND (c.cliente_id = ? OR c.prestador_id = ?)`,
    [req.usuario.id, req.usuario.id, meuPrestador ?? -1]
  );
  res.json({ total });
}));

// GET /api/conversas/:id/mensagens?depois=ID -> mensagens novas (e marca como lidas)
conversas.get('/:id/mensagens', rota(async (req, res) => {
  const c = await conversaDoUsuario(req, res);
  if (!c) return;
  const depois = Number(req.query.depois) || 0;
  const lista = await all(
    `SELECT m.id, m.texto, m.criado_em, m.lida, m.autor_id = ? AS minha, u.nome AS autor
       FROM mensagens m JOIN usuarios u ON u.id = m.autor_id
      WHERE m.conversa_id = ? AND m.id > ?
      ORDER BY m.id`, [req.usuario.id, c.id, depois]);
  await run('UPDATE mensagens SET lida = 1 WHERE conversa_id = ? AND autor_id <> ? AND lida = 0', [c.id, req.usuario.id]);
  res.json(lista.map((m) => ({ ...m, minha: !!m.minha })));
}));

// POST /api/conversas/:id/mensagens { texto }
conversas.post('/:id/mensagens', rota(async (req, res) => {
  const c = await conversaDoUsuario(req, res);
  if (!c) return;
  const conteudo = texto(req.body.texto, 1000);
  if (!conteudo) return res.status(400).json({ erro: 'Escreva uma mensagem.' });
  const r = await run('INSERT INTO mensagens (conversa_id, autor_id, texto) VALUES (?, ?, ?)', [c.id, req.usuario.id, conteudo]);
  res.status(201).json(await get('SELECT id, texto, criado_em, 1 AS minha FROM mensagens WHERE id = ?', [r.id]));
}));

module.exports = { favoritos, conversas };
