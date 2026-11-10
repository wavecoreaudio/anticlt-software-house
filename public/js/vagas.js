// Página de vagas: filtro por categoria e botão "Tenho interesse"

const estadoVagas = { categoria: parametro('categoria') || 'todos', categorias: [], vagas: [], meusInteresses: new Set() };
const usuarioAtual = sessao.usuario;

// Só cliente (contratante no banco) vê o atalho para publicar
if (!usuarioAtual || usuarioAtual.tipo !== 'contratante') {
  document.getElementById('botao-publicar').classList.add('oculto');
}

function desenharAbasVagas() {
  const total = estadoVagas.categorias.reduce((s, c) => s + c.vagas_abertas, 0);
  const abas = [{ slug: 'todos', nome: 'Todas', vagas_abertas: total }, ...estadoVagas.categorias];
  document.getElementById('abas').innerHTML = abas.map((c) => `
    <button class="aba ${c.slug === estadoVagas.categoria ? 'ativa' : ''}" data-slug="${esc(c.slug)}">
      ${esc(c.nome)} <span class="contagem">${c.vagas_abertas}</span>
    </button>`).join('');
}

function botaoInteresse(v) {
  if (!usuarioAtual) return `<a class="botao botao--pequeno" href="/login?area=prestador&voltar=/vagas">Entrar para se candidatar</a>`;
  if (usuarioAtual.tipo !== 'prestador') return '';
  return estadoVagas.meusInteresses.has(v.id)
    ? `<button class="botao botao--pequeno" data-desistir="${v.id}">${icone('check')} Interesse enviado</button>`
    : `<button class="botao botao--pequeno botao--claro" data-interesse="${v.id}">Tenho interesse</button>`;
}

function desenharVagas() {
  const categoria = estadoVagas.categorias.find((c) => c.slug === estadoVagas.categoria);
  const lista = estadoVagas.vagas;
  document.getElementById('info').textContent = `${lista.length} vaga${lista.length === 1 ? '' : 's'} aberta${lista.length === 1 ? '' : 's'}${categoria ? ` em ${categoria.nome}` : ''}`;

  const el = document.getElementById('lista');
  if (!lista.length) {
    el.innerHTML = '<div class="vazio">Nenhuma vaga aberta nessa categoria agora.</div>';
    return;
  }
  el.innerHTML = lista.map((v) => {
    const cat = estadoVagas.categorias.find((c) => c.id === v.categoria_id);
    return `
      <article class="cartao vaga">
        <div class="vaga__icone">${icone(cat?.icone)}</div>
        <div>
          <span class="etiqueta" style="margin-bottom:10px">${esc(v.categoria_nome)}</span>
          <h3>${esc(v.titulo)}</h3>
          <div class="vaga__meta">
            <span>${icone('empresa')} ${esc(v.contratante)}</span>
            <span>${icone('pin')} ${esc(v.bairro || 'Porto Velho')}</span>
            <span>${icone('calendario')} ${formatarData(v.data_servico)}</span>
            ${v.horario ? `<span>${icone('relogio')} ${esc(v.horario)}</span>` : ''}
          </div>
          ${v.descricao ? `<p class="vaga__desc">${esc(v.descricao)}</p>` : ''}
        </div>
        <div class="vaga__lado">
          <span class="texto-fraco">${v.total_interessados} interessado${v.total_interessados === 1 ? '' : 's'}</span>
          ${botaoInteresse(v)}
        </div>
      </article>`;
  }).join('');
}

async function carregarVagas() {
  try {
    estadoVagas.vagas = await api(`/vagas?categoria=${encodeURIComponent(estadoVagas.categoria)}`);
    desenharVagas();
  } catch (erro) {
    document.getElementById('lista').innerHTML = `<div class="vazio">${esc(erro.message)}</div>`;
  }
}

document.getElementById('abas').addEventListener('click', (e) => {
  const aba = e.target.closest('.aba');
  if (!aba) return;
  estadoVagas.categoria = aba.dataset.slug;
  if (estadoVagas.categoria !== 'todos') registrarAcesso({ tipo: 'busca', categoria: estadoVagas.categoria });
  desenharAbasVagas();
  carregarVagas();
});

document.getElementById('lista').addEventListener('click', async (e) => {
  const quer = e.target.closest('[data-interesse]');
  const desiste = e.target.closest('[data-desistir]');
  try {
    if (quer) {
      quer.disabled = true;
      await api(`/vagas/${quer.dataset.interesse}/interesse`, { metodo: 'POST', corpo: {} });
      estadoVagas.meusInteresses.add(Number(quer.dataset.interesse));
      avisar('Interesse enviado! O cliente verá seu perfil.');
      carregarVagas();
    }
    if (desiste && await confirmar('Retirar seu interesse nesta vaga?', 'Retirar')) {
      await api(`/vagas/${desiste.dataset.desistir}/interesse`, { metodo: 'DELETE' });
      estadoVagas.meusInteresses.delete(Number(desiste.dataset.desistir));
      avisar('Interesse retirado.');
      carregarVagas();
    }
  } catch (erro) {
    avisar(erro.message, 'erro');
    if (quer) quer.disabled = false;
  }
});

(async () => {
  try {
    estadoVagas.categorias = await api('/categorias');
    if (usuarioAtual?.tipo === 'prestador') {
      const meus = await api('/prestadores/eu/interesses').catch(() => []);
      estadoVagas.meusInteresses = new Set(meus.map((i) => i.vaga_id));
    }
  } catch { /* segue sem abas */ }
  desenharAbasVagas();
  carregarVagas();
})();
