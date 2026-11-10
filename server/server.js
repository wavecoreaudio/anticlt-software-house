// =============================================================
// ANTI CLT Web System - servidor
// Node.js + Express servindo a API (/api/...) e o front (pasta public)
// Para rodar:  npm install  ->  npm start
// =============================================================

const { iniciarBanco, get } = require('./db');
const { semear } = require('./seed');
const { limparSessoesVencidas } = require('./auth');
const { criarApp } = require('./app');

// Porta 3001 para não brigar com outros projetos que usam a 3000
const PORTA = Number(process.env.PORT) || 3001;

(async () => {
  await iniciarBanco();
  await limparSessoesVencidas();

  // Banco vazio? Coloca os dados de exemplo automaticamente
  const { total } = await get('SELECT COUNT(*) AS total FROM categorias');
  if (total === 0) {
    console.log('Banco vazio: inserindo dados de exemplo...');
    await semear();
  }

  const app = criarApp();
  const servidor = app.listen(PORTA, () => {
    console.log(`\n  ANTI CLT rodando em http://localhost:${PORTA}`);
    console.log(`  Administração:      http://localhost:${PORTA}/admin`);
    console.log(`  Documentação da API: http://localhost:${PORTA}/docs\n`);
  });

  // Porta ocupada: explica o que fazer em vez de mostrar o erro cru
  servidor.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n  A porta ${PORTA} já está em uso por outro programa.`);
      console.error('  Feche o outro servidor ou escolha outra porta, por exemplo:');
      console.error('    Windows (cmd):  set PORT=3002 && npm start');
      console.error('    PowerShell:     $env:PORT=3002; npm start\n');
      process.exit(1);
    }
    throw err;
  });
})();
