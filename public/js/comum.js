// Código usado em todas as páginas:
// - chamadas à API (fetch com token)
// - sessão do usuário no localStorage
// - cabeçalho e rodapé
// - avisos (toast), modal e utilidades de formatação

const API = '/api';

// ---------- Sessão ----------
const sessao = {
  get token() { return localStorage.getItem('anticlt_token'); },
  get usuario() {
    try { return JSON.parse(localStorage.getItem('anticlt_usuario')); } catch { return null; }
  },
  salvar(token, usuario) {
    localStorage.setItem('anticlt_token', token);
    localStorage.setItem('anticlt_usuario', JSON.stringify(usuario));
  },
  atualizarUsuario(usuario) { localStorage.setItem('anticlt_usuario', JSON.stringify(usuario)); },
  limpar() {
    localStorage.removeItem('anticlt_token');
    localStorage.removeItem('anticlt_usuario');
  },
};

// ---------- Chamadas à API ----------
async function api(caminho, { metodo = 'GET', corpo } = {}) {
  const opcoes = { method: metodo, headers: {} };
  if (sessao.token) opcoes.headers.Authorization = `Bearer ${sessao.token}`;
  if (corpo !== undefined) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }

  const resposta = await fetch(API + caminho, opcoes);
  const dados = await resposta.json().catch(() => ({}));

  if (resposta.status === 401 && sessao.token) {
    sessao.limpar(); // token velho: desloga
  }
  if (!resposta.ok) throw new Error(dados.erro || 'Algo deu errado. Tente de novo.');
  return dados;
}

// Registra procura para a dashboard (não atrapalha a página se falhar)
function registrarAcesso(dados) {
  fetch(API + '/acessos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
    keepalive: true,
  }).catch(() => {});
}

// ---------- Utilidades ----------
function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function iniciais(nome) {
  return String(nome || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}
function formatarData(iso, comHora = false) {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso.replace(' ', 'T'));
  const opcoes = { day: '2-digit', month: 'short' };
  if (comHora) Object.assign(opcoes, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', opcoes).replace('.', '');
}
function formatarTelefone(numero) {
  const d = String(numero || '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return numero || '';
}
function linkWhatsapp(numero, mensagem = 'Olá! Vi seu perfil no ANTI CLT e gostaria de um orçamento.') {
  const d = String(numero || '').replace(/\D/g, '');
  return `https://wa.me/55${d}?text=${encodeURIComponent(mensagem)}`;
}
function parametro(nome) {
  return new URLSearchParams(location.search).get(nome);
}

// No banco o cliente se chama "contratante"; na tela, sempre "cliente"
const NOME_TIPO = { contratante: 'cliente', prestador: 'prestador', admin: 'admin' };
const nomeTipo = (tipo) => NOME_TIPO[tipo] || tipo;

// Estrelas de 0 a 5 (meia estrela arredonda para cima a partir de .5)
function estrelas(media, { tamanho = '' } = {}) {
  const cheias = Math.round(Number(media) || 0);
  return `<span class="estrelas ${tamanho}" aria-label="${media ? `${String(media).replace('.', ',')} de 5 estrelas` : 'sem avaliações'}">${
    [1, 2, 3, 4, 5].map((n) => `<span class="${n <= cheias ? 'cheia' : ''}">★</span>`).join('')}</span>`;
}
function resumoNota(media, total) {
  if (!total) return '<span class="nota-resumo texto-fraco">Sem avaliações</span>';
  return `<span class="nota-resumo"><span class="estrela-unica">★</span> ${String(media).replace('.', ',')} <span class="texto-fraco">(${total})</span></span>`;
}

// Baixa um arquivo de uma rota protegida (precisa mandar o token)
async function baixarArquivo(caminho, nomePadrao) {
  const r = await fetch(API + caminho, { headers: { Authorization: `Bearer ${sessao.token}` } });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || 'Não foi possível baixar.');
  const nome = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '')?.[1] || nomePadrao;
  const url = URL.createObjectURL(await r.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- Avisos (toast) ----------
function avisar(mensagem, tipo = 'ok') {
  let caixa = document.querySelector('.avisos');
  if (!caixa) {
    caixa = document.createElement('div');
    caixa.className = 'avisos';
    caixa.setAttribute('role', 'status');
    document.body.appendChild(caixa);
  }
  const aviso = document.createElement('div');
  aviso.className = `aviso ${tipo === 'erro' ? 'aviso--erro' : ''}`;
  aviso.textContent = mensagem;
  caixa.appendChild(aviso);
  setTimeout(() => aviso.remove(), 3800);
}

// ---------- Modal ----------
function abrirModal(html, { estreita = false } = {}) {
  fecharModal();
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal__caixa ${estreita ? 'modal__caixa--estreita' : ''}" role="dialog" aria-modal="true">
      <button class="modal__fechar" aria-label="Fechar">${icone('x')}</button>
      ${html}
    </div>`;
  modal.addEventListener('click', (e) => { if (e.target === modal) fecharModal(); });
  modal.querySelector('.modal__fechar').addEventListener('click', fecharModal);
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  return modal.querySelector('.modal__caixa');
}
function fecharModal() {
  document.querySelector('.modal')?.remove();
  document.body.style.overflow = '';
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharModal(); });

function confirmar(pergunta, textoBotao = 'Confirmar') {
  return new Promise((resolve) => {
    const caixa = abrirModal(`
      <h3 style="font-size:22px;font-weight:500;margin-bottom:10px">${esc(pergunta)}</h3>
      <p class="texto-suave">Essa ação não pode ser desfeita.</p>
      <div class="linha-flex" style="justify-content:flex-end;margin-top:26px">
        <button class="botao" data-r="nao">Cancelar</button>
        <button class="botao botao--claro" data-r="sim">${esc(textoBotao)}</button>
      </div>`, { estreita: true });
    caixa.addEventListener('click', (e) => {
      const r = e.target.closest('[data-r]');
      if (r) { fecharModal(); resolve(r.dataset.r === 'sim'); }
    });
  });
}

// ---------- Cabeçalho e rodapé ----------
const PAGINAS = [
  ['/', 'Início'],
  ['/como-funciona', 'Como funciona'],
  ['/portfolio', 'Portfólio'],
  ['/vagas', 'Vagas'],
];

function montarCabecalho() {
  const alvo = document.getElementById('topo');
  if (!alvo) return;
  const atual = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/') || '/';
  const u = sessao.usuario;

  const acoes = u
    ? `<span class="topo__usuario">Olá, ${esc(u.nome.split(' ')[0])}</span>
       ${u.tipo !== 'admin' ? `<a class="botao botao--pequeno botao-icone" href="/painel#mensagens" title="Mensagens" aria-label="Mensagens">
         ${icone('chat')}<span class="selo oculto" id="selo-mensagens"></span></a>` : ''}
       <a class="botao botao--pequeno ${u.tipo === 'admin' ? '' : 'botao--claro'}" href="${u.tipo === 'admin' ? '/dashboard' : '/painel'}">
         ${u.tipo === 'admin' ? icone('grafico') + ' Dashboard' : 'Meu painel'}</a>
       <button class="botao botao--pequeno" id="botao-sair" title="Sair">${icone('sair')}</button>`
    : `<a class="botao botao--pequeno" href="/login">Entrar</a>
       <a class="botao botao--pequeno botao--claro" href="/cadastro">Cadastre-se</a>`;

  alvo.innerHTML = `
    <div class="container topo__barra">
      <a class="marca" href="/" aria-label="ANTI CLT, página inicial">
        <img class="marca__simbolo" src="/img/logo-simbolo.svg" alt="">
        <span class="marca__texto">
          <span class="marca__nome">ANTI<b>CLT</b></span>
          <span class="marca__sub">DIÁRIAS &amp; SERVIÇOS</span>
        </span>
      </a>
      <nav class="menu" id="menu" aria-label="Principal">
        ${PAGINAS.map(([href, nome]) => `<a href="${href}" class="${atual === href ? 'ativo' : ''}">${nome}</a>`).join('')}
      </nav>
      <div class="topo__acoes">
        ${acoes}
        <button class="botao-menu" id="botao-menu" aria-label="Abrir menu">${icone('menu')}</button>
      </div>
    </div>`;

  document.getElementById('botao-menu').addEventListener('click', () => {
    document.getElementById('menu').classList.toggle('aberto');
  });
  document.getElementById('botao-sair')?.addEventListener('click', async () => {
    try { await api('/auth/logout', { metodo: 'POST' }); } catch { /* sem problema */ }
    const eraAdmin = sessao.usuario?.tipo === 'admin';
    sessao.limpar();
    location.href = eraAdmin ? '/admin' : '/';
  });

  // Contador de mensagens não lidas (consulta a cada 30 segundos)
  if (u && u.tipo !== 'admin') {
    const atualizarSelo = async () => {
      try {
        const { total } = await api('/conversas/nao-lidas');
        const selo = document.getElementById('selo-mensagens');
        if (!selo) return;
        selo.textContent = total > 9 ? '9+' : total;
        selo.classList.toggle('oculto', !total);
      } catch { /* sem conexão: tenta de novo depois */ }
    };
    atualizarSelo();
    setInterval(atualizarSelo, 30000);
    window.atualizarSeloMensagens = atualizarSelo;
  }

  const marcarRolagem = () => alvo.classList.toggle('rolou', window.scrollY > 10);
  window.addEventListener('scroll', marcarRolagem, { passive: true });
  marcarRolagem();
}

function montarRodape() {
  const alvo = document.getElementById('rodape');
  if (!alvo) return;
  alvo.innerHTML = `
    <div class="container">
      <div class="rodape__grade">
        <div>
          <a class="marca" href="/" style="margin-bottom:16px">
            <img class="marca__simbolo" src="/img/logo-simbolo.svg" alt="">
            <span class="marca__texto">
              <span class="marca__nome">ANTI<b>CLT</b></span>
              <span class="marca__sub">DIÁRIAS &amp; SERVIÇOS</span>
            </span>
          </a>
          <p style="max-width:34ch">Portal que aproxima quem precisa de um serviço de quem sabe fazer. Contato direto, sem intermediário.</p>
        </div>
        <div><h4>Plataforma</h4><ul>
          <li><a href="/portfolio">Portfólio</a></li><li><a href="/vagas">Vagas de diária</a></li><li><a href="/como-funciona">Como funciona</a></li></ul></div>
        <div><h4>Conta</h4><ul>
          <li><a href="/cadastro">Criar conta</a></li><li><a href="/login">Entrar</a></li><li><a href="/painel">Meu painel</a></li></ul></div>
        <div><h4>Projeto</h4><ul>
          <li><a href="/privacidade">Termos e privacidade</a></li><li><a href="/docs">Documentação da API</a></li><li>Porto Velho - RO</li></ul></div>
      </div>
      <div class="rodape__base">
        <span>© ${new Date().getFullYear()} ANTI CLT · Projeto acadêmico</span>
        <span>Dados e imagens de exemplo são fictícios. · <a href="/admin">Administração</a></span>
      </div>
    </div>`;
}

// Bloqueia a página para quem não está logado (ou não é do tipo certo)
function exigirSessao(...tipos) {
  const u = sessao.usuario;
  if (!u || !sessao.token) {
    // A dashboard tem login próprio (/admin); o resto usa o login público
    location.href = tipos.length === 1 && tipos[0] === 'admin'
      ? '/admin'
      : `/login?voltar=${encodeURIComponent(location.pathname)}`;
    return null;
  }
  if (tipos.length && !tipos.includes(u.tipo)) {
    location.href = u.tipo === 'admin' ? '/dashboard' : '/painel';
    return null;
  }
  return u;
}

// Troca <i data-icone="nome"></i> pelo SVG do ícone (usado no HTML estático)
function desenharIcones(raiz = document) {
  raiz.querySelectorAll('i[data-icone]').forEach((el) => {
    el.outerHTML = icone(el.dataset.icone);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  montarCabecalho();
  montarRodape();
  desenharIcones();
});
