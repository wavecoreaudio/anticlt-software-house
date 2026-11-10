// Monta o app Express (rotas da API + arquivos do front).
// Fica separado do server.js para os testes automatizados
// poderem subir o app numa porta qualquer.

const path = require('path');
const express = require('express');

const { router: rotasAuth } = require('./rotas/auth');
const rotasCategorias = require('./rotas/categorias');
const rotasPrestadores = require('./rotas/prestadores');
const rotasVagas = require('./rotas/vagas');
const { acessos, dashboard, conta } = require('./rotas/dashboard');
const { favoritos, conversas } = require('./rotas/social');
const { ROTAS_DOCUMENTADAS } = require('./docs');

function criarApp({ log = true } = {}) {
  const app = express();

  // JSON com limite maior por causa do envio de fotos em base64
  app.use(express.json({ limit: '6mb' }));

  // Cabeçalhos básicos de segurança
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });

  // Log simples das requisições da API no terminal
  if (log) {
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) console.log(`${new Date().toLocaleTimeString('pt-BR')}  ${req.method} ${req.path}`);
      next();
    });
  }

  // ---------- API ----------
  app.use('/api/auth', rotasAuth);
  app.use('/api/categorias', rotasCategorias);
  app.use('/api/prestadores', rotasPrestadores);
  app.use('/api/vagas', rotasVagas);
  app.use('/api/acessos', acessos);
  app.use('/api/dashboard', dashboard);
  app.use('/api/conta', conta);
  app.use('/api/favoritos', favoritos);
  app.use('/api/conversas', conversas);

  // Documentação da API em JSON (a página /docs lê daqui)
  app.get('/api/docs', (req, res) => res.json(ROTAS_DOCUMENTADAS));

  // Rota de API que não existe
  app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

  // ---------- Front-end (arquivos estáticos) ----------
  app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

  // Tratador de erros: nunca devolve detalhes internos para o navegador
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ erro: 'Arquivo grande demais.' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' });
    console.error(err);
    res.status(500).json({ erro: 'Erro interno no servidor.' });
  });

  return app;
}

module.exports = { criarApp };
