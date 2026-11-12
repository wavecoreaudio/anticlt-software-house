// Portfólio: abas de categoria, busca, filtro por bairro, ordenação,
// paginação ("carregar mais"), favoritos, perfil com avaliações e chat.

const POR_PAGINA = 9;
const estado = {
  categoria: parametro('categoria') || 'todos',
  busca: '',
  bairro: '',
  ordem: 'recentes',
  pagina: 1,
  paginas: 1,
  total: 0,
  categorias: [],
  prestadores: [],
  campos: {}, // cache das perguntas de cada categoria (para mostrar no perfil)
};
const eu = sessao.usuario;
const souCliente = eu?.tipo === 'contratante';

const elAbas = document.getElementById('abas');
const elLista = document.getElementById('lista');
const elInfo = document.getElementById('info');
const elMais = document.getElementById('mais');
const elFiltrosAtivos = document.getElementById('filtros-ativos');
const elLimparFiltros = document.getElementById('limpar-filtros');

function atualizarUrlCategoria() {
  history.replaceState(null, '', estado.categoria === 'todos' ? '/portfolio' : `/portfolio?categoria=${encodeURIComponent(estado.categoria)}`);
}

function desenharFiltrosAtivos() {
  const nomeCategoria = estado.categorias.find((c) => c.slug === estado.categoria)?.nome;
  const filtros = [];
  if (nomeCategoria) filtros.push(['categoria', `Categoria: ${nomeCategoria}`]);
  if (estado.busca) filtros.push(['busca', `Busca: ${estado.busca}`]);
  if (estado.bairro) filtros.push(['bairro', `Bairro: ${estado.bairro}`]);

  elFiltrosAtivos.innerHTML = filtros.map(([chave, texto]) => `
    <button class="chip-filtro" type="button" data-remover-filtro="${chave}" aria-label="Remover filtro ${esc(texto)}">
      ${esc(texto)} <span aria-hidden="true">×</span>
    </button>`).join('');
  elLimparFiltros.classList.toggle('oculto', filtros.length === 0);
}

function desenharAbas() {
  const total = estado.categorias.reduce((s, c) => s + c.total_prestadores, 0);
  const abas = [{ slug: 'todos', nome: 'Todos', total_prestadores: total }, ...estado.categorias];
  elAbas.innerHTML = abas.map((c) => `
    <button class="aba ${c.slug === estado.categoria ? 'ativa' : ''}" data-slug="${esc(c.slug)}">
      ${esc(c.nome)} <span class="contagem">${c.total_prestadores}</span>
    </button>`).join('');
}

function botaoFavorito(p) {
  return `<button class="botao-favorito ${p.favorito ? 'ativo' : ''}" data-favorito="${p.id}"
    aria-pressed="${!!p.favorito}" title="${p.favorito ? 'Remover dos salvos' : 'Salvar prestador'}">${icone('coracao')}</button>`;
}

function cartaoPrestador(p) {
  const servicos = Object.values(p.dados_especificos || {}).flat().filter(Boolean).slice(0, 3);
  return `
    <article class="post" data-id="${p.id}">
      <header class="post__cabeca">
        <div class="avatar">${esc(iniciais(p.nome))}</div>
        <div style="min-width:0">
          <div class="post__nome">${esc(p.nome)}</div>
          <div class="post__local">${icone('pin')} ${esc(p.bairro || 'Porto Velho')}</div>
        </div>
        <span class="etiqueta" style="margin-left:auto">${esc(p.categoria_nome)}</span>
      </header>
      ${htmlCarrossel(p.fotos, p.nome)}
      <div class="post__corpo">
        <div class="linha-flex entre" style="flex-wrap:nowrap;align-items:flex-start">
          <div>
            <div class="post__titulo">${esc(p.titulo)}</div>
            <span class="texto-fraco">${p.anos_experiencia} ano${p.anos_experiencia === 1 ? '' : 's'} de experiência · ${resumoNota(p.media_avaliacao, p.total_avaliacoes)}</span>
          </div>
          ${botaoFavorito(p)}
        </div>
        <p class="post__bio">${esc(p.bio || '')}</p>
        ${servicos.length ? `<div class="chips">${servicos.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div>` : ''}
        <div class="post__acoes">
          ${p.whatsapp ? `<a class="botao botao--claro botao--pequeno" data-contato href="${linkWhatsapp(p.whatsapp)}" target="_blank" rel="noopener">${icone('whatsapp')} WhatsApp</a>` : ''}
          <button class="botao botao--pequeno" data-perfil>Ver perfil</button>
        </div>
      </div>
    </article>`;
}

function desenharLista(acrescentar = false) {
  const nomeCategoria = estado.categorias.find((c) => c.slug === estado.categoria)?.nome;
  elInfo.textContent = `${estado.total} prestador${estado.total === 1 ? '' : 'es'}${nomeCategoria ? ` em ${nomeCategoria}` : ''}${estado.bairro ? ` no bairro ${estado.bairro}` : ''}${estado.busca ? ` para "${estado.busca}"` : ''}`;
  desenharFiltrosAtivos();
  elMais.classList.toggle('oculto', estado.pagina >= estado.paginas);

  if (estado.prestadores.length === 0) {
    elLista.innerHTML = '<div class="vazio" style="grid-column:1/-1">Nenhum prestador encontrado. Tente outra categoria, bairro ou busca.</div>';
    return;
  }
  const novos = acrescentar ? estado.prestadores.slice(-POR_PAGINA) : estado.prestadores;
  const html = novos.map(cartaoPrestador).join('');
  if (acrescentar) elLista.insertAdjacentHTML('beforeend', html);
  else elLista.innerHTML = html;
  ativarCarrosseis(elLista);
}

// pagina 1 = recomeça a lista; pagina > 1 = acrescenta no fim
async function carregarPrestadores(pagina = 1) {
  const params = new URLSearchParams({ categoria: estado.categoria, ordem: estado.ordem, pagina, limite: POR_PAGINA });
  if (estado.busca) params.set('busca', estado.busca);
  if (estado.bairro) params.set('bairro', estado.bairro);
  elMais.disabled = true;
  try {
    const r = await api(`/prestadores?${params}`);
    estado.pagina = r.pagina;
    estado.paginas = r.paginas;
    estado.total = r.total;
    estado.prestadores = pagina === 1 ? r.itens : estado.prestadores.concat(r.itens);
    desenharLista(pagina > 1);
  } catch (erro) {
    elLista.innerHTML = `<div class="vazio" style="grid-column:1/-1">${esc(erro.message)}</div>`;
  } finally {
    elMais.disabled = false;
  }
}

async function camposDaCategoria(id) {
  if (!estado.campos[id]) estado.campos[id] = await api(`/categorias/${id}/campos`).catch(() => []);
  return estado.campos[id];
}

// ---------- Favoritos ----------
async function alternarFavorito(id, botao) {
  if (!souCliente) {
    avisar(eu ? 'Só clientes podem salvar prestadores.' : 'Entre como cliente para salvar prestadores.', 'erro');
    return;
  }
  const p = estado.prestadores.find((x) => x.id === id);
  const salvar = !p.favorito;
  try {
    await api(`/favoritos/${id}`, { metodo: salvar ? 'POST' : 'DELETE' });
    p.favorito = salvar;
    document.querySelectorAll(`[data-favorito="${id}"]`).forEach((b) => { b.outerHTML = botaoFavorito(p); });
    avisar(salvar ? 'Prestador salvo nos seus favoritos.' : 'Removido dos favoritos.');
  } catch (erro) { avisar(erro.message, 'erro'); }
}

// ---------- Chat ----------
async function abrirConversa(prestadorId) {
  if (!souCliente) {
    location.href = `/login?area=cliente&voltar=${encodeURIComponent('/portfolio')}`;
    return;
  }
  try {
    const { id } = await api('/conversas', { metodo: 'POST', corpo: { prestador_id: prestadorId } });
    location.href = `/painel?conversa=${id}#mensagens`;
  } catch (erro) { avisar(erro.message, 'erro'); }
}

// ---------- Avaliações (dentro do perfil) ----------
function htmlAvaliacoes(dados) {
  const formulario = souCliente ? `
    <form class="cartao" id="form-avaliacao" style="padding:20px;margin:6px 0 18px">
      <strong style="font-weight:500">${dados.minha ? 'Sua avaliação' : 'Avaliar este prestador'}</strong>
      <div class="escolher-nota" role="radiogroup" aria-label="Nota">
        ${[5, 4, 3, 2, 1].map((n) => `
          <input type="radio" name="nota" id="nota-${n}" value="${n}" ${dados.minha?.nota === n ? 'checked' : ''}>
          <label for="nota-${n}" title="${n} estrela${n > 1 ? 's' : ''}">★</label>`).join('')}
      </div>
      <textarea class="entrada" name="comentario" placeholder="Conte como foi o serviço (opcional)" style="min-height:80px">${esc(dados.minha?.comentario || '')}</textarea>
      <div class="linha-flex" style="justify-content:flex-end;margin-top:12px">
        ${dados.minha ? '<button type="button" class="botao botao--pequeno botao--perigo" id="apagar-avaliacao">Apagar</button>' : ''}
        <button class="botao botao--pequeno botao--claro" type="submit">${dados.minha ? 'Atualizar' : 'Enviar avaliação'}</button>
      </div>
    </form>`
    : `<p class="texto-fraco" style="margin:0 0 18px">${eu ? 'Só clientes podem avaliar prestadores.' : '<a href="/login?area=cliente" style="text-decoration:underline">Entre como cliente</a> para avaliar.'}</p>`;

  const maior = Math.max(1, ...dados.distribuicao.map((d) => d.total));
  return `
    <section class="avaliacoes" id="bloco-avaliacoes">
      <h3 style="font-size:18px;font-weight:500;margin-bottom:18px">Avaliações</h3>
      ${dados.total ? `
        <div class="avaliacoes__topo">
          <div><div class="avaliacoes__media">${String(dados.media).replace('.', ',')}</div>${estrelas(dados.media)}<div class="texto-fraco">${dados.total} ${dados.total > 1 ? 'avaliações' : 'avaliação'}</div></div>
          <div class="distribuicao">${dados.distribuicao.map((d) => `
            <div><span>${d.nota}★</span><span class="trilho"><span style="width:${(d.total / maior) * 100}%"></span></span><span>${d.total}</span></div>`).join('')}
          </div>
        </div>` : '<p class="texto-fraco">Ainda sem avaliações.</p>'}
      ${formulario}
      ${dados.itens.map((a) => `
        <div class="avaliacao">
          <div class="linha-flex entre"><strong style="font-weight:500">${esc(a.cliente)}</strong><span class="texto-fraco">${formatarData(a.criado_em)}</span></div>
          ${estrelas(a.nota)}
          ${a.comentario ? `<p>${esc(a.comentario)}</p>` : ''}
        </div>`).join('')}
    </section>`;
}

async function carregarAvaliacoes(caixa, p) {
  const dados = await api(`/prestadores/${p.id}/avaliacoes`);
  const antigo = caixa.querySelector('#bloco-avaliacoes');
  if (antigo) antigo.outerHTML = htmlAvaliacoes(dados);
  else caixa.querySelector('.perfil-modal').insertAdjacentHTML('beforeend', htmlAvaliacoes(dados));

  const form = caixa.querySelector('#form-avaliacao');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nota = Number(form.nota.value);
    if (!nota) return avisar('Escolha de 1 a 5 estrelas.', 'erro');
    try {
      await api(`/prestadores/${p.id}/avaliacoes`, { metodo: 'POST', corpo: { nota, comentario: form.comentario.value } });
      avisar('Avaliação salva. Obrigado!');
      await carregarAvaliacoes(caixa, p);
      atualizarNotaNoCartao(p.id);
    } catch (erro) { avisar(erro.message, 'erro'); }
  });
  caixa.querySelector('#apagar-avaliacao')?.addEventListener('click', async () => {
    try {
      await api(`/prestadores/${p.id}/avaliacoes`, { metodo: 'DELETE' });
      avisar('Avaliação apagada.');
      await carregarAvaliacoes(caixa, p);
      atualizarNotaNoCartao(p.id);
    } catch (erro) { avisar(erro.message, 'erro'); }
  });
}

// Depois de avaliar, atualiza a nota mostrada no cartão do portfólio
async function atualizarNotaNoCartao(id) {
  const novo = await api(`/prestadores/${id}`).catch(() => null);
  const p = estado.prestadores.find((x) => x.id === id);
  if (!novo || !p) return;
  Object.assign(p, { media_avaliacao: novo.media_avaliacao, total_avaliacoes: novo.total_avaliacoes });
  const cartao = elLista.querySelector(`.post[data-id="${id}"]`);
  if (cartao) { cartao.outerHTML = cartaoPrestador(p); ativarCarrosseis(elLista); }
}

// ---------- Perfil em modal ----------
async function abrirPerfil(id) {
  const p = estado.prestadores.find((x) => x.id === id);
  if (!p) return;
  registrarAcesso({ tipo: 'visualizacao', prestador_id: p.id });

  const campos = await camposDaCategoria(p.categoria_id);
  const detalhes = campos.map((c) => {
    const valor = p.dados_especificos?.[c.chave];
    if (!valor || (Array.isArray(valor) && !valor.length)) return '';
    return `<div><dt>${esc(c.rotulo)}</dt><dd>${Array.isArray(valor)
      ? `<div class="chips">${valor.map((v) => `<span class="chip">${esc(v)}</span>`).join('')}</div>`
      : esc(valor)}</dd></div>`;
  }).join('');

  const caixa = abrirModal(`
    <div class="perfil-modal">
      ${htmlCarrossel(p.fotos, p.nome)}
      <div class="perfil-modal__info">
        <div class="linha-flex">
          <div class="avatar avatar--grande">${esc(iniciais(p.nome))}</div>
          <div style="flex:1">
            <span class="etiqueta">${esc(p.categoria_nome)}</span>
            <h2 style="font-size:26px;font-weight:500;margin:8px 0 0">${esc(p.nome)}</h2>
          </div>
          ${botaoFavorito(p)}
        </div>
        <div>
          <div class="post__titulo">${esc(p.titulo)} · ${resumoNota(p.media_avaliacao, p.total_avaliacoes)}</div>
          <div class="post__local">${icone('pin')} ${esc(p.bairro || '')}, ${esc(p.cidade)} · ${p.anos_experiencia} anos de experiência</div>
        </div>
        ${p.bio ? `<p class="texto-suave" style="margin:0">${esc(p.bio)}</p>` : ''}
        <dl>${detalhes}</dl>
        <div class="linha-flex" style="margin-top:auto">
          <button class="botao botao--claro" id="botao-conversar">${icone('chat')} Enviar mensagem</button>
          ${p.whatsapp ? `<a class="botao" data-contato href="${linkWhatsapp(p.whatsapp)}" target="_blank" rel="noopener">${icone('whatsapp')} ${esc(formatarTelefone(p.whatsapp))}</a>` : ''}
          ${p.instagram ? `<a class="botao" data-contato href="https://instagram.com/${encodeURIComponent(p.instagram)}" target="_blank" rel="noopener">${icone('instagram')} @${esc(p.instagram)}</a>` : ''}
        </div>
        ${!souCliente ? `<p class="texto-fraco" style="margin:0">${eu ? 'O chat é entre clientes e prestadores.' : 'Para usar o chat, entre como cliente.'}</p>` : ''}
      </div>
    </div>`);
  ativarCarrosseis(caixa);
  caixa.querySelectorAll('[data-contato]').forEach((a) =>
    a.addEventListener('click', () => registrarAcesso({ tipo: 'contato', prestador_id: p.id })));
  caixa.querySelector('#botao-conversar').addEventListener('click', () => {
    registrarAcesso({ tipo: 'contato', prestador_id: p.id });
    abrirConversa(p.id);
  });
  caixa.addEventListener('click', (e) => {
    const fav = e.target.closest('[data-favorito]');
    if (fav) alternarFavorito(Number(fav.dataset.favorito), fav);
  });
  carregarAvaliacoes(caixa, p).catch(() => {});
}

// ---------- Eventos ----------
elAbas.addEventListener('click', (e) => {
  const aba = e.target.closest('.aba');
  if (!aba || aba.dataset.slug === estado.categoria) return;
  estado.categoria = aba.dataset.slug;
  atualizarUrlCategoria();
  registrarAcesso({ tipo: 'busca', categoria: estado.categoria });
  desenharAbas();
  carregarPrestadores();
});

function removerFiltro(chave) {
  if (chave === 'categoria') {
    estado.categoria = 'todos';
    atualizarUrlCategoria();
    desenharAbas();
  } else if (chave === 'busca') {
    estado.busca = '';
    document.getElementById('busca').value = '';
    clearTimeout(atraso);
  } else if (chave === 'bairro') {
    estado.bairro = '';
    document.getElementById('bairro').value = '';
  }
  carregarPrestadores();
}

elFiltrosAtivos.addEventListener('click', (e) => {
  const botao = e.target.closest('[data-remover-filtro]');
  if (botao) removerFiltro(botao.dataset.removerFiltro);
});
elLimparFiltros.addEventListener('click', () => {
  estado.categoria = 'todos';
  estado.busca = '';
  estado.bairro = '';
  document.getElementById('busca').value = '';
  document.getElementById('bairro').value = '';
  clearTimeout(atraso);
  atualizarUrlCategoria();
  desenharAbas();
  carregarPrestadores();
});

let atraso;
document.getElementById('busca').addEventListener('input', (e) => {
  clearTimeout(atraso);
  atraso = setTimeout(() => { estado.busca = e.target.value.trim(); carregarPrestadores(); }, 300);
});
document.getElementById('bairro').addEventListener('change', (e) => { estado.bairro = e.target.value; carregarPrestadores(); });
document.getElementById('ordem').addEventListener('change', (e) => { estado.ordem = e.target.value; carregarPrestadores(); });
elMais.addEventListener('click', () => carregarPrestadores(estado.pagina + 1));

elLista.addEventListener('click', (e) => {
  const cartao = e.target.closest('.post');
  if (!cartao) return;
  const id = Number(cartao.dataset.id);
  const fav = e.target.closest('[data-favorito]');
  if (fav) return alternarFavorito(id, fav);
  if (e.target.closest('[data-contato]')) return registrarAcesso({ tipo: 'contato', prestador_id: id });
  if (e.target.closest('[data-perfil]') || e.target.closest('.carrossel__trilho img')) abrirPerfil(id);
});

// ---------- Início ----------
(async () => {
  try {
    const [categorias, bairros] = await Promise.all([api('/categorias'), api('/prestadores/bairros')]);
    estado.categorias = categorias;
    document.getElementById('bairro').insertAdjacentHTML('beforeend',
      bairros.map((b) => `<option value="${esc(b.bairro)}">${esc(b.bairro)} (${b.total})</option>`).join(''));
    if (estado.categoria !== 'todos' && !estado.categorias.some((c) => c.slug === estado.categoria)) estado.categoria = 'todos';
    if (estado.categoria !== 'todos') registrarAcesso({ tipo: 'busca', categoria: estado.categoria });
    desenharAbas();
    document.querySelector('.aba.ativa')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  } catch { /* abas ficam vazias */ }
  carregarPrestadores();
})();
