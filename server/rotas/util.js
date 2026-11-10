// Funções pequenas usadas por várias rotas

// Repassa erros de funções async para o tratador de erros do Express
const rota = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Limpa texto vindo de formulário (corta espaços e limita tamanho)
function texto(valor, max = 500) {
  if (valor === undefined || valor === null) return null;
  const limpo = String(valor).trim().slice(0, max);
  return limpo === '' ? null : limpo;
}

// Deixa só os dígitos do telefone
function soDigitos(valor) {
  return valor ? String(valor).replace(/\D/g, '').slice(0, 13) : null;
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}

function lerJSON(valor, padrao) {
  try {
    return valor ? JSON.parse(valor) : padrao;
  } catch {
    return padrao;
  }
}

module.exports = { rota, texto, soDigitos, emailValido, lerJSON };
