// Painel do usuário logado.
// Prestador: perfil, fotos, vagas de interesse, mensagens, avaliações e conta.
// Cliente (contratante no banco): CRUD das vagas, interessados, mensagens, favoritos e conta.

const eu = exigirSessao('prestador', 'contratante');
const elConteudo = document.getElementById('conteudo');
const elLateral = document.getElementById('lateral');
let categoriasPainel = [];

const SECOES = eu?.tipo === 'prestador'
  ? [['perfil', 'usuario', 'Meu perfil'], ['fotos', 'imagem', 'Fotos'], ['interesses', 'maleta', 'Minhas vagas'],
     ['mensagens', 'chat', 'Mensagens'], ['avaliacoes', 'estrela', 'Avaliações'], ['conta', 'escudo', 'Conta']]
  : [['vagas', 'maleta', 'Minhas vagas'], ['mensagens', 'chat', 'Mensagens'], ['favoritos', 'coracao', 'Favoritos'], ['conta', 'escudo', 'Conta']];
let pararChat = null; // função que desliga a atualização automática do chat

function cabecalhoSecao(titulo, subtitulo, acao = '') {
  return `<header><div><h1 class="painel__titulo">${titulo}</h1><p class="texto-suave" style="margin:0">${subtitulo}</p></div>${acao}</header>`;
}

function irPara(secao) {
  if (pararChat) { pararChat(); pararChat = null; }
  elLateral.querySelectorAll('button').forEach((b) => b.classList.toggle('ativo', b.dataset.secao === secao));
  history.replaceState(null, '', `${location.search}#${secao}`);
  const secoes = {
    perfil: secaoPerfil, fotos: secaoFotos, interesses: secaoInteresses, vagas: secaoVagas, conta: secaoConta,
    mensagens: secaoMensagens, favoritos: secaoFavoritos, avaliacoes: secaoAvaliacoes,
  };
  secoes[secao]().catch((erro) => { elConteudo.innerHTML = `<div class="vazio">${esc(erro.message)}</div>`; });
}

// =============== PRESTADOR ===============
async function secaoPerfil() {
  elConteudo.innerHTML = '<p class="carregando">Carregando perfil…</p>';
  const p = await api('/prestadores/eu/perfil');
  let campos = await api(`/categorias/${p.categoria_id}/campos`);

  elConteudo.innerHTML = `
    ${cabecalhoSecao('Meu perfil', 'O que aparece para quem visita o portfólio.',
      `<a class="botao botao--pequeno" href="/portfolio?categoria=${esc(p.categoria_slug)}" target="_blank">${icone('olho')} Ver no portfólio</a>`)}
    <form class="cartao" id="form-perfil" novalidate>
      <div class="linha-campos">
        <div class="campo"><label for="nome">Nome</label><input class="entrada" id="nome" name="nome" value="${esc(p.nome)}"></div>
        <div class="campo"><label for="categoria">Área</label>
          <select class="entrada" id="categoria" name="categoria">
            ${categoriasPainel.map((c) => `<option value="${c.id}" ${c.id === p.categoria_id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
          </select></div>
      </div>
      <div class="campo"><label for="titulo">Título do perfil</label><input class="entrada" id="titulo" name="titulo" value="${esc(p.titulo)}"></div>
      <div class="linha-campos">
        <div class="campo"><label for="bairro">Bairro</label><input class="entrada" id="bairro" name="bairro" value="${esc(p.bairro || '')}"></div>
        <div class="campo"><label for="anos">Anos de experiência</label><input class="entrada" type="number" min="0" max="60" id="anos" name="anos" value="${p.anos_experiencia}"></div>
      </div>
      <div class="linha-campos">
        <div class="campo"><label for="whatsapp">WhatsApp</label><input class="entrada" id="whatsapp" name="whatsapp" value="${esc(formatarTelefone(p.whatsapp))}"></div>
        <div class="campo"><label for="instagram">Instagram</label><input class="entrada" id="instagram" name="instagram" value="${p.instagram ? '@' + esc(p.instagram) : ''}"></div>
      </div>
      <div class="campo"><label for="bio">Sobre o seu trabalho</label><textarea class="entrada" id="bio" name="bio">${esc(p.bio || '')}</textarea></div>
      <div class="bloco-form"><h2 id="titulo-especificos">Específico da área</h2><div id="especificos">${htmlCamposCategoria(campos, p.dados_especificos)}</div></div>
      <div class="linha-flex" style="justify-content:flex-end;margin-top:10px"><button class="botao botao--claro" type="submit">Salvar alterações</button></div>
    </form>`;

  const form = document.getElementById('form-perfil');
  // Trocou a área? Carrega as perguntas da nova área
  form.categoria.addEventListener('change', async () => {
    campos = await api(`/categorias/${form.categoria.value}/campos`);
    document.getElementById('especificos').innerHTML = htmlCamposCategoria(campos);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const atualizado = await api('/prestadores/eu/perfil', {
        metodo: 'PUT',
        corpo: {
          nome: form.nome.value, categoria_id: Number(form.categoria.value), titulo: form.titulo.value,
          bairro: form.bairro.value, anos_experiencia: form.anos.value, whatsapp: form.whatsapp.value,
          instagram: form.instagram.value, bio: form.bio.value,
          dados_especificos: lerCamposCategoria(form, campos),
        },
      });
      sessao.atualizarUsuario({ ...sessao.usuario, nome: atualizado.nome });
      avisar('Perfil atualizado.');
    } catch (erro) { avisar(erro.message, 'erro'); }
  });
}

async function secaoFotos() {
  const p = await api('/prestadores/eu/perfil');
  elConteudo.innerHTML = `
    ${cabecalhoSecao('Fotos', `${p.fotos.length} de 8 fotos. Elas aparecem no carrossel do seu perfil, nesta ordem.`)}
    <div class="fotos-grade">
      ${p.fotos.map((f) => `
        <div class="foto-item">
          <img src="${esc(f.caminho)}" alt="${esc(f.legenda || '')}">
          <button data-apagar="${f.id}" aria-label="Apagar foto">${icone('lixo')}</button>
        </div>`).join('')}
      ${p.fotos.length < 8 ? `
        <label class="foto-enviar">
          ${icone('upload')} Adicionar foto<br><span class="dica">PNG, JPG ou WEBP</span>
          <input type="file" id="nova-foto" accept="image/png,image/jpeg,image/webp" hidden>
        </label>` : ''}
    </div>
    <h2 style="font-size:16px;font-weight:500;margin:40px 0 14px">Prévia no portfólio</h2>
    <div style="max-width:340px" class="post">${htmlCarrossel(p.fotos, p.nome)}</div>`;
  ativarCarrosseis(elConteudo);

  document.getElementById('nova-foto')?.addEventListener('change', async (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    try {
      const imagem = await lerImagem(arquivo);
      await api('/prestadores/eu/fotos', { metodo: 'POST', corpo: { imagem } });
      avisar('Foto adicionada.');
      secaoFotos();
    } catch (erro) { avisar(erro.message, 'erro'); }
  });

  elConteudo.querySelectorAll('[data-apagar]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmar('Apagar esta foto?', 'Apagar'))) return;
    try {
      await api(`/prestadores/eu/fotos/${b.dataset.apagar}`, { metodo: 'DELETE' });
      avisar('Foto apagada.');
      secaoFotos();
    } catch (erro) { avisar(erro.message, 'erro'); }
  }));
}

async function secaoInteresses() {
  const lista = await api('/prestadores/eu/interesses');
  elConteudo.innerHTML = `
    ${cabecalhoSecao('Minhas vagas', 'Vagas em que você demonstrou interesse.', '<a class="botao botao--claro botao--pequeno" href="/vagas">Procurar vagas</a>')}
    ${lista.length === 0 ? '<div class="vazio">Você ainda não demonstrou interesse em nenhuma vaga.</div>' : `
    <div class="tabela-caixa"><table class="tabela">
      <thead><tr><th>Vaga</th><th>Cliente</th><th>Data</th><th>Situação</th><th></th></tr></thead>
      <tbody>${lista.map((i) => `
        <tr>
          <td>${esc(i.titulo)}<br><span class="texto-fraco">${esc(i.bairro || '')}</span></td>
          <td>${esc(i.contratante)}</td>
          <td>${formatarData(i.data_servico)} ${i.horario ? `<span class="texto-fraco">· ${esc(i.horario)}</span>` : ''}</td>
          <td><span class="etiqueta ${i.status === 'aberta' ? 'etiqueta--ok' : 'etiqueta--off'}">${i.status}</span></td>
          <td class="num"><div class="linha-flex" style="justify-content:flex-end;flex-wrap:nowrap">
            <button class="botao botao--pequeno" data-conversar-vaga="${i.vaga_id}" title="Mensagem ao cliente">${icone('chat')}</button>
            ${i.status === 'aberta' ? `<button class="botao botao--pequeno" data-desistir="${i.vaga_id}">Retirar</button>` : ''}
          </div></td>
        </tr>`).join('')}</tbody>
    </table></div>`}`;

  elConteudo.querySelectorAll('[data-conversar-vaga]').forEach((b) => b.addEventListener('click', async () => {
    try {
      const { id } = await api('/conversas', { metodo: 'POST', corpo: { vaga_id: Number(b.dataset.conversarVaga) } });
      history.replaceState(null, '', `?conversa=${id}#mensagens`);
      irPara('mensagens');
    } catch (erro) { avisar(erro.message, 'erro'); }
  }));

  elConteudo.querySelectorAll('[data-desistir]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmar('Retirar seu interesse nesta vaga?', 'Retirar'))) return;
    try {
      await api(`/vagas/${b.dataset.desistir}/interesse`, { metodo: 'DELETE' });
      avisar('Interesse retirado.');
      secaoInteresses();
    } catch (erro) { avisar(erro.message, 'erro'); }
  }));
}

// =============== CONTRATANTE ===============
async function secaoVagas() {
  const vagas = await api('/vagas/minhas');
  elConteudo.innerHTML = `
    ${cabecalhoSecao('Minhas vagas', 'Publique, edite, encerre e veja quem tem interesse.',
      `<button class="botao botao--claro" id="nova-vaga">${icone('mais')} Nova vaga</button>`)}
    ${vagas.length === 0 ? '<div class="vazio">Você ainda não publicou vagas.</div>' : `
    <div class="tabela-caixa"><table class="tabela">
      <thead><tr><th>Vaga</th><th>Categoria</th><th>Data</th><th>Situação</th><th class="num">Interessados</th><th></th></tr></thead>
      <tbody>${vagas.map((v) => `
        <tr>
          <td>${esc(v.titulo)}<br><span class="texto-fraco">${esc(v.bairro || '')}</span></td>
          <td>${esc(v.categoria_nome)}</td>
          <td>${formatarData(v.data_servico)}</td>
          <td><span class="etiqueta ${v.status === 'aberta' ? 'etiqueta--ok' : 'etiqueta--off'}">${v.status}</span></td>
          <td class="num"><button class="botao botao--pequeno" data-ver="${v.id}" ${v.total_interessados ? '' : 'disabled'}>${icone('usuario')} ${v.total_interessados}</button></td>
          <td class="num">
            <div class="linha-flex" style="justify-content:flex-end;flex-wrap:nowrap">
              <button class="botao botao--pequeno" data-editar="${v.id}" title="Editar">${icone('editar')}</button>
              <button class="botao botao--pequeno" data-status="${v.id}">${v.status === 'aberta' ? 'Encerrar' : 'Reabrir'}</button>
              <button class="botao botao--pequeno botao--perigo" data-excluir="${v.id}" title="Excluir">${icone('lixo')}</button>
            </div>
          </td>
        </tr>`).join('')}</tbody>
    </table></div>`}`;

  document.getElementById('nova-vaga').addEventListener('click', () => formularioVaga());
  const acharVaga = (id) => vagas.find((v) => v.id === Number(id));

  elConteudo.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => formularioVaga(acharVaga(b.dataset.editar))));
  elConteudo.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => verInteressados(acharVaga(b.dataset.ver))));
  elConteudo.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', async () => {
    const v = acharVaga(b.dataset.status);
    try {
      await api(`/vagas/${v.id}`, { metodo: 'PUT', corpo: { status: v.status === 'aberta' ? 'encerrada' : 'aberta' } });
      avisar(v.status === 'aberta' ? 'Vaga encerrada.' : 'Vaga reaberta.');
      secaoVagas();
    } catch (erro) { avisar(erro.message, 'erro'); }
  }));
  elConteudo.querySelectorAll('[data-excluir]').forEach((b) => b.addEventListener('click', async () => {
    if (!(await confirmar('Excluir esta vaga?', 'Excluir'))) return;
    try {
      await api(`/vagas/${b.dataset.excluir}`, { metodo: 'DELETE' });
      avisar('Vaga excluída.');
      secaoVagas();
    } catch (erro) { avisar(erro.message, 'erro'); }
  }));
}

function formularioVaga(vaga) {
  const caixa = abrirModal(`
    <h2 style="font-size:24px;font-weight:500">${vaga ? 'Editar vaga' : 'Nova vaga de diária'}</h2>
    <p class="texto-suave">Prestadores da categoria escolhida verão a vaga na página de vagas.</p>
    <div id="msg-vaga"></div>
    <form id="form-vaga" novalidate>
      <div class="campo"><label for="v-titulo">Título</label><input class="entrada" id="v-titulo" name="titulo" value="${esc(vaga?.titulo || '')}" placeholder="Ex.: Troca de fiação da cozinha"></div>
      <div class="campo"><label for="v-cat">Categoria</label>
        <select class="entrada" id="v-cat" name="categoria_id">
          <option value="">Selecione…</option>
          ${categoriasPainel.map((c) => `<option value="${c.id}" ${vaga?.categoria_id === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}
        </select></div>
      <div class="linha-campos">
        <div class="campo"><label for="v-data">Data</label><input class="entrada" type="date" id="v-data" name="data_servico" value="${esc(vaga?.data_servico || '')}"></div>
        <div class="campo"><label for="v-hora">Horário</label><input class="entrada" id="v-hora" name="horario" value="${esc(vaga?.horario || '')}" placeholder="Ex.: 08h às 17h"></div>
      </div>
      <div class="campo"><label for="v-bairro">Bairro</label><input class="entrada" id="v-bairro" name="bairro" value="${esc(vaga?.bairro || '')}"></div>
      <div class="campo"><label for="v-desc">Descrição</label><textarea class="entrada" id="v-desc" name="descricao" placeholder="O que precisa ser feito, materiais, observações.">${esc(vaga?.descricao || '')}</textarea></div>
      <div class="linha-flex" style="justify-content:flex-end"><button class="botao botao--claro" type="submit">${vaga ? 'Salvar' : 'Publicar vaga'}</button></div>
    </form>`, { estreita: true });

  caixa.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const corpo = {
      titulo: f.titulo.value, categoria_id: Number(f.categoria_id.value), data_servico: f.data_servico.value,
      horario: f.horario.value, bairro: f.bairro.value, descricao: f.descricao.value,
    };
    try {
      await api(vaga ? `/vagas/${vaga.id}` : '/vagas', { metodo: vaga ? 'PUT' : 'POST', corpo });
      fecharModal();
      avisar(vaga ? 'Vaga atualizada.' : 'Vaga publicada.');
      secaoVagas();
    } catch (erro) {
      caixa.querySelector('#msg-vaga').innerHTML = `<div class="alerta alerta--erro">${esc(erro.message)}</div>`;
    }
  });
}

async function verInteressados(vaga) {
  const lista = await api(`/vagas/${vaga.id}/interessados`);
  abrirModal(`
    <h2 style="font-size:24px;font-weight:500">Interessados</h2>
    <p class="texto-suave">${esc(vaga.titulo)}</p>
    <div style="display:grid;gap:10px;margin-top:18px">
      ${lista.map((i) => `
        <div class="cartao" style="padding:16px;display:flex;align-items:center;gap:14px">
          <div class="avatar">${esc(iniciais(i.nome))}</div>
          <div style="flex:1;min-width:0">
            <strong style="font-weight:500">${esc(i.nome)}</strong><br>
            <span class="texto-fraco">${esc(i.titulo)} · ${esc(i.bairro || '')}</span>
            ${i.mensagem ? `<div class="texto-suave" style="font-size:14px">"${esc(i.mensagem)}"</div>` : ''}
          </div>
          <div class="linha-flex" style="flex-wrap:nowrap">
            <button class="botao botao--pequeno" data-conversar="${i.prestador_id}" title="Mensagem pelo site">${icone('chat')}</button>
            ${i.whatsapp ? `<a class="botao botao--claro botao--pequeno" href="${linkWhatsapp(i.whatsapp, `Olá ${i.nome.split(' ')[0]}! Vi seu interesse na vaga "${vaga.titulo}" no ANTI CLT.`)}" target="_blank" rel="noopener">${icone('whatsapp')} WhatsApp</a>` : ''}
          </div>
        </div>`).join('')}
    </div>`, { estreita: true });

  document.querySelector('.modal').querySelectorAll('[data-conversar]').forEach((b) => b.addEventListener('click', async () => {
    try {
      const { id } = await api('/conversas', { metodo: 'POST', corpo: { prestador_id: Number(b.dataset.conversar) } });
      fecharModal();
      history.replaceState(null, '', `?conversa=${id}#mensagens`);
      irPara('mensagens');
    } catch (erro) { avisar(erro.message, 'erro'); }
  }));
}

// =============== CONTA (os dois tipos) ===============
async function secaoConta() {
  const { usuario } = await api('/auth/eu');
  elConteudo.innerHTML = `
    ${cabecalhoSecao('Conta', 'Seus dados de acesso.')}
    <form class="cartao" id="form-conta" novalidate>
      <div class="linha-campos">
        <div class="campo"><label>Nome</label><input class="entrada" name="nome" value="${esc(usuario.nome)}"></div>
        <div class="campo"><label>Telefone</label><input class="entrada" name="telefone" value="${esc(formatarTelefone(usuario.telefone))}"></div>
      </div>
      <div class="campo"><label>E-mail</label><input class="entrada" value="${esc(usuario.email)}" disabled></div>
      <div class="bloco-form"><h2>Trocar senha</h2>
        <div class="linha-campos">
          <div class="campo"><label>Senha atual</label><input class="entrada" type="password" name="senha_atual" autocomplete="current-password"></div>
          <div class="campo"><label>Nova senha</label><input class="entrada" type="password" name="nova_senha" autocomplete="new-password"></div>
        </div>
      </div>
      <div class="linha-flex" style="justify-content:flex-end"><button class="botao botao--claro" type="submit">Salvar</button></div>
    </form>
    <div class="cartao" style="margin-top:20px;display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap">
      <div><h3 style="font-size:17px;font-weight:500;margin:0">Meus dados (LGPD)</h3><p class="texto-fraco" style="margin:0">Baixe uma cópia de tudo o que o ANTI CLT guarda sobre você. <a href="/privacidade" style="text-decoration:underline">Política de privacidade</a></p></div>
      <button class="botao" id="baixar-dados">${icone('baixar')} Baixar meus dados</button>
    </div>
    <div class="cartao" style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap">
      <div><h3 style="font-size:17px;font-weight:500;margin:0">Excluir conta</h3><p class="texto-fraco" style="margin:0">Apaga a conta, o perfil, as fotos e as vagas ligadas a ela.</p></div>
      <button class="botao botao--perigo" id="excluir-conta">${icone('lixo')} Excluir minha conta</button>
    </div>`;

  document.getElementById('form-conta').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      const r = await api('/conta', { metodo: 'PUT', corpo: {
        nome: f.nome.value, telefone: f.telefone.value, senha_atual: f.senha_atual.value, nova_senha: f.nova_senha.value,
      } });
      sessao.atualizarUsuario({ ...sessao.usuario, nome: r.usuario.nome });
      f.senha_atual.value = f.nova_senha.value = '';
      avisar('Dados salvos.');
    } catch (erro) { avisar(erro.message, 'erro'); }
  });

  document.getElementById('baixar-dados').addEventListener('click', async () => {
    try { await baixarArquivo('/conta/dados', 'meus-dados-anticlt.json'); } catch (erro) { avisar(erro.message, 'erro'); }
  });

  document.getElementById('excluir-conta').addEventListener('click', async () => {
    if (!(await confirmar('Excluir sua conta definitivamente?', 'Excluir conta'))) return;
    try {
      await api('/conta', { metodo: 'DELETE' });
      sessao.limpar();
      location.href = '/';
    } catch (erro) { avisar(erro.message, 'erro'); }
  });
}

// =============== MENSAGENS (os dois tipos) ===============
async function secaoMensagens() {
  const lista = await api('/conversas');
  const escolhida = Number(parametro('conversa')) || lista[0]?.id;

  elConteudo.innerHTML = `
    ${cabecalhoSecao('Mensagens', eu.tipo === 'prestador' ? 'Conversas com clientes.' : 'Conversas com prestadores. Abra uma pelo botão "Enviar mensagem" no portfólio.')}
    ${lista.length === 0 ? `<div class="vazio">Nenhuma conversa ainda.${eu.tipo === 'contratante' ? ' <a href="/portfolio" style="text-decoration:underline">Ir ao portfólio</a>' : ''}</div>` : `
    <div class="chat">
      <div class="chat__lista" id="chat-lista">
        ${lista.map((c) => `
          <button class="chat__item ${c.id === escolhida ? 'ativo' : ''}" data-conversa="${c.id}">
            <div class="avatar">${esc(iniciais(c.com_quem))}</div>
            <div class="chat__item-texto"><strong>${esc(c.com_quem)}</strong><span>${esc(c.ultima || 'Sem mensagens ainda')}</span></div>
            ${c.nao_lidas && c.id !== escolhida ? `<span class="selo">${c.nao_lidas}</span>` : ''}
          </button>`).join('')}
      </div>
      <div class="chat__conversa" id="chat-conversa"></div>
    </div>`}`;
  if (!lista.length) return;

  document.getElementById('chat-lista').addEventListener('click', (e) => {
    const b = e.target.closest('[data-conversa]');
    if (!b) return;
    document.querySelectorAll('.chat__item').forEach((x) => x.classList.toggle('ativo', x === b));
    b.querySelector('.selo')?.remove();
    abrirChat(lista.find((c) => c.id === Number(b.dataset.conversa)));
  });
  abrirChat(lista.find((c) => c.id === escolhida) || lista[0]);
}

function abrirChat(conversa) {
  if (pararChat) pararChat();
  history.replaceState(null, '', `?conversa=${conversa.id}#mensagens`);
  const el = document.getElementById('chat-conversa');
  el.innerHTML = `
    <div class="chat__cabeca">
      <div class="avatar">${esc(iniciais(conversa.com_quem))}</div>
      <div><strong style="font-weight:500">${esc(conversa.com_quem)}</strong><div class="texto-fraco">${esc(conversa.detalhe || '')}</div></div>
    </div>
    <div class="chat__mensagens" id="chat-mensagens" aria-live="polite"></div>
    <form class="chat__enviar" id="chat-form">
      <label class="sr-only" for="chat-texto">Mensagem</label>
      <input class="entrada" id="chat-texto" autocomplete="off" maxlength="1000" placeholder="Escreva uma mensagem…">
      <button class="botao botao--claro" type="submit" aria-label="Enviar">${icone('enviar')}</button>
    </form>`;

  const caixa = document.getElementById('chat-mensagens');
  let ultimoId = 0;

  const desenhar = (msgs) => {
    if (!msgs.length) {
      if (!ultimoId) caixa.innerHTML = '<div class="chat__vazio">Diga olá! As mensagens aparecem aqui.</div>';
      return;
    }
    if (!ultimoId) caixa.innerHTML = '';
    const perto = caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight < 80;
    caixa.insertAdjacentHTML('beforeend', msgs.map((m) => `
      <div class="msg ${m.minha ? 'msg--minha' : ''}">${esc(m.texto)}<time>${formatarData(m.criado_em, true)}</time></div>`).join(''));
    ultimoId = msgs[msgs.length - 1].id;
    if (perto || msgs.some((m) => m.minha)) caixa.scrollTop = caixa.scrollHeight;
  };

  // Busca só as mensagens novas (id maior que a última recebida)
  const buscar = async () => {
    try {
      desenhar(await api(`/conversas/${conversa.id}/mensagens?depois=${ultimoId}`));
      window.atualizarSeloMensagens?.();
    } catch { /* tenta de novo no próximo ciclo */ }
  };
  buscar().then(() => { caixa.scrollTop = caixa.scrollHeight; });
  const intervalo = setInterval(buscar, 4000);
  pararChat = () => clearInterval(intervalo);

  document.getElementById('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const campo = document.getElementById('chat-texto');
    const texto = campo.value.trim();
    if (!texto) return;
    campo.value = '';
    try {
      await api(`/conversas/${conversa.id}/mensagens`, { metodo: 'POST', corpo: { texto } });
      await buscar();
      const item = document.querySelector(`[data-conversa="${conversa.id}"] .chat__item-texto span`);
      if (item) item.textContent = texto;
    } catch (erro) {
      campo.value = texto;
      avisar(erro.message, 'erro');
    }
  });
  document.getElementById('chat-texto').focus();
}

// =============== FAVORITOS (cliente) ===============
async function secaoFavoritos() {
  const lista = await api('/favoritos');
  elConteudo.innerHTML = `
    ${cabecalhoSecao('Favoritos', 'Prestadores que você salvou no portfólio.', '<a class="botao botao--pequeno" href="/portfolio">Ir ao portfólio</a>')}
    ${lista.length === 0 ? '<div class="vazio">Você ainda não salvou ninguém. Use o coração nos cartões do portfólio.</div>' : `
    <div class="fav-grade">
      ${lista.map((p) => `
        <div class="cartao fav">
          <img src="${esc(p.capa || '/img/sem-foto.svg')}" alt="">
          <div style="flex:1;min-width:0">
            <strong style="font-weight:500;display:block">${esc(p.nome)}</strong>
            <span class="texto-fraco">${esc(p.categoria_nome)} · ${esc(p.bairro || '')}</span><br>
            ${resumoNota(p.media_avaliacao, p.total_avaliacoes)}
            <div class="linha-flex" style="margin-top:10px;gap:6px">
              <button class="botao botao--pequeno botao--claro" data-conversar="${p.id}">${icone('chat')} Mensagem</button>
              <button class="botao botao--pequeno" data-remover="${p.id}" title="Remover">${icone('lixo')}</button>
            </div>
          </div>
        </div>`).join('')}
    </div>`}`;

  elConteudo.querySelectorAll('[data-remover]').forEach((b) => b.addEventListener('click', async () => {
    try {
      await api(`/favoritos/${b.dataset.remover}`, { metodo: 'DELETE' });
      avisar('Removido dos favoritos.');
      secaoFavoritos();
    } catch (erro) { avisar(erro.message, 'erro'); }
  }));
  elConteudo.querySelectorAll('[data-conversar]').forEach((b) => b.addEventListener('click', async () => {
    try {
      const { id } = await api('/conversas', { metodo: 'POST', corpo: { prestador_id: Number(b.dataset.conversar) } });
      history.replaceState(null, '', `?conversa=${id}#mensagens`);
      irPara('mensagens');
    } catch (erro) { avisar(erro.message, 'erro'); }
  }));
}

// =============== AVALIAÇÕES RECEBIDAS (prestador) ===============
async function secaoAvaliacoes() {
  const lista = await api('/prestadores/eu/avaliacoes');
  const media = lista.length ? Math.round((lista.reduce((s, a) => s + a.nota, 0) / lista.length) * 10) / 10 : null;
  elConteudo.innerHTML = `
    ${cabecalhoSecao('Avaliações', 'O que os clientes disseram sobre o seu trabalho.')}
    ${lista.length === 0 ? '<div class="vazio">Você ainda não recebeu avaliações.</div>' : `
    <div class="cartao" style="display:flex;align-items:center;gap:24px;margin-bottom:20px">
      <div class="avaliacoes__media">${String(media).replace('.', ',')}</div>
      <div>${estrelas(media, { tamanho: 'grande' })}<div class="texto-fraco">${lista.length} ${lista.length > 1 ? 'avaliações' : 'avaliação'}</div></div>
    </div>
    <div class="cartao" style="padding:6px 28px">
      ${lista.map((a) => `
        <div class="avaliacao">
          <div class="linha-flex entre"><strong style="font-weight:500">${esc(a.cliente)}</strong><span class="texto-fraco">${formatarData(a.criado_em)}</span></div>
          ${estrelas(a.nota)}
          ${a.comentario ? `<p>${esc(a.comentario)}</p>` : ''}
        </div>`).join('')}
    </div>`}`;
}

// =============== Início ===============
(async () => {
  if (!eu) return;
  elLateral.innerHTML = SECOES.map(([id, ic, nome]) => `<button data-secao="${id}">${icone(ic)} ${nome}</button>`).join('');
  elLateral.addEventListener('click', (e) => {
    const b = e.target.closest('[data-secao]');
    if (b) irPara(b.dataset.secao);
  });
  categoriasPainel = await api('/categorias').catch(() => []);
  if (parametro('bemvindo')) avisar('Conta criada! Bem-vindo ao ANTI CLT.');
  const inicial = location.hash.slice(1);
  irPara(SECOES.some(([id]) => id === inicial) ? inicial : SECOES[0][0]);
})().catch((erro) => {
  elConteudo.innerHTML = `<div class="vazio">${esc(erro.message)}</div>`;
});
