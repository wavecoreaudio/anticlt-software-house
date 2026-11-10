// Portfólio público de prestadores + área do prestador (perfil e fotos)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { all, get, run } = require('../db');
const { exigirLogin, exigirTipo, lerLoginOpcional } = require('../auth');
const { registrar } = require('../auditoria');
const { validarCamposCategoria } = require('./auth');
const { rota, texto, soDigitos, lerJSON } = require('./util');

const router = express.Router();
const PASTA_UPLOADS = path.join(__dirname, '..', '..', 'public', 'uploads');
const MAX_FOTOS = 8;
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB por foto

// Monta o objeto do prestador com fotos e campos específicos
async function montarPrestadores(linhas) {
  if (linhas.length === 0) return [];
  const ids = linhas.map((l) => l.id);
  const fotos = await all(
    `SELECT id, prestador_id, caminho, legenda FROM fotos
      WHERE prestador_id IN (${ids.map(() => '?').join(',')})
      ORDER BY ordem, id`,
    ids
  );
  return linhas.map((l) => ({
    ...l,
    dados_especificos: lerJSON(l.dados_especificos, {}),
    fotos: fotos.filter((f) => f.prestador_id === l.id),
  }));
}

const SELECT_PRESTADOR = `
  SELECT p.id, p.titulo, p.bio, p.bairro, p.cidade, p.whatsapp, p.instagram,
         p.anos_experiencia, p.dados_especificos, p.criado_em,
         u.nome, c.id AS categoria_id, c.slug AS categoria_slug, c.nome AS categoria_nome,
         (SELECT ROUND(AVG(a.nota), 1) FROM avaliacoes a WHERE a.prestador_id = p.id) AS media_avaliacao,
         (SELECT COUNT(*) FROM avaliacoes a WHERE a.prestador_id = p.id)             AS total_avaliacoes
    FROM prestadores p
    JOIN usuarios u   ON u.id = p.usuario_id
    JOIN categorias c ON c.id = p.categoria_id`;

// Ordenações aceitas na listagem (a chave vem da URL, o valor vai para o SQL)
const ORDENS = {
  recentes: 'p.criado_em DESC',
  avaliacao: 'media_avaliacao IS NULL, media_avaliacao DESC, total_avaliacoes DESC',
  experiencia: 'p.anos_experiencia DESC',
  nome: 'u.nome COLLATE NOCASE',
};

// GET /api/prestadores?categoria=&busca=&bairro=&ordem=&pagina=1&limite=9
// Devolve { itens, total, pagina, paginas, limite } (paginação feita no banco)
router.get('/', lerLoginOpcional, rota(async (req, res) => {
  const filtros = ['u.ativo = 1'];
  const params = [];

  if (req.query.categoria && req.query.categoria !== 'todos') {
    filtros.push('c.slug = ?');
    params.push(req.query.categoria);
  }
  if (req.query.bairro) {
    filtros.push('p.bairro = ?');
    params.push(String(req.query.bairro).slice(0, 80));
  }
  if (req.query.busca) {
    filtros.push('(u.nome LIKE ? OR p.titulo LIKE ? OR p.bairro LIKE ? OR c.nome LIKE ?)');
    const termo = `%${String(req.query.busca).slice(0, 60)}%`;
    params.push(termo, termo, termo, termo);
  }

  const limite = Math.max(1, Math.min(30, Number(req.query.limite) || 9));
  const pagina = Math.max(1, Number(req.query.pagina) || 1);
  const ordem = ORDENS[req.query.ordem] || ORDENS.recentes;
  const onde = filtros.join(' AND ');

  const { total } = await get(
    `SELECT COUNT(*) AS total FROM prestadores p
       JOIN usuarios u ON u.id = p.usuario_id JOIN categorias c ON c.id = p.categoria_id
      WHERE ${onde}`, params);

  const linhas = await all(`${SELECT_PRESTADOR} WHERE ${onde} ORDER BY ${ordem}, p.id DESC LIMIT ? OFFSET ?`,
    [...params, limite, (pagina - 1) * limite]);
  const itens = await montarPrestadores(linhas);

  // Cliente logado: marca quais já estão nos favoritos dele
  if (req.usuario?.tipo === 'contratante' && itens.length) {
    const favs = await all('SELECT prestador_id FROM favoritos WHERE cliente_id = ?', [req.usuario.id]);
    const ids = new Set(favs.map((f) => f.prestador_id));
    itens.forEach((p) => { p.favorito = ids.has(p.id); });
  }

  res.json({ itens, total, pagina, limite, paginas: Math.max(1, Math.ceil(total / limite)) });
}));

// GET /api/prestadores/bairros -> bairros que têm prestador (para o filtro)
router.get('/bairros', rota(async (req, res) => {
  const linhas = await all(`
    SELECT p.bairro, COUNT(*) AS total FROM prestadores p JOIN usuarios u ON u.id = p.usuario_id
     WHERE u.ativo = 1 AND p.bairro IS NOT NULL GROUP BY p.bairro ORDER BY p.bairro`);
  res.json(linhas);
}));

// ---------- Área do prestador logado ----------
// (estas rotas vêm antes de "/:id" para não confundir "eu" com um id)

router.get('/eu/perfil', exigirLogin, exigirTipo('prestador'), rota(async (req, res) => {
  const linha = await get(`${SELECT_PRESTADOR} WHERE p.usuario_id = ?`, [req.usuario.id]);
  if (!linha) return res.status(404).json({ erro: 'Perfil de prestador não encontrado.' });
  const [perfil] = await montarPrestadores([linha]);
  perfil.email = req.usuario.email;
  perfil.telefone = req.usuario.telefone;
  res.json(perfil);
}));

// PUT /api/prestadores/eu/perfil -> atualiza os dados do perfil
router.put('/eu/perfil', exigirLogin, exigirTipo('prestador'), rota(async (req, res) => {
  const atual = await get('SELECT * FROM prestadores WHERE usuario_id = ?', [req.usuario.id]);
  if (!atual) return res.status(404).json({ erro: 'Perfil não encontrado.' });

  const b = req.body;
  const categoriaId = b.categoria_id ? Number(b.categoria_id) : atual.categoria_id;
  if (!(await get('SELECT id FROM categorias WHERE id = ?', [categoriaId]))) {
    return res.status(400).json({ erro: 'Categoria inválida.' });
  }

  let especificos = atual.dados_especificos;
  if (b.dados_especificos || categoriaId !== atual.categoria_id) {
    const v = await validarCamposCategoria(categoriaId, b.dados_especificos || {});
    if (v.erro) return res.status(400).json({ erro: v.erro });
    especificos = JSON.stringify(v.dados);
  }

  await run(
    `UPDATE prestadores SET categoria_id = ?, titulo = ?, bio = ?, bairro = ?, whatsapp = ?,
            instagram = ?, anos_experiencia = ?, dados_especificos = ?
      WHERE id = ?`,
    [
      categoriaId,
      texto(b.titulo, 80) || atual.titulo,
      b.bio !== undefined ? texto(b.bio, 600) : atual.bio,
      b.bairro !== undefined ? texto(b.bairro, 80) : atual.bairro,
      b.whatsapp !== undefined ? soDigitos(b.whatsapp) : atual.whatsapp,
      b.instagram !== undefined ? (texto(b.instagram, 60)?.replace(/^@/, '') || null) : atual.instagram,
      b.anos_experiencia !== undefined ? Math.max(0, Math.min(60, Number(b.anos_experiencia) || 0)) : atual.anos_experiencia,
      especificos,
      atual.id,
    ]
  );
  if (b.nome) await run('UPDATE usuarios SET nome = ? WHERE id = ?', [texto(b.nome, 80), req.usuario.id]);

  const linha = await get(`${SELECT_PRESTADOR} WHERE p.id = ?`, [atual.id]);
  res.json((await montarPrestadores([linha]))[0]);
}));

// POST /api/prestadores/eu/fotos -> recebe a imagem em base64 (data URL)
router.post('/eu/fotos', exigirLogin, exigirTipo('prestador'), rota(async (req, res) => {
  const prestador = await get('SELECT id FROM prestadores WHERE usuario_id = ?', [req.usuario.id]);
  if (!prestador) return res.status(404).json({ erro: 'Perfil não encontrado.' });

  const { total } = await get('SELECT COUNT(*) AS total FROM fotos WHERE prestador_id = ?', [prestador.id]);
  if (total >= MAX_FOTOS) return res.status(400).json({ erro: `Limite de ${MAX_FOTOS} fotos atingido.` });

  const match = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/.exec(req.body.imagem || '');
  if (!match) return res.status(400).json({ erro: 'Envie uma imagem PNG, JPG ou WEBP.' });

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_BYTES) return res.status(400).json({ erro: 'Imagem muito grande (máx. 4 MB).' });

  const extensao = match[1] === 'jpeg' ? 'jpg' : match[1];
  const nomeArquivo = `${crypto.randomUUID()}.${extensao}`;
  fs.mkdirSync(PASTA_UPLOADS, { recursive: true });
  fs.writeFileSync(path.join(PASTA_UPLOADS, nomeArquivo), buffer);

  const r = await run('INSERT INTO fotos (prestador_id, caminho, legenda, ordem) VALUES (?, ?, ?, ?)',
    [prestador.id, `/uploads/${nomeArquivo}`, texto(req.body.legenda, 120), total]);
  res.status(201).json(await get('SELECT * FROM fotos WHERE id = ?', [r.id]));
}));

// DELETE /api/prestadores/eu/fotos/:fotoId
router.delete('/eu/fotos/:fotoId', exigirLogin, exigirTipo('prestador'), rota(async (req, res) => {
  const foto = await get(
    `SELECT f.* FROM fotos f JOIN prestadores p ON p.id = f.prestador_id
      WHERE f.id = ? AND p.usuario_id = ?`,
    [req.params.fotoId, req.usuario.id]
  );
  if (!foto) return res.status(404).json({ erro: 'Foto não encontrada.' });

  await run('DELETE FROM fotos WHERE id = ?', [foto.id]);
  // Só apaga o arquivo se for um upload (as fotos de exemplo ficam)
  if (foto.caminho.startsWith('/uploads/')) {
    fs.rm(path.join(PASTA_UPLOADS, path.basename(foto.caminho)), { force: true }, () => {});
  }
  res.json({ ok: true });
}));

// GET /api/prestadores/eu/interesses -> vagas em que o prestador demonstrou interesse
router.get('/eu/interesses', exigirLogin, exigirTipo('prestador'), rota(async (req, res) => {
  const lista = await all(
    `SELECT i.id, i.criado_em, i.mensagem, v.id AS vaga_id, v.titulo, v.bairro, v.data_servico,
            v.horario, v.status, u.nome AS contratante, u.telefone AS contratante_telefone
       FROM interesses i
       JOIN prestadores p ON p.id = i.prestador_id
       JOIN vagas v       ON v.id = i.vaga_id
       JOIN usuarios u    ON u.id = v.contratante_id
      WHERE p.usuario_id = ?
      ORDER BY i.criado_em DESC`,
    [req.usuario.id]
  );
  res.json(lista);
}));

// GET /api/prestadores/eu/avaliacoes -> avaliações que o prestador recebeu
router.get('/eu/avaliacoes', exigirLogin, exigirTipo('prestador'), rota(async (req, res) => {
  res.json(await all(
    `SELECT a.id, a.nota, a.comentario, a.criado_em, u.nome AS cliente
       FROM avaliacoes a
       JOIN prestadores p ON p.id = a.prestador_id
       JOIN usuarios u    ON u.id = a.cliente_id
      WHERE p.usuario_id = ?
      ORDER BY a.criado_em DESC`, [req.usuario.id]));
}));

// ---------- Avaliações ----------

// GET /api/prestadores/:id/avaliacoes -> lista pública + resumo (média e estrelas)
router.get('/:id/avaliacoes', lerLoginOpcional, rota(async (req, res) => {
  const lista = await all(
    `SELECT a.id, a.nota, a.comentario, a.criado_em, a.cliente_id, u.nome AS cliente
       FROM avaliacoes a JOIN usuarios u ON u.id = a.cliente_id
      WHERE a.prestador_id = ?
      ORDER BY a.criado_em DESC`, [req.params.id]);
  const distribuicao = [5, 4, 3, 2, 1].map((n) => ({ nota: n, total: lista.filter((a) => a.nota === n).length }));
  const media = lista.length ? Math.round((lista.reduce((s, a) => s + a.nota, 0) / lista.length) * 10) / 10 : null;
  const minha = req.usuario ? lista.find((a) => a.cliente_id === req.usuario.id) || null : null;
  res.json({
    media, total: lista.length, distribuicao, minha,
    itens: lista.map(({ cliente_id, ...a }) => ({ ...a, cliente: a.cliente.split(' ')[0] })),
  });
}));

// POST /api/prestadores/:id/avaliacoes { nota, comentario } -> cria ou atualiza (só cliente)
router.post('/:id/avaliacoes', exigirLogin, exigirTipo('contratante'), rota(async (req, res) => {
  const prestador = await get('SELECT id FROM prestadores WHERE id = ?', [req.params.id]);
  if (!prestador) return res.status(404).json({ erro: 'Prestador não encontrado.' });

  const nota = Number(req.body.nota);
  if (!Number.isInteger(nota) || nota < 1 || nota > 5) return res.status(400).json({ erro: 'A nota vai de 1 a 5 estrelas.' });

  await run(
    `INSERT INTO avaliacoes (prestador_id, cliente_id, nota, comentario) VALUES (?, ?, ?, ?)
     ON CONFLICT (prestador_id, cliente_id)
     DO UPDATE SET nota = excluded.nota, comentario = excluded.comentario, criado_em = datetime('now', 'localtime')`,
    [prestador.id, req.usuario.id, nota, texto(req.body.comentario, 500)]
  );
  await registrar(req, 'avaliacao', `Deu ${nota} estrela(s) ao prestador #${prestador.id}`);
  res.status(201).json({ ok: true });
}));

// DELETE /api/prestadores/:id/avaliacoes -> cliente apaga a própria avaliação
router.delete('/:id/avaliacoes', exigirLogin, exigirTipo('contratante'), rota(async (req, res) => {
  const r = await run('DELETE FROM avaliacoes WHERE prestador_id = ? AND cliente_id = ?', [req.params.id, req.usuario.id]);
  if (!r.alteracoes) return res.status(404).json({ erro: 'Você não avaliou esse prestador.' });
  res.json({ ok: true });
}));

// GET /api/prestadores/:id -> perfil público
router.get('/:id', rota(async (req, res) => {
  const linha = await get(`${SELECT_PRESTADOR} WHERE p.id = ? AND u.ativo = 1`, [req.params.id]);
  if (!linha) return res.status(404).json({ erro: 'Prestador não encontrado.' });
  res.json((await montarPrestadores([linha]))[0]);
}));

module.exports = router;
