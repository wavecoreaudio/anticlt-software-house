// Autenticação: hash de senha com scrypt (nativo do Node, sem
// dependência extra) e sessões guardadas na tabela "sessoes".

const crypto = require('crypto');
const { get, run } = require('./db');

const DIAS_SESSAO = 7; // depois disso o usuário precisa entrar de novo

function gerarHash(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(senha, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function conferirSenha(senha, salvo) {
  const [salt, hash] = String(salvo).split(':');
  if (!salt || !hash) return false;
  const teste = crypto.scryptSync(senha, salt, 64);
  const original = Buffer.from(hash, 'hex');
  return original.length === teste.length && crypto.timingSafeEqual(original, teste);
}

async function criarSessao(usuarioId) {
  const token = crypto.randomBytes(32).toString('hex');
  await run('INSERT INTO sessoes (token, usuario_id) VALUES (?, ?)', [token, usuarioId]);
  return token;
}

function lerToken(req) {
  const cabecalho = req.headers.authorization || '';
  return cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : null;
}

// Busca o usuário dono de um token ainda válido
function usuarioDoToken(token) {
  return get(
    `SELECT u.id, u.nome, u.email, u.tipo, u.telefone, u.ativo
       FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token = ? AND s.criado_em >= datetime('now', 'localtime', ?)`,
    [token, `-${DIAS_SESSAO} days`]
  );
}

// Middleware: só deixa passar quem está logado.
// Coloca o usuário em req.usuario para as rotas usarem.
async function exigirLogin(req, res, next) {
  try {
    const token = lerToken(req);
    if (!token) return res.status(401).json({ erro: 'Faça login para continuar.' });

    const usuario = await usuarioDoToken(token);
    if (!usuario) return res.status(401).json({ erro: 'Sessão expirada. Entre novamente.' });
    if (!usuario.ativo) return res.status(403).json({ erro: 'Conta desativada.' });

    req.usuario = usuario;
    req.token = token;
    next();
  } catch (err) {
    next(err);
  }
}

// Apaga sessões vencidas (chamado quando o servidor sobe)
function limparSessoesVencidas() {
  return run("DELETE FROM sessoes WHERE criado_em < datetime('now', 'localtime', ?)", [`-${DIAS_SESSAO} days`]);
}

// ---------- Limite de tentativas de login (contra força bruta) ----------
// Guardado em memória: 5 erros em 15 minutos bloqueiam aquele e-mail + IP por 15 minutos.
const MAX_TENTATIVAS = 5;
const JANELA_MS = 15 * 60 * 1000;
const tentativas = new Map();

function chaveTentativa(req, email) {
  return `${req.ip || req.socket?.remoteAddress || ''}|${email}`;
}
function loginBloqueado(req, email) {
  const t = tentativas.get(chaveTentativa(req, email));
  if (!t) return 0;
  if (Date.now() - t.inicio > JANELA_MS) { tentativas.delete(chaveTentativa(req, email)); return 0; }
  return t.erros >= MAX_TENTATIVAS ? Math.ceil((t.inicio + JANELA_MS - Date.now()) / 60000) : 0;
}
function registrarErroLogin(req, email) {
  const chave = chaveTentativa(req, email);
  const t = tentativas.get(chave);
  if (!t || Date.now() - t.inicio > JANELA_MS) tentativas.set(chave, { erros: 1, inicio: Date.now() });
  else t.erros++;
}
function limparErrosLogin(req, email) {
  tentativas.delete(chaveTentativa(req, email));
}

// Middleware: restringe a rota a um ou mais tipos de usuário
function exigirTipo(...tipos) {
  return (req, res, next) => {
    if (!req.usuario || !tipos.includes(req.usuario.tipo)) {
      return res.status(403).json({ erro: 'Você não tem permissão para isso.' });
    }
    next();
  };
}

// Middleware opcional: se tiver token válido, preenche req.usuario; se não, segue sem
async function lerLoginOpcional(req, res, next) {
  try {
    const token = lerToken(req);
    if (token) {
      const usuario = await usuarioDoToken(token);
      if (usuario && usuario.ativo) req.usuario = usuario;
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  gerarHash, conferirSenha, criarSessao, exigirLogin, exigirTipo, lerLoginOpcional,
  limparSessoesVencidas, loginBloqueado, registrarErroLogin, limparErrosLogin,
};
