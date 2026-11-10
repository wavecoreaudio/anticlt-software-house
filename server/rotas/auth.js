// Rotas de cadastro, login, logout e "quem sou eu"

const express = require('express');
const { get, run } = require('../db');
const {
  gerarHash, conferirSenha, criarSessao, exigirLogin,
  loginBloqueado, registrarErroLogin, limparErrosLogin,
} = require('../auth');
const { registrar } = require('../auditoria');
const { rota, texto, soDigitos, emailValido, lerJSON } = require('./util');

const router = express.Router();

// Valida as respostas específicas da categoria contra o que está no banco
async function validarCamposCategoria(categoriaId, respostas) {
  const { all } = require('../db');
  const campos = await all(
    'SELECT chave, rotulo, tipo, opcoes, obrigatorio FROM campos_categoria WHERE categoria_id = ?',
    [categoriaId]
  );
  const limpo = {};
  for (const campo of campos) {
    const opcoes = lerJSON(campo.opcoes, []);
    let valor = respostas ? respostas[campo.chave] : undefined;

    if (campo.tipo === 'multipla') {
      valor = Array.isArray(valor) ? valor.filter((v) => opcoes.includes(v)) : [];
      if (campo.obrigatorio && valor.length === 0) return { erro: `Marque ao menos uma opção em "${campo.rotulo}".` };
    } else if (campo.tipo === 'select') {
      valor = opcoes.includes(valor) ? valor : null;
      if (campo.obrigatorio && !valor) return { erro: `Escolha uma opção em "${campo.rotulo}".` };
    } else {
      valor = texto(valor, 200);
      if (campo.obrigatorio && !valor) return { erro: `Preencha "${campo.rotulo}".` };
    }
    limpo[campo.chave] = valor;
  }
  return { dados: limpo };
}

// POST /api/auth/cadastro
// Corpo: { nome, email, senha, tipo, telefone, prestador?: {...} }
router.post('/cadastro', rota(async (req, res) => {
  const nome = texto(req.body.nome, 80);
  const email = texto(req.body.email, 120)?.toLowerCase();
  const senha = String(req.body.senha || '');
  const tipo = req.body.tipo;
  const telefone = soDigitos(req.body.telefone);

  if (!nome) return res.status(400).json({ erro: 'Informe seu nome.' });
  if (!emailValido(email)) return res.status(400).json({ erro: 'E-mail inválido.' });
  if (senha.length < 6) return res.status(400).json({ erro: 'A senha precisa ter pelo menos 6 caracteres.' });
  if (!['prestador', 'contratante'].includes(tipo)) return res.status(400).json({ erro: 'Tipo de conta inválido.' });
  if (req.body.aceitou_termos !== true) return res.status(400).json({ erro: 'Para criar a conta é preciso aceitar os Termos de Uso e a Política de Privacidade.' });

  const existe = await get('SELECT id FROM usuarios WHERE email = ?', [email]);
  if (existe) return res.status(409).json({ erro: 'Já existe uma conta com esse e-mail.' });

  // Se for prestador, valida a parte específica antes de gravar qualquer coisa
  let perfil = null;
  if (tipo === 'prestador') {
    const p = req.body.prestador || {};
    const categoria = await get('SELECT id FROM categorias WHERE id = ?', [Number(p.categoria_id)]);
    if (!categoria) return res.status(400).json({ erro: 'Escolha a área em que você trabalha.' });

    const titulo = texto(p.titulo, 80);
    if (!titulo) return res.status(400).json({ erro: 'Informe um título para o seu perfil.' });

    const especificos = await validarCamposCategoria(categoria.id, p.dados_especificos);
    if (especificos.erro) return res.status(400).json({ erro: especificos.erro });

    perfil = {
      categoria_id: categoria.id,
      titulo,
      bio: texto(p.bio, 600),
      bairro: texto(p.bairro, 80),
      whatsapp: soDigitos(p.whatsapp) || telefone,
      instagram: texto(p.instagram, 60)?.replace(/^@/, '') || null,
      anos_experiencia: Math.max(0, Math.min(60, Number(p.anos_experiencia) || 0)),
      dados_especificos: JSON.stringify(especificos.dados),
    };
  }

  const usuario = await run(
    `INSERT INTO usuarios (nome, email, senha_hash, tipo, telefone, aceitou_termos_em)
     VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
    [nome, email, gerarHash(senha), tipo, telefone]
  );

  if (perfil) {
    await run(
      `INSERT INTO prestadores
        (usuario_id, categoria_id, titulo, bio, bairro, whatsapp, instagram, anos_experiencia, dados_especificos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [usuario.id, perfil.categoria_id, perfil.titulo, perfil.bio, perfil.bairro,
       perfil.whatsapp, perfil.instagram, perfil.anos_experiencia, perfil.dados_especificos]
    );
  }

  await registrar(req, 'cadastro', `Nova conta de ${tipo === 'contratante' ? 'cliente' : 'prestador'}: ${email}`, { id: usuario.id, nome, tipo });
  const token = await criarSessao(usuario.id);
  res.status(201).json({ token, usuario: { id: usuario.id, nome, email, tipo } });
}));

// Cada área de login aceita só um tipo de conta
const AREAS = {
  cliente: { tipo: 'contratante', nome: 'Cliente' },
  prestador: { tipo: 'prestador', nome: 'Prestador' },
  admin: { tipo: 'admin', nome: 'Administração' },
};
const AREA_DO_TIPO = { contratante: 'Cliente', prestador: 'Prestador', admin: 'Administração' };

// POST /api/auth/login  { email, senha, area: 'cliente' | 'prestador' | 'admin' }
router.post('/login', rota(async (req, res) => {
  const email = texto(req.body.email, 120)?.toLowerCase();
  const area = AREAS[req.body.area];
  if (!area) return res.status(400).json({ erro: 'Escolha a área de acesso.' });

  const minutos = loginBloqueado(req, email);
  if (minutos) {
    return res.status(429).json({ erro: `Muitas tentativas erradas. Tente de novo em ${minutos} minuto${minutos > 1 ? 's' : ''}.` });
  }

  const usuario = await get('SELECT * FROM usuarios WHERE email = ?', [email]);

  if (!usuario || !conferirSenha(String(req.body.senha || ''), usuario.senha_hash)) {
    registrarErroLogin(req, email);
    if (area.tipo === 'admin') await registrar(req, 'login_admin_falhou', `Tentativa com ${email}`, null);
    return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
  }
  if (usuario.tipo !== area.tipo) {
    // O admin não é anunciado nas áreas públicas
    if (usuario.tipo === 'admin' || area.tipo === 'admin') {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    }
    return res.status(403).json({ erro: `Esta conta é de ${AREA_DO_TIPO[usuario.tipo]}. Entre pela aba "${AREA_DO_TIPO[usuario.tipo]}".` });
  }
  if (!usuario.ativo) return res.status(403).json({ erro: 'Esta conta foi desativada.' });

  limparErrosLogin(req, email);
  await registrar(req, 'login', `Entrou pela área ${area.nome}`, usuario);
  const token = await criarSessao(usuario.id);
  res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, tipo: usuario.tipo } });
}));

// POST /api/auth/logout
router.post('/logout', exigirLogin, rota(async (req, res) => {
  await run('DELETE FROM sessoes WHERE token = ?', [req.token]);
  res.json({ ok: true });
}));

// GET /api/auth/eu -> dados do usuário logado
router.get('/eu', exigirLogin, rota(async (req, res) => {
  res.json({ usuario: req.usuario });
}));

module.exports = { router, validarCamposCategoria };
