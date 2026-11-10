// Registro de auditoria: guarda ações importantes na tabela "auditoria".
// Nunca derruba a requisição se falhar.

const { run } = require('./db');

async function registrar(req, acao, detalhe = null, usuario = req.usuario) {
  try {
    await run('INSERT INTO auditoria (usuario_id, usuario, acao, detalhe, ip) VALUES (?, ?, ?, ?, ?)', [
      usuario?.id || null,
      usuario ? `${usuario.nome} (${usuario.tipo === 'contratante' ? 'cliente' : usuario.tipo})` : null,
      acao,
      detalhe,
      req.ip || req.socket?.remoteAddress || null,
    ]);
  } catch (err) {
    console.error('Falha ao registrar auditoria:', err.message);
  }
}

module.exports = { registrar };
