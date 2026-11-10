// Carrossel de fotos estilo Instagram (arrastar, setas e bolinhas).
// Usa scroll-snap do CSS; o JS só cuida das setas, pontos e contador.

function htmlCarrossel(fotos, alt = '') {
  const lista = fotos && fotos.length ? fotos : [{ caminho: '/img/sem-foto.svg', legenda: 'Sem fotos' }];
  return `
    <div class="carrossel" data-carrossel>
      <div class="carrossel__trilho" tabindex="0" aria-label="Fotos de ${esc(alt)}">
        ${lista.map((f, i) => `<img src="${esc(f.caminho)}" alt="${esc(f.legenda || alt)} (${i + 1} de ${lista.length})" loading="lazy" draggable="false">`).join('')}
      </div>
      ${lista.length > 1 ? `
        <button class="carrossel__seta carrossel__seta--esq" aria-label="Foto anterior" disabled>${icone('esquerda')}</button>
        <button class="carrossel__seta carrossel__seta--dir" aria-label="Próxima foto">${icone('direita')}</button>
        <div class="carrossel__pontos">${lista.map((_, i) => `<span class="${i === 0 ? 'ativo' : ''}"></span>`).join('')}</div>
        <span class="carrossel__contador">1/${lista.length}</span>` : ''}
    </div>`;
}

// Liga os eventos de todos os carrosséis dentro de "raiz"
function ativarCarrosseis(raiz = document, aoTrocar) {
  raiz.querySelectorAll('[data-carrossel]:not([data-pronto])').forEach((el) => {
    el.dataset.pronto = '1';
    const trilho = el.querySelector('.carrossel__trilho');
    const total = trilho.children.length;
    if (total < 2) return;

    const esq = el.querySelector('.carrossel__seta--esq');
    const dir = el.querySelector('.carrossel__seta--dir');
    const pontos = el.querySelectorAll('.carrossel__pontos span');
    const contador = el.querySelector('.carrossel__contador');
    let ultimo = 0;

    const atual = () => Math.round(trilho.scrollLeft / trilho.clientWidth);
    const irPara = (i) => trilho.scrollTo({ left: i * trilho.clientWidth });

    esq.addEventListener('click', (e) => { e.stopPropagation(); irPara(atual() - 1); });
    dir.addEventListener('click', (e) => { e.stopPropagation(); irPara(atual() + 1); });
    trilho.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') irPara(atual() + 1);
      if (e.key === 'ArrowLeft') irPara(atual() - 1);
    });

    trilho.addEventListener('scroll', () => {
      const i = atual();
      if (i === ultimo) return;
      ultimo = i;
      pontos.forEach((p, k) => p.classList.toggle('ativo', k === i));
      contador.textContent = `${i + 1}/${total}`;
      esq.disabled = i === 0;
      dir.disabled = i === total - 1;
      if (aoTrocar) aoTrocar(el, i);
    }, { passive: true });
  });
}
