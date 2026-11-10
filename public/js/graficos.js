// Gráficos em SVG feitos à mão (sem biblioteca externa).
// Uma série por gráfico, barras finas com ponta arredondada,
// grade discreta e dica (tooltip) ao passar o mouse.

function escalaBonita(maximo, passos = 4) {
  if (maximo <= 0) return { topo: passos, passo: 1 };
  const bruto = maximo / passos;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 5, 10].map((m) => m * potencia).find((v) => v >= bruto);
  return { topo: Math.ceil(maximo / passo) * passo, passo };
}

// Caminho de uma barra com cantos arredondados só na ponta (a base fica reta)
function caminhoBarraVertical(x, y, l, a, r = 4) {
  if (a <= 0) return '';
  r = Math.min(r, l / 2, a);
  return `M${x},${y + a}V${y + r}Q${x},${y} ${x + r},${y}H${x + l - r}Q${x + l},${y} ${x + l},${y + r}V${y + a}Z`;
}
function caminhoBarraHorizontal(x, y, l, a, r = 4) {
  if (l <= 0) return '';
  r = Math.min(r, a / 2, l);
  return `M${x},${y}H${x + l - r}Q${x + l},${y} ${x + l},${y + r}V${y + a - r}Q${x + l},${y + a} ${x + l - r},${y + a}H${x}Z`;
}

function ligarDica(container) {
  let dica = container.querySelector('.dica-grafico');
  if (!dica) {
    dica = document.createElement('div');
    dica.className = 'dica-grafico oculto';
    container.appendChild(dica);
  }
  container.querySelectorAll('[data-dica]').forEach((alvo) => {
    const barra = alvo.nextElementSibling;
    alvo.addEventListener('mouseenter', () => {
      const caixa = container.getBoundingClientRect();
      const b = barra.getBoundingClientRect();
      dica.innerHTML = alvo.dataset.dica;
      dica.style.left = `${b.left - caixa.left + b.width / 2}px`;
      dica.style.top = `${b.top - caixa.top}px`;
      dica.classList.remove('oculto');
      barra.classList.add('realce');
    });
    alvo.addEventListener('mouseleave', () => {
      dica.classList.add('oculto');
      barra.classList.remove('realce');
    });
  });
}

// Barras verticais: [{ rotulo, valor, dica }]
function graficoColunas(container, dados, { altura = 250 } = {}) {
  const largura = Math.max(320, container.clientWidth || 640); // desenha no tamanho real (texto 1:1)
  const m = { topo: 10, dir: 8, base: 26, esq: 30 };
  const areaL = largura - m.esq - m.dir;
  const areaA = altura - m.topo - m.base;
  const { topo, passo } = escalaBonita(Math.max(...dados.map((d) => d.valor), 1));
  const slot = areaL / dados.length;
  const larguraBarra = Math.max(3, Math.min(18, slot - 2)); // 2px de respiro entre barras
  const y = (v) => m.topo + areaA - (v / topo) * areaA;
  const cadaQuantos = Math.ceil(dados.length / 7);

  let svg = `<svg viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Gráfico de colunas">`;
  for (let v = 0; v <= topo; v += passo) {
    svg += `<line class="grade-linha" x1="${m.esq}" x2="${largura - m.dir}" y1="${y(v)}" y2="${y(v)}"/>`;
    svg += `<g class="eixo"><text x="${m.esq - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text></g>`;
  }
  dados.forEach((d, i) => {
    const x = m.esq + i * slot + (slot - larguraBarra) / 2;
    svg += `<rect class="barra-alvo" data-dica="${esc(d.dica)}" x="${m.esq + i * slot}" y="${m.topo}" width="${slot}" height="${areaA}"/>`;
    svg += `<path class="barra" d="${caminhoBarraVertical(x, y(d.valor), larguraBarra, areaA + m.topo - y(d.valor))}"/>`;
    if (i % cadaQuantos === 0 || i === dados.length - 1) {
      svg += `<g class="eixo"><text x="${x + larguraBarra / 2}" y="${altura - 6}" text-anchor="middle">${esc(d.rotulo)}</text></g>`;
    }
  });
  svg += '</svg>';
  container.innerHTML = svg;
  ligarDica(container);
}

// Barras horizontais com rótulo da categoria e valor: [{ rotulo, valor, dica }]
function graficoBarras(container, dados) {
  const largura = Math.max(280, container.clientWidth || 520);
  const alturaBarra = 12;
  const linha = 30;
  const m = { esq: Math.min(160, largura * 0.46), dir: 40, topo: 4 };
  const altura = m.topo + dados.length * linha;
  const max = Math.max(...dados.map((d) => d.valor), 1);
  const areaL = largura - m.esq - m.dir;

  let svg = `<svg viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Gráfico de barras">`;
  dados.forEach((d, i) => {
    const yb = m.topo + i * linha + (linha - alturaBarra) / 2;
    const l = (d.valor / max) * areaL;
    svg += `<text class="rotulo-cat" x="0" y="${yb + alturaBarra - 2}">${esc(d.rotulo)}</text>`;
    svg += `<rect class="barra-alvo" data-dica="${esc(d.dica)}" x="${m.esq}" y="${m.topo + i * linha}" width="${areaL + m.dir}" height="${linha}"/>`;
    svg += `<path class="barra" d="${caminhoBarraHorizontal(m.esq, yb, Math.max(l, 2), alturaBarra)}"/>`;
    svg += `<text class="rotulo-valor" x="${m.esq + Math.max(l, 2) + 8}" y="${yb + alturaBarra - 2}">${d.valor}</text>`;
  });
  svg += '</svg>';
  container.innerHTML = svg;
  ligarDica(container);
}
