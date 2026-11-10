// Página inicial: mosaico do hero, números e categorias (dados do banco)

(function montarMosaico() {
  const slugs = ['eletricista', 'encanador', 'pintor', 'pedreiro', 'jardinagem', 'limpeza', 'montador', 'ar-condicionado'];
  const colunas = [];
  for (let c = 0; c < 6; c++) {
    const fotos = [];
    for (let k = 0; k < 4; k++) {
      const slug = slugs[(c * 3 + k) % slugs.length];
      fotos.push(`<img src="/img/portfolio/${slug}-${((c + k) % 4) + 1}.svg" alt="">`);
    }
    // duplica a coluna para a animação de rolagem não "pular"
    colunas.push(`<div>${fotos.join('')}${fotos.join('')}</div>`);
  }
  document.getElementById('mosaico').innerHTML = colunas.join('');
})();

(async function carregarDados() {
  try {
    const categorias = await api('/categorias');
    const totalPrestadores = categorias.reduce((s, c) => s + c.total_prestadores, 0);
    const totalVagas = categorias.reduce((s, c) => s + c.vagas_abertas, 0);

    document.querySelector('[data-n="prestadores"]').textContent = totalPrestadores;
    document.querySelector('[data-n="categorias"]').textContent = categorias.length;
    document.querySelector('[data-n="vagas"]').textContent = totalVagas;

    document.getElementById('categorias').innerHTML = categorias.map((c) => `
      <a class="categoria-bloco" href="/portfolio?categoria=${encodeURIComponent(c.slug)}">
        ${icone(c.icone)}
        <span class="seta-canto">${icone('seta')}</span>
        <div>
          <h3>${esc(c.nome)}</h3>
          <span class="texto-fraco">${c.total_prestadores} prestador${c.total_prestadores === 1 ? '' : 'es'} · ${c.vagas_abertas} vaga${c.vagas_abertas === 1 ? '' : 's'}</span>
        </div>
      </a>`).join('');
  } catch (erro) {
    document.getElementById('categorias').innerHTML = `<p class="vazio">Não foi possível carregar as categorias. O servidor está rodando?</p>`;
  }
})();
