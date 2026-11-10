// Conexão com o SQLite3 e funções auxiliares com Promise.
// O pacote sqlite3 trabalha com callbacks; aqui transformamos em
// async/await para deixar as rotas mais fáceis de ler.

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const PASTA_DADOS = path.join(__dirname, '..', 'data');
const ARQUIVO_DB = process.env.DB_FILE || path.join(PASTA_DADOS, 'anticlt.db');

fs.mkdirSync(path.dirname(ARQUIVO_DB), { recursive: true });

const db = new sqlite3.Database(ARQUIVO_DB);

// INSERT / UPDATE / DELETE -> devolve { id, alteracoes }
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, alteracoes: this.changes });
    });
  });
}

// SELECT que devolve uma linha só (ou undefined)
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, linha) => (err ? reject(err) : resolve(linha)));
  });
}

// SELECT que devolve uma lista
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, linhas) => (err ? reject(err) : resolve(linhas)));
  });
}

// Executa vários comandos de uma vez (usado para criar as tabelas)
function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => (err ? reject(err) : resolve()));
  });
}

// Colunas adicionadas depois da primeira versão.
// Bancos antigos recebem a coluna sem precisar apagar os dados.
const MIGRACOES = [
  ['usuarios', 'aceitou_termos_em', 'TEXT'],
];

// Cria as tabelas se ainda não existirem e aplica as migrações
async function iniciarBanco() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await exec(schema);
  for (const [tabela, coluna, tipo] of MIGRACOES) {
    const colunas = await all(`PRAGMA table_info(${tabela})`);
    if (!colunas.some((c) => c.name === coluna)) {
      await exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${tipo}`);
      console.log(`Migração: coluna ${tabela}.${coluna} criada.`);
    }
  }
  await exec('PRAGMA foreign_keys = ON;');
}

function fechar() {
  return new Promise((resolve) => db.close(() => resolve()));
}

module.exports = { db, run, get, all, exec, iniciarBanco, fechar, ARQUIVO_DB };
