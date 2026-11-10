// Testes automatizados da API (node:test, já vem com o Node — sem biblioteca extra).
// Rodar:  npm test
// Cada execução usa um banco temporário próprio; o banco de verdade (data/anticlt.db) não é tocado.

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const fs = require('fs');
const path = require('path');

// Banco temporário: precisa ser definido ANTES de carregar o db.js
const pastaTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'anticlt-teste-'));
process.env.DB_FILE = path.join(pastaTemp, 'teste.db');

const { iniciarBanco, fechar } = require('../server/db');
const { semear } = require('../server/seed');
const { criarApp } = require('../server/app');

let servidor;
let BASE;

// Faz uma requisição à API e devolve { status, corpo }
async function chamar(metodo, caminho, { corpo, token } = {}) {
  const headers = {};
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(BASE + caminho, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  const texto = await r.text();
  let dados;
  try { dados = JSON.parse(texto); } catch { dados = texto; }
  return { status: r.status, corpo: dados };
}

async function entrar(email, senha, area) {
  const r = await chamar('POST', '/api/auth/login', { corpo: { email, senha, area } });
  assert.equal(r.status, 200, `login de ${email} falhou: ${JSON.stringify(r.corpo)}`);
  return r.corpo.token;
}

before(async () => {
  await iniciarBanco();
  await semear();
  await new Promise((resolve) => {
    servidor = criarApp({ log: false }).listen(0, () => {
      BASE = `http://127.0.0.1:${servidor.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => servidor.close(resolve));
  await fechar();
  fs.rmSync(pastaTemp, { recursive: true, force: true });
});

describe('Autenticação', () => {
  test('cliente entra pela área de cliente', async () => {
    const token = await entrar('contato@mercadinho.exemplo', '123456', 'cliente');
    assert.ok(token.length >= 32);
  });

  test('prestador não entra pela área de cliente', async () => {
    const r = await chamar('POST', '/api/auth/login', { corpo: { email: 'renato.siqueira@email.exemplo', senha: '123456', area: 'cliente' } });
    assert.equal(r.status, 403);
    assert.match(r.corpo.erro, /Prestador/);
  });

  test('admin não é revelado nas áreas públicas', async () => {
    const r = await chamar('POST', '/api/auth/login', { corpo: { email: 'admin@anticlt.local', senha: 'admin123', area: 'prestador' } });
    assert.equal(r.status, 401);
  });

  test('senha errada devolve 401 e 5 erros bloqueiam o login', async () => {
    const corpo = { email: 'luana.ferreira@email.exemplo', senha: 'errada', area: 'prestador' };
    for (let i = 0; i < 5; i++) assert.equal((await chamar('POST', '/api/auth/login', { corpo })).status, 401);
    const bloqueado = await chamar('POST', '/api/auth/login', { corpo: { ...corpo, senha: '123456' } });
    assert.equal(bloqueado.status, 429);
  });

  test('cadastro exige aceitar os termos', async () => {
    const r = await chamar('POST', '/api/auth/cadastro', { corpo: { nome: 'Teste', email: 'teste1@exemplo.com', senha: '123456', tipo: 'contratante' } });
    assert.equal(r.status, 400);
    assert.match(r.corpo.erro, /Termos/);
  });

  test('cadastro de prestador valida os campos específicos da categoria', async () => {
    const base = { nome: 'Novo Eletricista', email: 'novo.eletricista@exemplo.com', senha: '123456', tipo: 'prestador', aceitou_termos: true };
    const semNr10 = await chamar('POST', '/api/auth/cadastro', {
      corpo: { ...base, prestador: { categoria_id: 1, titulo: 'Eletricista', dados_especificos: { area_atuacao: 'Residencial', servicos: ['Iluminação'] } } },
    });
    assert.equal(semNr10.status, 400);

    const ok = await chamar('POST', '/api/auth/cadastro', {
      corpo: { ...base, prestador: { categoria_id: 1, titulo: 'Eletricista', dados_especificos: { area_atuacao: 'Residencial', nr10: 'Sim', servicos: ['Iluminação', 'opção inventada'] } } },
    });
    assert.equal(ok.status, 201);
    const perfil = await chamar('GET', '/api/prestadores/eu/perfil', { token: ok.corpo.token });
    assert.deepEqual(perfil.corpo.dados_especificos.servicos, ['Iluminação']); // opção inválida descartada
  });

  test('e-mail repetido é recusado', async () => {
    const r = await chamar('POST', '/api/auth/cadastro', { corpo: { nome: 'X', email: 'contato@mercadinho.exemplo', senha: '123456', tipo: 'contratante', aceitou_termos: true } });
    assert.equal(r.status, 409);
  });

  test('rota protegida sem token devolve 401', async () => {
    assert.equal((await chamar('GET', '/api/vagas/minhas')).status, 401);
  });
});

describe('Portfólio', () => {
  test('lista é paginada no banco', async () => {
    const r = await chamar('GET', '/api/prestadores?limite=5&pagina=2');
    assert.equal(r.status, 200);
    assert.equal(r.corpo.itens.length, 5);
    assert.equal(r.corpo.pagina, 2);
    assert.ok(r.corpo.paginas >= 4);
  });

  test('filtro por categoria só traz aquela categoria', async () => {
    const r = await chamar('GET', '/api/prestadores?categoria=encanador');
    assert.ok(r.corpo.itens.length > 0);
    assert.ok(r.corpo.itens.every((p) => p.categoria_slug === 'encanador'));
  });

  test('ordenar por avaliação deixa a maior média primeiro', async () => {
    const { corpo } = await chamar('GET', '/api/prestadores?ordem=avaliacao&limite=30');
    const medias = corpo.itens.map((p) => p.media_avaliacao ?? 0);
    assert.deepEqual(medias, [...medias].sort((a, b) => b - a));
  });
});

describe('Vagas (CRUD e permissões)', () => {
  let tokenCliente;
  let tokenPrestador;
  let vagaId;

  before(async () => {
    tokenCliente = await entrar('contato@mercadinho.exemplo', '123456', 'cliente');
    tokenPrestador = await entrar('renato.siqueira@email.exemplo', '123456', 'prestador');
  });

  test('cliente publica vaga', async () => {
    const r = await chamar('POST', '/api/vagas', { token: tokenCliente, corpo: { titulo: 'Vaga de teste', categoria_id: 1, data_servico: '2026-12-20' } });
    assert.equal(r.status, 201);
    vagaId = r.corpo.id;
  });

  test('prestador não consegue editar a vaga de outra pessoa', async () => {
    const r = await chamar('PUT', `/api/vagas/${vagaId}`, { token: tokenPrestador, corpo: { titulo: 'invadido' } });
    assert.equal(r.status, 403);
  });

  test('prestador demonstra interesse só uma vez', async () => {
    assert.equal((await chamar('POST', `/api/vagas/${vagaId}/interesse`, { token: tokenPrestador, corpo: {} })).status, 201);
    assert.equal((await chamar('POST', `/api/vagas/${vagaId}/interesse`, { token: tokenPrestador, corpo: {} })).status, 409);
  });

  test('cliente encerra e exclui a vaga', async () => {
    const encerrada = await chamar('PUT', `/api/vagas/${vagaId}`, { token: tokenCliente, corpo: { status: 'encerrada' } });
    assert.equal(encerrada.corpo.status, 'encerrada');
    assert.equal((await chamar('DELETE', `/api/vagas/${vagaId}`, { token: tokenCliente })).status, 200);
  });
});

describe('Avaliações, favoritos e chat', () => {
  let tokenCliente;
  let tokenPrestador;

  before(async () => {
    tokenCliente = await entrar('sindico@condominioipe.exemplo', '123456', 'cliente');
    tokenPrestador = await entrar('renato.siqueira@email.exemplo', '123456', 'prestador');
  });

  test('cliente avalia e a segunda avaliação substitui a primeira', async () => {
    await chamar('POST', '/api/prestadores/5/avaliacoes', { token: tokenCliente, corpo: { nota: 3 } });
    await chamar('POST', '/api/prestadores/5/avaliacoes', { token: tokenCliente, corpo: { nota: 5, comentario: 'Mudei de ideia' } });
    const r = await chamar('GET', '/api/prestadores/5/avaliacoes', { token: tokenCliente });
    assert.equal(r.corpo.minha.nota, 5);
  });

  test('nota fora de 1 a 5 é recusada e prestador não avalia', async () => {
    assert.equal((await chamar('POST', '/api/prestadores/5/avaliacoes', { token: tokenCliente, corpo: { nota: 9 } })).status, 400);
    assert.equal((await chamar('POST', '/api/prestadores/5/avaliacoes', { token: tokenPrestador, corpo: { nota: 5 } })).status, 403);
  });

  test('favoritar aparece na lista e no portfólio', async () => {
    await chamar('POST', '/api/favoritos/4', { token: tokenCliente });
    const favs = await chamar('GET', '/api/favoritos', { token: tokenCliente });
    assert.ok(favs.corpo.some((p) => p.id === 4));
    await chamar('DELETE', '/api/favoritos/4', { token: tokenCliente });
    const depois = await chamar('GET', '/api/favoritos', { token: tokenCliente });
    assert.ok(!depois.corpo.some((p) => p.id === 4));
  });

  test('chat: cliente abre conversa, prestador recebe e lê', async () => {
    const conversa = await chamar('POST', '/api/conversas', { token: tokenCliente, corpo: { prestador_id: 1 } });
    await chamar('POST', `/api/conversas/${conversa.corpo.id}/mensagens`, { token: tokenCliente, corpo: { texto: 'Olá, tudo bem?' } });

    const antes = await chamar('GET', '/api/conversas/nao-lidas', { token: tokenPrestador });
    assert.ok(antes.corpo.total >= 1);

    const msgs = await chamar('GET', `/api/conversas/${conversa.corpo.id}/mensagens`, { token: tokenPrestador });
    assert.equal(msgs.corpo.at(-1).texto, 'Olá, tudo bem?');

    const conversaDeOutro = await chamar('GET', '/api/conversas/1/mensagens', { token: tokenCliente });
    assert.equal(conversaDeOutro.status, 404); // conversa do seed é de outro cliente
  });
});

describe('Administração', () => {
  let tokenAdmin;
  before(async () => { tokenAdmin = await entrar('admin@anticlt.local', 'admin123', 'admin'); });

  test('dashboard traz os totais', async () => {
    const r = await chamar('GET', '/api/dashboard?dias=30', { token: tokenAdmin });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.cadastros_por_dia.length, 30);
    assert.ok(r.corpo.totais.prestadores >= 16);
  });

  test('cliente não acessa a dashboard', async () => {
    const tokenCliente = await entrar('contato@mercadinho.exemplo', '123456', 'cliente');
    assert.equal((await chamar('GET', '/api/dashboard', { token: tokenCliente })).status, 403);
  });

  test('exportação CSV sai com cabeçalho e separador ";"', async () => {
    const r = await chamar('GET', '/api/dashboard/exportar/usuarios', { token: tokenAdmin });
    assert.equal(r.status, 200);
    assert.match(r.corpo, /ID;Nome;E-mail;Tipo/);
  });

  test('ações do admin ficam na auditoria', async () => {
    const r = await chamar('GET', '/api/dashboard/auditoria?acao=exportar_csv', { token: tokenAdmin });
    assert.ok(r.corpo.total >= 1);
  });

  test('categoria em uso não pode ser excluída', async () => {
    assert.equal((await chamar('DELETE', '/api/categorias/1', { token: tokenAdmin })).status, 409);
  });
});
