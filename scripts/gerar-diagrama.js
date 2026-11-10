// Gera o diagrama do banco (modelo ER) em SVG a partir do schema.sql.
// Lê as tabelas, colunas e chaves estrangeiras de verdade (PRAGMA do SQLite).
// Uso: node scripts/gerar-diagrama.js   (precisa do Node 22.5 ou mais novo, por causa do node:sqlite)

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(':memory:');
db.exec(fs.readFileSync(path.join(__dirname, '..', 'server', 'schema.sql'), 'utf8'));

// Posição de cada tabela no desenho (coluna do grid)
const COLUNAS = [
  ['categorias', 'campos_categoria', 'acessos'],
  ['prestadores', 'fotos', 'avaliacoes'],
  ['usuarios', 'sessoes', 'favoritos', 'auditoria'],
  ['vagas', 'interesses', 'conversas', 'mensagens'],
];
const LARGURA = 250;
const ESPACO_X = 70;
const LINHA = 21;
const CABECALHO = 34;
const ESPACO_Y = 44;
const MARGEM = 30;

const caixas = {};
COLUNAS.forEach((tabelas, c) => {
  let y = MARGEM + 40;
  for (const t of tabelas) {
    const colunas = db.prepare(`PRAGMA table_info(${t})`).all();
    const fks = db.prepare(`PRAGMA foreign_key_list(${t})`).all();
    const altura = CABECALHO + colunas.length * LINHA + 8;
    caixas[t] = { x: MARGEM + c * (LARGURA + ESPACO_X), y, altura, colunas, fks };
    y += altura + ESPACO_Y;
  }
});

const larguraTotal = MARGEM * 2 + COLUNAS.length * LARGURA + (COLUNAS.length - 1) * ESPACO_X;
const alturaTotal = Math.max(...Object.values(caixas).map((b) => b.y + b.altura)) + MARGEM;
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

let linhas = '';
let tabelasSvg = '';

for (const [nome, b] of Object.entries(caixas)) {
  // Ligações (chave estrangeira -> tabela referenciada)
  for (const fk of b.fks) {
    const alvo = caixas[fk.table];
    const i = b.colunas.findIndex((c) => c.name === fk.from);
    const y1 = b.y + CABECALHO + i * LINHA + LINHA / 2;
    const y2 = alvo.y + CABECALHO / 2;
    let x1;
    let x2;
    if (alvo.x > b.x) { x1 = b.x + LARGURA; x2 = alvo.x; }
    else if (alvo.x < b.x) { x1 = b.x; x2 = alvo.x + LARGURA; }
    else { x1 = b.x + LARGURA; x2 = alvo.x + LARGURA; } // mesma coluna: contorna pela direita
    const curva = alvo.x === b.x ? 40 : Math.abs(x2 - x1) / 2;
    const c1 = alvo.x >= b.x ? x1 + curva : x1 - curva;
    const c2 = alvo.x > b.x ? x2 - curva : x2 + curva;
    linhas += `<path d="M${x1},${y1} C${c1},${y1} ${c2},${y2} ${x2},${y2}" fill="none" stroke="#9a9aa2" stroke-width="1.3"/>`;
    linhas += `<circle cx="${x1}" cy="${y1}" r="3" fill="#0a0a0b"/>`;
    linhas += `<path d="M${x2},${y2 - 5} l${alvo.x >= b.x && alvo.x !== b.x ? 7 : -7},5 l${alvo.x >= b.x && alvo.x !== b.x ? -7 : 7},5" fill="none" stroke="#0a0a0b" stroke-width="1.3"/>`;
  }

  // Caixa da tabela
  tabelasSvg += `<g>
    <rect x="${b.x}" y="${b.y}" width="${LARGURA}" height="${b.altura}" rx="10" fill="#fff" stroke="#0a0a0b" stroke-width="1.3"/>
    <path d="M${b.x},${b.y + CABECALHO} V${b.y + 10} Q${b.x},${b.y} ${b.x + 10},${b.y} H${b.x + LARGURA - 10} Q${b.x + LARGURA},${b.y} ${b.x + LARGURA},${b.y + 10} V${b.y + CABECALHO} Z" fill="#0a0a0b"/>
    <text x="${b.x + 14}" y="${b.y + 22}" fill="#fff" font-size="14" font-weight="600">${esc(nome)}</text>`;
  b.colunas.forEach((c, i) => {
    const y = b.y + CABECALHO + i * LINHA + 15;
    const ehFk = b.fks.some((f) => f.from === c.name);
    const marca = c.pk ? 'PK' : ehFk ? 'FK' : '';
    tabelasSvg += `
    <text x="${b.x + 14}" y="${y}" font-size="12" fill="#0a0a0b" font-weight="${c.pk ? 600 : 400}">${esc(c.name)}</text>
    <text x="${b.x + LARGURA - 50}" y="${y}" font-size="10.5" fill="#71717a" text-anchor="end">${esc((c.type || '').toLowerCase())}</text>
    ${marca ? `<text x="${b.x + LARGURA - 14}" y="${y}" font-size="10" font-weight="700" fill="${c.pk ? '#0a0a0b' : '#71717a'}" text-anchor="end">${marca}</text>` : ''}`;
  });
  tabelasSvg += '</g>';
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${larguraTotal} ${alturaTotal}" width="${larguraTotal}" height="${alturaTotal}" font-family="Inter, Segoe UI, Arial, sans-serif">
  <rect width="100%" height="100%" fill="#fff"/>
  <text x="${MARGEM}" y="${MARGEM + 6}" font-size="18" font-weight="600" fill="#0a0a0b">ANTI CLT Web System — modelo do banco (SQLite3)</text>
  <text x="${larguraTotal - MARGEM}" y="${MARGEM + 6}" font-size="12" fill="#71717a" text-anchor="end">PK = chave primária · FK = chave estrangeira · seta aponta para a tabela referenciada</text>
  ${linhas}
  ${tabelasSvg}
</svg>`;

const destinos = [
  path.join(__dirname, '..', 'docs', 'modelo-er.svg'),
  path.join(__dirname, '..', 'public', 'img', 'modelo-er.svg'),
];
for (const d of destinos) {
  fs.mkdirSync(path.dirname(d), { recursive: true });
  fs.writeFileSync(d, svg);
}
console.log('Diagrama gerado:', destinos.join(' e '));
