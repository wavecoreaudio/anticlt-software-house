// Cadastro em etapas:
//   1) escolher o tipo de conta (prestador ou cliente)
//   2) prestador escolhe a área (categoria)
//   3) formulário — para o prestador, com as perguntas específicas da área

const cad = { tipo: parametro('tipo'), categoria: null, categorias: [], campos: [], fotos: [] };
const elEtapa = document.getElementById('etapa');

if (sessao.usuario) location.href = '/painel'; // já logado

function barraEtapas(atual) {
  const total = cad.tipo === 'contratante' ? 2 : 3;
  return `<div class="etapas">${Array.from({ length: total }, (_, i) => `<span class="${i < atual ? 'feita' : ''}"></span>`).join('')}</div>`;
}

function trocarArte(slug, titulo, texto) {
  document.getElementById('arte').src = `/img/portfolio/${slug}-3.svg`;
  if (titulo) document.getElementById('arte-titulo').textContent = titulo;
  if (texto) document.getElementById('arte-texto').textContent = texto;
}

// ---------- Etapa 1 ----------
function etapaTipo() {
  cad.tipo = null;
  elEtapa.innerHTML = `
    ${barraEtapas(1)}
    <h1>Criar conta</h1>
    <p class="subtitulo">Como você vai usar o ANTI CLT?</p>
    <div class="escolha-tipo">
      <button class="escolha" data-tipo="prestador">
        ${icone('maleta')}
        <strong>Sou prestador</strong>
        <span>Quero mostrar meu trabalho e encontrar diárias.</span>
      </button>
      <button class="escolha" data-tipo="contratante">
        ${icone('empresa')}
        <strong>Quero contratar</strong>
        <span>Sou empresa ou pessoa e vou publicar vagas.</span>
      </button>
    </div>
    <p class="form-rodape">Já tem conta? <a href="/login">Entrar</a></p>`;
  elEtapa.querySelectorAll('[data-tipo]').forEach((b) => b.addEventListener('click', () => {
    cad.tipo = b.dataset.tipo;
    cad.tipo === 'prestador' ? etapaCategoria() : etapaFormulario();
  }));
}

// ---------- Etapa 2 (prestador) ----------
function etapaCategoria() {
  trocarArte('eletricista', 'Faça parte do trabalho livre.', 'Mostre seu portfólio, defina seus horários e combine o valor direto com o cliente.');
  elEtapa.innerHTML = `
    ${barraEtapas(2)}
    <button class="voltar" id="voltar">${icone('esquerda')} Voltar</button>
    <h1>Qual é a sua área?</h1>
    <p class="subtitulo">O cadastro muda conforme a área: cada profissão tem suas próprias perguntas.</p>
    <div class="grade-categorias">
      ${cad.categorias.map((c) => `
        <button class="escolha" data-id="${c.id}">
          ${icone(c.icone)}
          <div><strong>${esc(c.nome)}</strong><span>${esc(c.descricao || '')}</span></div>
        </button>`).join('')}
    </div>`;
  document.getElementById('voltar').addEventListener('click', etapaTipo);
  elEtapa.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', async () => {
    cad.categoria = cad.categorias.find((c) => c.id === Number(b.dataset.id));
    cad.campos = await api(`/categorias/${cad.categoria.id}/campos`).catch(() => []);
    etapaFormulario();
  }));
}

// ---------- Etapa 3 ----------
function etapaFormulario() {
  const prestador = cad.tipo === 'prestador';
  if (prestador) {
    trocarArte(cad.categoria.slug, `Cadastro de ${cad.categoria.nome.toLowerCase()}`, cad.categoria.descricao);
  } else {
    trocarArte('montador', 'Encontre quem sabe fazer.', 'Publique vagas de diária e veja quem tem interesse, com perfil e contato.');
  }

  elEtapa.innerHTML = `
    ${barraEtapas(prestador ? 3 : 2)}
    <button class="voltar" id="voltar">${icone('esquerda')} Voltar</button>
    <h1>${prestador ? `Perfil de ${esc(cad.categoria.nome)}` : 'Conta de cliente'}</h1>
    <p class="subtitulo">${prestador ? 'Esses dados aparecem no seu perfil público do portfólio.' : 'Use o nome da empresa ou o seu nome.'}</p>
    <div id="mensagem"></div>

    <form id="form-cadastro" novalidate>
      <div class="campo">
        <label for="nome">${prestador ? 'Nome completo' : 'Nome ou empresa'}</label>
        <input class="entrada" id="nome" name="nome" placeholder="${prestador ? 'Ex.: Roberto da Silva' : 'Ex.: Mercadinho Boa Vista'}" required>
      </div>
      <div class="linha-campos">
        <div class="campo"><label for="email">E-mail</label><input class="entrada" type="email" id="email" name="email" placeholder="seu-email@exemplo.com" autocomplete="email" required></div>
        <div class="campo"><label for="telefone">${prestador ? 'WhatsApp' : 'Telefone'}</label><input class="entrada" id="telefone" name="telefone" placeholder="(69) 99999-9999" inputmode="tel"></div>
      </div>
      <div class="campo">
        <label for="senha">Senha <span class="dica">(mínimo 6 caracteres)</span></label>
        <input class="entrada" type="password" id="senha" name="senha" autocomplete="new-password" required>
      </div>

      ${prestador ? `
        <div class="bloco-form">
          <h2>${icone('usuario')} Seu perfil</h2>
          <div class="campo"><label for="titulo">Título do perfil</label><input class="entrada" id="titulo" name="titulo" placeholder="Ex.: ${esc(cad.categoria.nome)} residencial"></div>
          <div class="linha-campos">
            <div class="campo"><label for="bairro">Bairro onde atende</label><input class="entrada" id="bairro" name="bairro" placeholder="Ex.: Centro"></div>
            <div class="campo"><label for="anos">Anos de experiência</label><input class="entrada" type="number" min="0" max="60" id="anos" name="anos" value="1"></div>
          </div>
          <div class="campo"><label for="instagram">Instagram <span class="dica">(opcional)</span></label><input class="entrada" id="instagram" name="instagram" placeholder="@seuperfil"></div>
          <div class="campo"><label for="bio">Sobre o seu trabalho</label><textarea class="entrada" id="bio" name="bio" placeholder="Conte o que você faz, há quanto tempo e como trabalha."></textarea></div>
        </div>

        <div class="bloco-form">
          <h2>${icone(cad.categoria.icone)} Específico de ${esc(cad.categoria.nome.toLowerCase())}</h2>
          ${htmlCamposCategoria(cad.campos)}
        </div>

        <div class="bloco-form">
          <h2>${icone('imagem')} Fotos do seu trabalho <span class="dica">(opcional, até 4 agora)</span></h2>
          <label class="foto-enviar" style="aspect-ratio:auto;padding:28px">
            ${icone('upload')} <span id="fotos-info">Clique para escolher fotos</span>
            <input type="file" id="fotos" accept="image/png,image/jpeg,image/webp" multiple hidden>
          </label>
        </div>` : ''}

      <label class="termos-check">
        <input type="checkbox" name="termos" required>
        <span>Li e aceito os <a href="/privacidade" target="_blank">Termos de Uso e a Política de Privacidade</a>. Entendo que meu nome${prestador ? ', fotos, bairro, WhatsApp e Instagram ficam visíveis no portfólio' : ' aparece nas vagas que eu publicar'}.</span>
      </label>
      <button class="botao botao--claro botao--bloco" type="submit" style="margin-top:18px">Criar conta</button>
      <p class="form-rodape">Já tem conta? <a href="/login?area=${prestador ? 'prestador' : 'cliente'}">Entrar</a></p>
    </form>`;

  document.getElementById('voltar').addEventListener('click', prestador ? etapaCategoria : etapaTipo);
  const form = document.getElementById('form-cadastro');

  document.getElementById('fotos')?.addEventListener('change', (e) => {
    cad.fotos = [...e.target.files].slice(0, 4);
    document.getElementById('fotos-info').textContent = cad.fotos.length
      ? `${cad.fotos.length} foto${cad.fotos.length > 1 ? 's' : ''} selecionada${cad.fotos.length > 1 ? 's' : ''}`
      : 'Clique para escolher fotos';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mensagem = document.getElementById('mensagem');
    const botao = form.querySelector('[type=submit]');
    mensagem.innerHTML = '';
    if (!form.termos.checked) {
      mensagem.innerHTML = '<div class="alerta alerta--erro">Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.</div>';
      mensagem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    botao.disabled = true;
    botao.textContent = 'Criando conta…';

    const corpo = {
      tipo: cad.tipo,
      nome: form.nome.value,
      email: form.email.value,
      senha: form.senha.value,
      telefone: form.telefone.value,
      aceitou_termos: form.termos.checked,
    };
    if (prestador) {
      corpo.prestador = {
        categoria_id: cad.categoria.id,
        titulo: form.titulo.value || `${cad.categoria.nome}`,
        bairro: form.bairro.value,
        anos_experiencia: form.anos.value,
        instagram: form.instagram.value,
        whatsapp: form.telefone.value,
        bio: form.bio.value,
        dados_especificos: lerCamposCategoria(form, cad.campos),
      };
    }

    try {
      const { token, usuario } = await api('/auth/cadastro', { metodo: 'POST', corpo });
      sessao.salvar(token, usuario);

      // Fotos só depois que a conta existe
      for (const arquivo of cad.fotos) {
        try {
          const imagem = await lerImagem(arquivo);
          await api('/prestadores/eu/fotos', { metodo: 'POST', corpo: { imagem } });
        } catch (erroFoto) { console.warn(erroFoto); }
      }
      location.href = '/painel?bemvindo=1';
    } catch (erro) {
      mensagem.innerHTML = `<div class="alerta alerta--erro">${esc(erro.message)}</div>`;
      mensagem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      botao.disabled = false;
      botao.textContent = 'Criar conta';
    }
  });
}

// ---------- Início ----------
(async () => {
  cad.categorias = await api('/categorias').catch(() => []);
  if (cad.tipo === 'prestador') etapaCategoria();
  else if (cad.tipo === 'contratante') etapaFormulario();
  else etapaTipo();
})();
