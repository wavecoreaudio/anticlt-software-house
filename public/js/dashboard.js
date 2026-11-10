// Dashboard do administrador: resumo das inscrições, serviços mais
// procurados, avaliações, CRUD de usuários e de categorias, exportação
// em CSV e registro de auditoria.

const admin = exigirSessao('admin');
const elDash = document.getElementById('conteudo');
let periodo = 30;

function cabeca(titulo, subtitulo, acao = '') {
  return `<header><div><h1 class="painel__titulo">${titulo}</h1><p class="texto-suave" style="margin:0">${subtitulo}</p></div>${acao}</header>`;
}
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

// ---------------- Visão geral ----------------
async function visaoGeral() {
  elDash.innerHTML = '<p class="carregando">Calculando números…</p>';
  const d = await api(`/dashboard?dias=${periodo}`);
  const t = d.totais;
  const totalProcura = d.procura.reduce((s, c) => s + c.total, 0);
  const lider = d.procura[0];

  elDash.innerHTML = `
    ${cabeca('Visão geral', 'Resumo das inscrições e da procura por serviços.',
      `<div class="linha-flex">
        <button class="botao botao--pequeno" id="exportar">${icone('baixar')} Exportar CSV</button>
        <div class="periodo" id="periodo">${[7, 30, 90].map((p) => `<button data-p="${p}" class="${p === periodo ? 'ativo' : ''}">${p} dias</button>`).join('')}</div>
      </div>`)}

    <div class="kpis">
      <div class="cartao kpi"><div class="kpi__rotulo">${icone('usuario')} Inscritos</div>
        <div class="kpi__valor">${t.usuarios}</div><div class="kpi__extra">+${t.novos_periodo} nos últimos ${d.dias} dias</div></div>
      <div class="cartao kpi"><div class="kpi__rotulo">${icone('maleta')} Prestadores</div>
        <div class="kpi__valor">${t.prestadores}</div><div class="kpi__extra">e ${plural(t.contratantes, 'cliente', 'clientes')}</div></div>
      <div class="cartao kpi"><div class="kpi__rotulo">${icone('calendario')} Vagas abertas</div>
        <div class="kpi__valor">${t.vagas_abertas}</div><div class="kpi__extra">${plural(t.interesses, 'interesse enviado', 'interesses enviados')}</div></div>
      <div class="cartao kpi"><div class="kpi__rotulo">${icone('whatsapp')} Contatos</div>
        <div class="kpi__valor">${t.contatos_periodo}</div><div class="kpi__extra">cliques + ${plural(t.mensagens_periodo, 'mensagem', 'mensagens')} no chat</div></div>
      <div class="cartao kpi"><div class="kpi__rotulo">${icone('estrela')} Avaliações</div>
        <div class="kpi__valor">${t.avaliacoes}</div><div class="kpi__extra">média geral ${t.media_geral ? String(t.media_geral).replace('.', ',') + ' ★' : '—'}</div></div>
    </div>

    <div class="graficos">
      <div class="cartao grafico-cartao">
        <div class="linha-flex entre"><div><h3>Novas inscrições por dia</h3><span class="texto-fraco">Prestadores + clientes · últimos ${d.dias} dias</span></div>
          <button class="alternar-tabela" data-tabela="cadastros">Ver tabela</button></div>
        <div class="grafico" id="g-cadastros"></div>
      </div>
      <div class="cartao grafico-cartao">
        <div class="linha-flex entre"><div><h3>Serviços mais procurados</h3><span class="texto-fraco">${totalProcura} buscas, visualizações e contatos${lider && lider.total ? ` · líder: ${esc(lider.nome)}` : ''}</span></div>
          <button class="alternar-tabela" data-tabela="procura">Ver tabela</button></div>
        <div class="grafico" id="g-procura"></div>
      </div>
    </div>

    <div class="graficos" style="grid-template-columns:1fr 1fr">
      <div>
        <h3 style="font-size:16px;font-weight:500;margin-bottom:12px">Últimas inscrições</h3>
        <div class="tabela-caixa"><table class="tabela">
          <thead><tr><th>Nome</th><th>Tipo</th><th>Área</th><th>Quando</th></tr></thead>
          <tbody>${d.ultimas_inscricoes.map((u) => `
            <tr><td>${esc(u.nome)}</td><td>${nomeTipo(u.tipo)}</td><td>${esc(u.categoria || '—')}</td><td>${formatarData(u.criado_em, true)}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>
      <div>
        <h3 style="font-size:16px;font-weight:500;margin-bottom:12px">Por categoria</h3>
        <div class="tabela-caixa"><table class="tabela">
          <thead><tr><th>Categoria</th><th class="num">Prestadores</th><th class="num">Vagas abertas</th><th class="num">Interesses</th></tr></thead>
          <tbody>${d.por_categoria.map((c) => `
            <tr><td>${esc(c.nome)}</td><td class="num">${c.prestadores}</td><td class="num">${c.vagas_abertas}</td><td class="num">${c.interesses}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>
    </div>

    <div class="graficos" style="grid-template-columns:1fr 1fr">
      <div>
        <h3 style="font-size:16px;font-weight:500;margin-bottom:12px">Prestadores mais vistos no período</h3>
        <div class="tabela-caixa"><table class="tabela">
          <thead><tr><th>#</th><th>Prestador</th><th>Categoria</th><th class="num">Vistas</th><th class="num">Contatos</th></tr></thead>
          <tbody>${d.prestadores_mais_vistos.map((p, i) => `
            <tr><td>${i + 1}</td><td>${esc(p.nome)}</td><td>${esc(p.categoria)}</td><td class="num">${p.visualizacoes}</td><td class="num">${p.contatos}</td></tr>`).join('') || '<tr><td colspan="5" class="texto-fraco">Sem dados no período.</td></tr>'}</tbody>
        </table></div>
      </div>
      <div>
        <h3 style="font-size:16px;font-weight:500;margin-bottom:12px">Mais bem avaliados</h3>
        <div class="tabela-caixa"><table class="tabela">
          <thead><tr><th>#</th><th>Prestador</th><th>Categoria</th><th class="num">Média</th><th class="num">Avaliações</th></tr></thead>
          <tbody>${d.melhores_avaliados.map((p, i) => `
            <tr><td>${i + 1}</td><td>${esc(p.nome)}</td><td>${esc(p.categoria)}</td><td class="num">${String(p.media).replace('.', ',')} ★</td><td class="num">${p.avaliacoes}</td></tr>`).join('') || '<tr><td colspan="5" class="texto-fraco">Ainda sem avaliações.</td></tr>'}</tbody>
        </table></div>
      </div>
    </div>`;

  document.getElementById('exportar').addEventListener('click', abrirExportacao);

  // Gráfico 1: inscrições por dia
  const colunas = d.cadastros_por_dia.map((x) => ({
    rotulo: formatarData(x.dia),
    valor: x.prestadores + x.contratantes,
    dica: `<strong>${formatarData(x.dia)}</strong>${plural(x.prestadores, 'prestador', 'prestadores')}<br>${plural(x.contratantes, 'contratante', 'contratantes')}`,
  }));
  graficoColunas(document.getElementById('g-cadastros'), colunas);

  // Gráfico 2: procura por categoria (já vem ordenado do maior para o menor)
  const barras = d.procura.map((c) => ({
    rotulo: c.nome,
    valor: c.total,
    dica: `<strong>${esc(c.nome)}</strong>${c.buscas} buscas<br>${c.visualizacoes} visualizações<br>${c.contatos} contatos`,
  }));
  graficoBarras(document.getElementById('g-procura'), barras);

  // Alternar gráfico <-> tabela (acessibilidade)
  const tabelas = {
    cadastros: ['g-cadastros', ['Dia', 'Prestadores', 'Contratantes'], d.cadastros_por_dia.map((x) => [formatarData(x.dia), x.prestadores, x.contratantes]), () => graficoColunas(document.getElementById('g-cadastros'), colunas)],
    procura: ['g-procura', ['Categoria', 'Buscas', 'Visualizações', 'Contatos', 'Total'], d.procura.map((c) => [c.nome, c.buscas, c.visualizacoes, c.contatos, c.total]), () => graficoBarras(document.getElementById('g-procura'), barras)],
  };
  elDash.querySelectorAll('[data-tabela]').forEach((b) => b.addEventListener('click', () => {
    const [id, cab, linhas, redesenhar] = tabelas[b.dataset.tabela];
    const el = document.getElementById(id);
    if (b.textContent === 'Ver tabela') {
      el.innerHTML = `<div class="tabela-caixa" style="max-height:260px;overflow:auto"><table class="tabela">
        <thead><tr>${cab.map((c, i) => `<th class="${i ? 'num' : ''}">${c}</th>`).join('')}</tr></thead>
        <tbody>${linhas.map((l) => `<tr>${l.map((v, i) => `<td class="${i ? 'num' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      b.textContent = 'Ver gráfico';
    } else {
      redesenhar();
      b.textContent = 'Ver tabela';
    }
  }));

  document.getElementById('periodo').addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]');
    if (!b) return;
    periodo = Number(b.dataset.p);
    visaoGeral();
  });
}

// ---------------- Usuários (CRUD) ----------------
async function usuarios(filtro = {}) {
  const params = new URLSearchParams(filtro);
  const lista = await api(`/dashboard/usuarios?${params}`);
  elDash.innerHTML = `
    ${cabeca('Usuários', `${plural(lista.length, 'conta encontrada', 'contas encontradas')}.`,
      `<button class="botao botao--pequeno" id="exportar-u">${icone('baixar')} Exportar CSV</button>`)}
    <div class="barra-filtros">
      <div class="abas" id="filtro-tipo">
        ${[['', 'Todos'], ['prestador', 'Prestadores'], ['contratante', 'Clientes']].map(([v, n]) =>
          `<button class="aba ${(filtro.tipo || '') === v ? 'ativa' : ''}" data-tipo="${v}">${n}</button>`).join('')}
      </div>
      <label class="busca"><span class="sr-only">Buscar</span>${icone('busca')}<input class="entrada" id="busca-u" placeholder="Nome ou e-mail" value="${esc(filtro.busca || '')}"></label>
    </div>
    <div class="tabela-caixa"><table class="tabela">
      <thead><tr><th>Nome</th><th>E-mail</th><th>Tipo</th><th>Área</th><th>Cadastro</th><th>Situação</th><th></th></tr></thead>
      <tbody>${lista.map((u) => `
        <tr>
          <td>${esc(u.nome)}</td><td>${esc(u.email)}</td><td>${nomeTipo(u.tipo)}</td><td>${esc(u.categoria || '—')}</td>
          <td>${formatarData(u.criado_em)}</td>
          <td><span class="etiqueta ${u.ativo ? 'etiqueta--ok' : 'etiqueta--off'}">${u.ativo ? 'ativo' : 'desativado'}</span></td>
          <td class="num"><div class="linha-flex" style="justify-content:flex-end;flex-wrap:nowrap">
            <button class="botao botao--pequeno" data-ativar="${u.id}" data-ativo="${u.ativo}">${u.ativo ? 'Desativar' : 'Ativar'}</button>
            <button class="botao botao--pequeno botao--perigo" data-excluir="${u.id}" title="Excluir">${icone('lixo')}</button>
          </div></td>
        </tr>`).join('') || '<tr><td colspan="7" class="texto-fraco">Nenhuma conta.</td></tr>'}</tbody>
    </table></div>`;

  document.getElementById('exportar-u').addEventListener('click', () =>
    baixarArquivo('/dashboard/exportar/usuarios', 'inscricoes.csv').catch((erro) => avisar(erro.message, 'erro')));

  document.getElementById('filtro-tipo').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tipo]');
    if (b) usuarios({ ...filtro, tipo: b.dataset.tipo });
  });
  let atraso;
  const campoBusca = document.getElementById('busca-u');
  campoBusca.addEventListener('input', () => {
    clearTimeout(atraso);
    atraso = setTimeout(async () => {
      await usuarios({ ...filtro, busca: campoBusca.value });
      const novo = document.getElementById('busca-u');
      novo.focus();
      novo.setSelectionRange(novo.value.length, novo.value.length);
    }, 350);
  });
  elDash.querySelectorAll('[data-ativar]').forEach((b) => b.addEventListener('click', async () => {
    try {
      await api(`/dashboard/usuarios/${b.dataset.ativar}`, { metodo: 'PATCH', corpo: { ativo: b.dataset.ativo !== '1' } });
      avisar('Situação atualizada.');
      usuarios(filtro);
    } catch (erro) { avisar(erro.message, 'erro'); }
  }));
  elDash.querySelectorAll('[data-excluir]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmar('Excluir este usuário e tudo ligado a ele?', 'Excluir'))) return;
    try {
      await api(`/dashboard/usuarios/${b.dataset.excluir}`, { metodo: 'DELETE' });
      avisar('Usuário excluído.');
      usuarios(filtro);
    } catch (erro) { avisar(erro.message, 'erro'); }
  }));
}

// ---------------- Categorias (CRUD) ----------------
async function categorias() {
  const lista = await api('/categorias');
  elDash.innerHTML = `
    ${cabeca('Categorias', 'As abas do portfólio e das vagas.', `<button class="botao botao--claro" id="nova-cat">${icone('mais')} Nova categoria</button>`)}
    <div class="tabela-caixa"><table class="tabela">
      <thead><tr><th></th><th>Nome</th><th>Descrição</th><th class="num">Prestadores</th><th class="num">Vagas abertas</th><th></th></tr></thead>
      <tbody>${lista.map((c) => `
        <tr>
          <td>${icone(c.icone)}</td><td>${esc(c.nome)}</td><td class="texto-suave" style="white-space:normal">${esc(c.descricao || '')}</td>
          <td class="num">${c.total_prestadores}</td><td class="num">${c.vagas_abertas}</td>
          <td class="num"><div class="linha-flex" style="justify-content:flex-end;flex-wrap:nowrap">
            <button class="botao botao--pequeno" data-editar="${c.id}">${icone('editar')}</button>
            <button class="botao botao--pequeno botao--perigo" data-excluir="${c.id}">${icone('lixo')}</button>
          </div></td>
        </tr>`).join('')}</tbody>
    </table></div>
    <p class="texto-fraco" style="margin-top:14px">Uma categoria só pode ser excluída quando não tem prestadores nem vagas.</p>`;

  const formCategoria = (c) => {
    const caixa = abrirModal(`
      <h2 style="font-size:24px;font-weight:500">${c ? 'Editar categoria' : 'Nova categoria'}</h2>
      <div id="msg-cat"></div>
      <form novalidate>
        <div class="campo"><label for="c-nome">Nome</label><input class="entrada" id="c-nome" name="nome" value="${esc(c?.nome || '')}"></div>
        <div class="campo"><label for="c-desc">Descrição</label><input class="entrada" id="c-desc" name="descricao" value="${esc(c?.descricao || '')}"></div>
        <div class="linha-flex" style="justify-content:flex-end"><button class="botao botao--claro" type="submit">Salvar</button></div>
      </form>`, { estreita: true });
    caixa.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api(c ? `/categorias/${c.id}` : '/categorias', {
          metodo: c ? 'PUT' : 'POST', corpo: { nome: e.target.nome.value, descricao: e.target.descricao.value },
        });
        fecharModal();
        avisar('Categoria salva.');
        categorias();
      } catch (erro) {
        caixa.querySelector('#msg-cat').innerHTML = `<div class="alerta alerta--erro">${esc(erro.message)}</div>`;
      }
    });
  };

  document.getElementById('nova-cat').addEventListener('click', () => formCategoria());
  elDash.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () =>
    formCategoria(lista.find((c) => c.id === Number(b.dataset.editar)))));
  elDash.querySelectorAll('[data-excluir]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmar('Excluir esta categoria?', 'Excluir'))) return;
    try {
      await api(`/categorias/${b.dataset.excluir}`, { metodo: 'DELETE' });
      avisar('Categoria excluída.');
      categorias();
    } catch (erro) { avisar(erro.message, 'erro'); }
  }));
}

// ---------------- Exportar CSV ----------------
function abrirExportacao() {
  const caixa = abrirModal(`
    <h2 style="font-size:24px;font-weight:500">Exportar relatório</h2>
    <p class="texto-suave">Arquivo CSV, abre direto no Excel ou no Google Planilhas.</p>
    <div style="display:grid;gap:10px;margin-top:18px">
      ${[['usuarios', 'Inscrições', 'Todas as contas de clientes e prestadores'],
         ['procura', 'Serviços mais procurados', 'Buscas, visualizações e contatos por categoria'],
         ['vagas', 'Vagas', 'Todas as vagas com número de interessados']].map(([tipo, nome, desc]) => `
        <button class="escolha" data-exportar="${tipo}" style="display:flex;align-items:center;gap:14px;padding:16px">
          ${icone('documento')}<div><strong style="font-size:15px;margin:0">${nome}</strong><span>${desc}</span></div>
        </button>`).join('')}
    </div>`, { estreita: true });
  caixa.querySelectorAll('[data-exportar]').forEach((b) => b.addEventListener('click', async () => {
    try {
      await baixarArquivo(`/dashboard/exportar/${b.dataset.exportar}`, `${b.dataset.exportar}.csv`);
      fecharModal();
      avisar('Relatório baixado.');
    } catch (erro) { avisar(erro.message, 'erro'); }
  }));
}

// ---------------- Auditoria ----------------
const NOMES_ACOES = {
  login: 'Login', login_admin_falhou: 'Login de admin recusado', cadastro: 'Cadastro', publicou_vaga: 'Publicou vaga',
  excluiu_vaga: 'Excluiu vaga', avaliacao: 'Avaliação', trocou_senha: 'Trocou a senha', excluiu_propria_conta: 'Excluiu a própria conta',
  baixou_dados_lgpd: 'Baixou seus dados (LGPD)', exportar_csv: 'Exportou CSV', admin_ativou_usuario: 'Admin ativou usuário',
  admin_desativou_usuario: 'Admin desativou usuário', admin_excluiu_usuario: 'Admin excluiu usuário',
  admin_criou_categoria: 'Admin criou categoria', admin_editou_categoria: 'Admin editou categoria',
  admin_excluiu_categoria: 'Admin excluiu categoria', seed: 'Dados de exemplo',
};

async function auditoria(filtro = { pagina: 1, acao: '' }) {
  const params = new URLSearchParams({ pagina: filtro.pagina });
  if (filtro.acao) params.set('acao', filtro.acao);
  const d = await api(`/dashboard/auditoria?${params}`);
  elDash.innerHTML = `
    ${cabeca('Auditoria', `${plural(d.total, 'registro', 'registros')} de ações importantes no sistema.`,
      `<label><span class="sr-only">Filtrar ação</span><select class="entrada" id="filtro-acao" style="border-radius:999px;padding:9px 40px 9px 16px">
        <option value="">Todas as ações</option>
        ${d.acoes.map((a) => `<option value="${esc(a.acao)}" ${a.acao === filtro.acao ? 'selected' : ''}>${esc(NOMES_ACOES[a.acao] || a.acao)} (${a.total})</option>`).join('')}
      </select></label>`)}
    <div class="tabela-caixa"><table class="tabela">
      <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Detalhe</th><th>IP</th></tr></thead>
      <tbody>${d.itens.map((a) => `
        <tr><td>${formatarData(a.criado_em, true)}</td><td>${esc(a.usuario || '—')}</td><td>${esc(NOMES_ACOES[a.acao] || a.acao)}</td>
          <td style="white-space:normal">${esc(a.detalhe || '')}</td><td class="texto-fraco">${esc(a.ip || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="texto-fraco">Nenhum registro.</td></tr>'}</tbody>
    </table></div>
    <div class="linha-flex" style="justify-content:space-between;margin-top:16px">
      <span class="texto-fraco">Página ${d.pagina} de ${d.paginas}</span>
      <div class="linha-flex">
        <button class="botao botao--pequeno" id="pag-ant" ${d.pagina <= 1 ? 'disabled' : ''}>${icone('esquerda')} Anterior</button>
        <button class="botao botao--pequeno" id="pag-prox" ${d.pagina >= d.paginas ? 'disabled' : ''}>Próxima ${icone('direita')}</button>
      </div>
    </div>`;
  document.getElementById('filtro-acao').addEventListener('change', (e) => auditoria({ pagina: 1, acao: e.target.value }));
  document.getElementById('pag-ant').addEventListener('click', () => auditoria({ ...filtro, pagina: d.pagina - 1 }));
  document.getElementById('pag-prox').addEventListener('click', () => auditoria({ ...filtro, pagina: d.pagina + 1 }));
}

// ---------------- Conta do admin (trocar senha) ----------------
async function contaAdmin() {
  const { usuario } = await api('/auth/eu');
  elDash.innerHTML = `
    ${cabeca('Conta', 'Dados de acesso da administração.')}
    <form class="cartao" id="form-conta-admin" novalidate style="max-width:620px">
      <div class="campo"><label>Nome</label><input class="entrada" name="nome" value="${esc(usuario.nome)}"></div>
      <div class="campo"><label>E-mail</label><input class="entrada" value="${esc(usuario.email)}" disabled></div>
      <div class="bloco-form"><h2>Trocar senha</h2>
        <p class="texto-fraco">Troque a senha padrão antes de compartilhar o site por um link público.</p>
        <div class="linha-campos">
          <div class="campo"><label for="sa">Senha atual</label><input class="entrada" type="password" id="sa" name="senha_atual" autocomplete="current-password"></div>
          <div class="campo"><label for="ns">Nova senha</label><input class="entrada" type="password" id="ns" name="nova_senha" autocomplete="new-password"></div>
        </div>
      </div>
      <div class="linha-flex" style="justify-content:flex-end"><button class="botao botao--claro" type="submit">Salvar</button></div>
    </form>`;

  document.getElementById('form-conta-admin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      const r = await api('/conta', { metodo: 'PUT', corpo: { nome: f.nome.value, senha_atual: f.senha_atual.value, nova_senha: f.nova_senha.value } });
      sessao.atualizarUsuario({ ...sessao.usuario, nome: r.usuario.nome });
      f.senha_atual.value = f.nova_senha.value = '';
      avisar('Dados salvos.');
    } catch (erro) { avisar(erro.message, 'erro'); }
  });
}

// ---------------- Navegação ----------------
const SECOES_DASH = { geral: visaoGeral, usuarios: () => usuarios(), categorias, auditoria: () => auditoria(), conta: contaAdmin };
function abrirSecao(nome) {
  document.querySelectorAll('#lateral button').forEach((b) => b.classList.toggle('ativo', b.dataset.secao === nome));
  history.replaceState(null, '', `#${nome}`);
  SECOES_DASH[nome]().catch((erro) => { elDash.innerHTML = `<div class="vazio">${esc(erro.message)}</div>`; });
}
if (admin) {
  document.getElementById('lateral').addEventListener('click', (e) => {
    const b = e.target.closest('[data-secao]');
    if (b) abrirSecao(b.dataset.secao);
  });
  const inicial = location.hash.slice(1);
  abrirSecao(SECOES_DASH[inicial] ? inicial : 'geral');
}
