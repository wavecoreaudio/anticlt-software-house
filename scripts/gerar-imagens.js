// Gera as imagens ilustrativas (SVG) do portfólio de exemplo.
// São imagens fictícias, feitas só para a apresentação.
// Uso: node scripts/gerar-imagens.js

const fs = require('fs');
const path = require('path');
const { ICONES } = require('../public/js/icones.js');

const SAIDA = path.join(__dirname, '..', 'public', 'img', 'portfolio');
fs.mkdirSync(SAIDA, { recursive: true });

const CATEGORIAS = [
  ['eletricista', 'Eletricista', 'raio', '#4a3f1c'],
  ['encanador', 'Encanador', 'gota', '#1b3448'],
  ['pintor', 'Pintor', 'rolo', '#45292b'],
  ['pedreiro', 'Pedreiro', 'tijolo', '#43321f'],
  ['jardinagem', 'Jardinagem', 'folha', '#1d3a26'],
  ['limpeza', 'Limpeza e Diárias', 'brilho', '#2b3445'],
  ['montador', 'Montador de Móveis', 'chave', '#3d2f22'],
  ['ar-condicionado', 'Ar-condicionado', 'floco', '#173a40'],
];

// Fundos diferentes para cada variação de foto
function textura(v) {
  if (v === 1) { // piso em perspectiva
    let l = '';
    for (let i = -8; i <= 8; i++) l += `<line x1="400" y1="560" x2="${400 + i * 120}" y2="1000"/>`;
    for (let y = 600; y < 1000; y += (y - 540) * 0.35) l += `<line x1="0" y1="${y.toFixed(0)}" x2="800" y2="${y.toFixed(0)}"/>`;
    return `<g stroke="#fff" stroke-opacity=".07">${l}</g>`;
  }
  if (v === 2) { // parede de azulejos
    let l = '';
    for (let x = 0; x <= 800; x += 100) l += `<line x1="${x}" y1="0" x2="${x}" y2="1000"/>`;
    for (let y = 0; y <= 1000; y += 100) l += `<line x1="0" y1="${y}" x2="800" y2="${y}"/>`;
    return `<g stroke="#fff" stroke-opacity=".05">${l}</g>`;
  }
  if (v === 3) { // círculos
    let c = '';
    for (let r = 80; r < 900; r += 70) c += `<circle cx="620" cy="300" r="${r}"/>`;
    return `<g fill="none" stroke="#fff" stroke-opacity=".05">${c}</g>`;
  }
  let d = ''; // listras diagonais
  for (let x = -1000; x < 800; x += 46) d += `<line x1="${x}" y1="1000" x2="${x + 1000}" y2="0"/>`;
  return `<g stroke="#fff" stroke-opacity=".04" stroke-width="14">${d}</g>`;
}

const POSICOES = {
  1: { x: 400, y: 380, s: 15, r: 0, luz: '50% 30%' },
  2: { x: 470, y: 470, s: 20, r: -12, luz: '75% 20%' },
  3: { x: 330, y: 420, s: 13, r: 8, luz: '30% 35%' },
  4: { x: 420, y: 520, s: 24, r: 18, luz: '60% 60%' },
};

for (const [slug, nome, icone, tom] of CATEGORIAS) {
  for (let v = 1; v <= 4; v++) {
    const p = POSICOES[v];
    const [lx, ly] = p.luz.split(' ');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <defs>
    <linearGradient id="fundo" x1="0" y1="0" x2="${v % 2 ? 1 : 0}" y2="1">
      <stop offset="0" stop-color="${tom}"/>
      <stop offset="1" stop-color="#0b0b0c"/>
    </linearGradient>
    <radialGradient id="luz" cx="${lx}" cy="${ly}" r="60%">
      <stop offset="0" stop-color="#fff" stop-opacity=".22"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sombra" x1="0" y1="0" x2="0" y2="1">
      <stop offset=".55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".7"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#fundo)"/>
  ${textura(v)}
  <rect width="800" height="1000" fill="url(#luz)"/>
  <g transform="translate(${p.x} ${p.y}) rotate(${p.r}) scale(${p.s}) translate(-12 -12)"
     fill="none" stroke="#f4f4f5" stroke-opacity=".85" stroke-width="${(1.4 / p.s * 10).toFixed(2)}"
     stroke-linecap="round" stroke-linejoin="round">${ICONES[icone].replace(/fill="currentColor"/g, 'fill="#f4f4f5"')}</g>
  <rect width="800" height="1000" fill="url(#sombra)"/>
  <text x="48" y="930" fill="#fff" fill-opacity=".9" font-family="Inter, Arial, sans-serif" font-size="30" font-weight="600" letter-spacing="3">${nome.toUpperCase()}</text>
  <text x="48" y="964" fill="#fff" fill-opacity=".5" font-family="Inter, Arial, sans-serif" font-size="20" letter-spacing="1">imagem ilustrativa · 0${v}</text>
</svg>`;
    fs.writeFileSync(path.join(SAIDA, `${slug}-${v}.svg`), svg);
  }
}
console.log('Imagens geradas em', SAIDA);
