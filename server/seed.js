// Dados de exemplo (fictícios) para apresentar o sistema.
// Roda sozinho quando o banco está vazio, ou manualmente:
//   npm run seed     -> insere se estiver vazio
//   npm run reset    -> apaga tudo e insere de novo

const { run, get, exec, iniciarBanco, fechar } = require('./db');
const { gerarHash } = require('./auth');

// Gerador pseudoaleatório com semente fixa: o seed sai sempre igual
let semente = 42;
function aleatorio() {
  semente = (semente * 1664525 + 1013904223) % 4294967296;
  return semente / 4294967296;
}
const sortear = (lista) => lista[Math.floor(aleatorio() * lista.length)];

// Data/hora "há N dias" no formato do SQLite
function diasAtras(n, hora = 9 + Math.floor(aleatorio() * 10)) {
  const d = new Date();
  if (n === 0) hora = Math.min(hora, Math.max(0, d.getHours() - 1)); // hoje: nunca no futuro
  d.setDate(d.getDate() - n);
  d.setHours(hora, Math.floor(aleatorio() * 60), 0, 0);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
}
function diaFuturo(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const CATEGORIAS = [
  { slug: 'eletricista', nome: 'Eletricista', icone: 'raio', descricao: 'Instalações, reparos e manutenção elétrica.',
    campos: [
      ['area_atuacao', 'Área de atuação', 'select', ['Residencial', 'Predial', 'Comercial', 'Industrial'], 1],
      ['nr10', 'Possui certificado NR-10?', 'select', ['Sim', 'Não'], 1],
      ['servicos', 'Serviços que realiza', 'multipla', ['Instalação de tomadas', 'Quadro de distribuição', 'Iluminação', 'Padrão de energia', 'Manutenção preventiva'], 1],
    ] },
  { slug: 'encanador', nome: 'Encanador', icone: 'gota', descricao: 'Hidráulica, vazamentos e desentupimento.',
    campos: [
      ['servicos', 'Serviços que realiza', 'multipla', ['Vazamentos', 'Instalação hidráulica', 'Desentupimento', 'Caixa d\'água', 'Aquecedores'], 1],
      ['emergencia', 'Atende emergência?', 'select', ['Sim, 24 horas', 'Só em horário comercial'], 1],
    ] },
  { slug: 'pintor', nome: 'Pintor', icone: 'rolo', descricao: 'Pintura interna, externa e texturas.',
    campos: [
      ['tipos', 'Tipos de pintura', 'multipla', ['Interna', 'Externa', 'Textura', 'Grafiato', 'Portões e grades'], 1],
      ['material', 'Fornece o material?', 'select', ['Sim', 'Não', 'A combinar'], 1],
    ] },
  { slug: 'pedreiro', nome: 'Pedreiro', icone: 'tijolo', descricao: 'Pequenas obras, reformas e acabamento.',
    campos: [
      ['servicos', 'Serviços que realiza', 'multipla', ['Alvenaria', 'Reboco', 'Piso e revestimento', 'Contrapiso', 'Pequenas reformas'], 1],
      ['ajudante', 'Trabalha com ajudante?', 'select', ['Sim', 'Não'], 0],
    ] },
  { slug: 'jardinagem', nome: 'Jardinagem', icone: 'folha', descricao: 'Poda, corte de grama e limpeza de terreno.',
    campos: [
      ['servicos', 'Serviços que realiza', 'multipla', ['Corte de grama', 'Poda de árvores', 'Paisagismo', 'Limpeza de terreno'], 1],
      ['equipamento', 'Tem equipamento próprio?', 'select', ['Sim, completo', 'Parcial', 'Não'], 1],
    ] },
  { slug: 'limpeza', nome: 'Limpeza e Diárias', icone: 'brilho', descricao: 'Faxina residencial, comercial e pós-obra.',
    campos: [
      ['tipos', 'Tipo de limpeza', 'multipla', ['Residencial', 'Comercial', 'Pós-obra', 'Passadoria'], 1],
      ['produtos', 'Leva os produtos?', 'select', ['Sim', 'Não', 'A combinar'], 1],
    ] },
  { slug: 'montador', nome: 'Montador de Móveis', icone: 'chave', descricao: 'Montagem e desmontagem de móveis.',
    campos: [
      ['moveis', 'Móveis que monta', 'multipla', ['Guarda-roupa', 'Cozinha planejada', 'Escritório', 'Painel de TV', 'Camas e berços'], 1],
      ['desmontagem', 'Faz desmontagem para mudança?', 'select', ['Sim', 'Não'], 0],
    ] },
  { slug: 'ar-condicionado', nome: 'Ar-condicionado', icone: 'floco', descricao: 'Instalação, limpeza e manutenção.',
    campos: [
      ['servicos', 'Serviços que realiza', 'multipla', ['Instalação', 'Higienização', 'Carga de gás', 'Manutenção'], 1],
      ['capacidade', 'Capacidade máxima que atende', 'select', ['Até 12.000 BTUs', 'Até 24.000 BTUs', 'Acima de 24.000 BTUs'], 1],
    ] },
];

const BAIRROS = ['Centro', 'Olaria', 'São Cristóvão', 'Embratel', 'Nova Porto Velho', 'Agenor de Carvalho',
  'Pedrinhas', 'Caiari', 'Igarapé', 'Lagoa', 'Cohab', 'Tancredo Neves', 'Industrial', 'Nacional'];

// [nome, categoria, titulo, bio, anos]
const PRESTADORES = [
  ['Renato Siqueira', 'eletricista', 'Eletricista residencial e predial', 'Faço instalação completa, troca de quadro e iluminação de LED. Trabalho limpo e organizado.', 12],
  ['Marcos Vinícius Rocha', 'eletricista', 'Eletricista para comércio', 'Atendo lojas, escritórios e condomínios. Manutenção preventiva com relatório.', 7],
  ['Douglas Thiago Lima', 'encanador', 'Encanador e caça-vazamentos', 'Resolvo vazamento, entupimento e instalo caixa d\'água. Atendo emergência.', 9],
  ['Sebastião Moura', 'encanador', 'Hidráulica em geral', 'Instalação de pias, chuveiros e aquecedores. Mais de 15 anos na área.', 16],
  ['Jéssica Pereira', 'pintor', 'Pintora de interiores', 'Pintura de apartamentos e casas com acabamento caprichado e proteção dos móveis.', 6],
  ['Antônio Carlos Brito', 'pintor', 'Pintura externa e texturas', 'Fachadas, muros, grafiato e textura. Orçamento no local.', 14],
  ['Raimundo Nonato Silva', 'pedreiro', 'Pedreiro de acabamento', 'Piso, porcelanato e revestimento. Pequenas reformas de banheiro e cozinha.', 20],
  ['Wellington Costa', 'pedreiro', 'Reformas e alvenaria', 'Muros, ampliações e reboco. Trabalho com ajudante para agilizar a obra.', 11],
  ['Carlos Matos', 'jardinagem', 'Jardineiro e paisagista', 'Corte de grama, poda e manutenção de jardins residenciais.', 8],
  ['Francisca Alves', 'jardinagem', 'Limpeza de terreno e roçagem', 'Roçagem, limpeza de lote e retirada de entulho verde.', 5],
  ['Maria do Socorro Dias', 'limpeza', 'Diarista residencial', 'Faxina completa, organização e passadoria. Referências disponíveis.', 10],
  ['Luana Ferreira', 'limpeza', 'Limpeza pós-obra e comercial', 'Equipe pronta para limpeza pesada de pós-obra e escritórios.', 4],
  ['Paulo Henrique Souza', 'montador', 'Montador de móveis', 'Monto guarda-roupa, cozinha e móveis de escritório de todas as marcas.', 6],
  ['Gilberto Nunes', 'montador', 'Montagem e mudança', 'Desmontagem, montagem e instalação de painéis de TV.', 9],
  ['Felipe Andrade', 'ar-condicionado', 'Técnico de refrigeração', 'Instalação e higienização de split. Atendo residências e empresas.', 7],
  ['Rodrigo Mendes', 'ar-condicionado', 'Manutenção de ar-condicionado', 'Carga de gás, limpeza e conserto. Garantia no serviço.', 12],
];

const CONTRATANTES = [
  ['Mercadinho Boa Vista', 'contato@mercadinho.exemplo'],
  ['Condomínio Residencial Ipê', 'sindico@condominioipe.exemplo'],
  ['Padaria Pão Quente', 'gerencia@paoquente.exemplo'],
  ['Escritório Lima & Souza', 'adm@limasouza.exemplo'],
  ['Ana Beatriz Ramos', 'anabeatriz@email.exemplo'],
  ['Hotel Rio Branco Express', 'manutencao@hotelrb.exemplo'],
];

// [contratante (índice), categoria, titulo, descricao, dias até o serviço, horário]
const VAGAS = [
  [0, 'eletricista', 'Troca de iluminação da loja', 'Substituir 20 lâmpadas tubulares por LED e revisar duas tomadas do caixa.', 3, '08h às 12h'],
  [1, 'jardinagem', 'Corte de grama das áreas comuns', 'Área de aproximadamente 600 m². Precisa trazer roçadeira.', 2, '07h às 16h'],
  [1, 'pintor', 'Pintura do salão de festas', 'Salão de 80 m², paredes internas. Tinta fornecida pelo condomínio.', 6, '08h às 17h'],
  [2, 'limpeza', 'Diarista para limpeza pesada', 'Limpeza completa da cozinha industrial antes da vistoria.', 1, '14h às 20h'],
  [2, 'ar-condicionado', 'Higienização de 3 splits', 'Três aparelhos de 12.000 BTUs na área de atendimento.', 4, 'Manhã'],
  [3, 'montador', 'Montagem de 6 estações de trabalho', 'Mesas e gaveteiros novos ainda na caixa.', 5, '08h às 18h'],
  [4, 'encanador', 'Vazamento embaixo da pia', 'Vazamento no sifão e no registro da cozinha.', 1, 'A combinar'],
  [5, 'pedreiro', 'Reparo de piso no corredor', 'Trocar cerca de 15 peças de porcelanato soltas.', 7, '08h às 17h'],
  [5, 'eletricista', 'Revisão do quadro do 2º andar', 'Disjuntores desarmando com frequência. Fazer diagnóstico e reparo.', 3, '09h às 15h'],
  [0, 'encanador', 'Instalação de bebedouro', 'Instalar ponto de água para bebedouro no depósito.', 8, 'Tarde'],
];

// Peso de procura por categoria (para a dashboard ter um ranking interessante)
const PESO_PROCURA = {
  eletricista: 10, encanador: 8, limpeza: 9, 'ar-condicionado': 7,
  pintor: 5, montador: 4, pedreiro: 4, jardinagem: 3,
};

async function semear() {
  // Categorias e campos específicos
  const idCategoria = {};
  for (const c of CATEGORIAS) {
    const r = await run('INSERT INTO categorias (slug, nome, descricao, icone) VALUES (?, ?, ?, ?)',
      [c.slug, c.nome, c.descricao, c.icone]);
    idCategoria[c.slug] = r.id;
    for (let i = 0; i < c.campos.length; i++) {
      const [chave, rotulo, tipo, opcoes, obrigatorio] = c.campos[i];
      await run(
        'INSERT INTO campos_categoria (categoria_id, chave, rotulo, tipo, opcoes, obrigatorio, ordem) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [r.id, chave, rotulo, tipo, JSON.stringify(opcoes), obrigatorio, i]
      );
    }
  }

  // Admin (só para a apresentação local)
  await run("INSERT INTO usuarios (nome, email, senha_hash, tipo, criado_em) VALUES (?, ?, ?, 'admin', ?)",
    ['Administrador', 'admin@anticlt.local', gerarHash('admin123'), diasAtras(40)]);

  const senhaPadrao = gerarHash('123456');

  // Contratantes
  const idContratantes = [];
  for (let i = 0; i < CONTRATANTES.length; i++) {
    const [nome, email] = CONTRATANTES[i];
    const r = await run(
      "INSERT INTO usuarios (nome, email, senha_hash, tipo, telefone, criado_em) VALUES (?, ?, ?, 'contratante', ?, ?)",
      [nome, email, senhaPadrao, `6990000${String(100 + i).padStart(4, '0')}`, diasAtras(Math.floor(aleatorio() * 28))]
    );
    idContratantes.push(r.id);
  }

  // Prestadores com perfil e fotos
  const idPrestadores = {};
  const contagemPorCategoria = {};
  for (let i = 0; i < PRESTADORES.length; i++) {
    const [nome, slug, titulo, bio, anos] = PRESTADORES[i];
    const primeiroNome = nome.split(' ')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const sobrenome = nome.split(' ').pop().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const telefone = `6990000${String(i + 1).padStart(4, '0')}`;

    const u = await run(
      "INSERT INTO usuarios (nome, email, senha_hash, tipo, telefone, criado_em) VALUES (?, ?, ?, 'prestador', ?, ?)",
      [nome, `${primeiroNome}.${sobrenome}@email.exemplo`, senhaPadrao, telefone, diasAtras(Math.floor(aleatorio() * 30))]
    );

    // Respostas específicas: pega opções do cadastro da categoria
    const categoria = CATEGORIAS.find((c) => c.slug === slug);
    const especificos = {};
    for (const [chave, , tipo, opcoes] of categoria.campos) {
      especificos[chave] = tipo === 'multipla'
        ? opcoes.filter(() => aleatorio() > 0.4).slice(0, 4).concat(opcoes[0]).filter((v, k, a) => a.indexOf(v) === k)
        : sortear(opcoes);
    }

    const p = await run(
      `INSERT INTO prestadores (usuario_id, categoria_id, titulo, bio, bairro, whatsapp, instagram, anos_experiencia, dados_especificos, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT criado_em FROM usuarios WHERE id = ?))`,
      [u.id, idCategoria[slug], titulo, bio, sortear(BAIRROS), telefone, `${primeiroNome}.${sobrenome}.demo`,
       anos, JSON.stringify(especificos), u.id]
    );
    idPrestadores[i] = p.id;

    // 4 fotos ilustrativas por categoria; cada prestador começa por uma diferente
    const n = (contagemPorCategoria[slug] = (contagemPorCategoria[slug] || 0) + 1);
    const ordem = n % 2 === 1 ? [1, 2, 3, 4] : [3, 4, 1, 2];
    for (let k = 0; k < ordem.length; k++) {
      await run('INSERT INTO fotos (prestador_id, caminho, legenda, ordem) VALUES (?, ?, ?, ?)',
        [p.id, `/img/portfolio/${slug}-${ordem[k]}.svg`, `${titulo} — foto ilustrativa`, k]);
    }
  }

  // Vagas
  const idVagas = [];
  for (const [ci, slug, titulo, descricao, emDias, horario] of VAGAS) {
    const r = await run(
      `INSERT INTO vagas (contratante_id, categoria_id, titulo, descricao, bairro, data_servico, horario, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [idContratantes[ci], idCategoria[slug], titulo, descricao, sortear(BAIRROS), diaFuturo(emDias), horario,
       diasAtras(Math.floor(aleatorio() * 6))]
    );
    idVagas.push({ id: r.id, slug });
  }
  // Uma vaga antiga já encerrada
  await run(
    `INSERT INTO vagas (contratante_id, categoria_id, titulo, descricao, bairro, data_servico, horario, status, criado_em)
     VALUES (?, ?, 'Faxina de fim de ano', 'Serviço concluído.', 'Centro', ?, '08h às 17h', 'encerrada', ?)`,
    [idContratantes[3], idCategoria.limpeza, diaFuturo(-10), diasAtras(15)]
  );

  // Interesses: prestadores da mesma categoria se interessam pelas vagas
  for (const vaga of idVagas) {
    for (let i = 0; i < PRESTADORES.length; i++) {
      if (PRESTADORES[i][1] === vaga.slug && aleatorio() > 0.25) {
        await run('INSERT INTO interesses (vaga_id, prestador_id, mensagem, criado_em) VALUES (?, ?, ?, ?)',
          [vaga.id, idPrestadores[i], 'Tenho disponibilidade nesse dia.', diasAtras(Math.floor(aleatorio() * 3))]);
      }
    }
  }

  // Avaliações: cada prestador recebe de 1 a 5 avaliações de clientes diferentes
  const COMENTARIOS = {
    5: ['Excelente! Pontual e muito caprichoso.', 'Resolveu rápido e deixou tudo limpo.', 'Recomendo, trabalho impecável.', 'Atendimento nota 10.'],
    4: ['Bom serviço, chegou um pouco atrasado.', 'Fez direitinho, preço justo.', 'Gostei, chamaria de novo.'],
    3: ['Serviço ok, mas demorou mais que o combinado.', 'Resolveu, mas faltou capricho no acabamento.'],
  };
  for (let i = 0; i < PRESTADORES.length; i++) {
    const quantos = 1 + Math.floor(aleatorio() * 5);
    const clientes = [...idContratantes].sort(() => aleatorio() - 0.5).slice(0, quantos);
    for (const clienteId of clientes) {
      const nota = aleatorio() < 0.55 ? 5 : aleatorio() < 0.75 ? 4 : 3;
      await run('INSERT INTO avaliacoes (prestador_id, cliente_id, nota, comentario, criado_em) VALUES (?, ?, ?, ?, ?)',
        [idPrestadores[i], clienteId, nota, sortear(COMENTARIOS[nota]), diasAtras(Math.floor(aleatorio() * 25))]);
    }
  }

  // Favoritos do cliente de teste (Mercadinho)
  for (const i of [0, 2, 10]) {
    await run('INSERT INTO favoritos (cliente_id, prestador_id, criado_em) VALUES (?, ?, ?)', [idContratantes[0], idPrestadores[i], diasAtras(3)]);
  }

  // Uma conversa de exemplo entre o Mercadinho (cliente) e o Renato (prestador)
  const conversa = await run('INSERT INTO conversas (cliente_id, prestador_id, criado_em) VALUES (?, ?, ?)',
    [idContratantes[0], idPrestadores[0], diasAtras(1, 9)]);
  const renatoUsuario = await get('SELECT usuario_id FROM prestadores WHERE id = ?', [idPrestadores[0]]);
  const CONVERSA = [
    [idContratantes[0], 'Bom dia, Renato! Vi seu perfil. Você consegue trocar a iluminação da loja essa semana?', 1],
    [renatoUsuario.usuario_id, 'Bom dia! Consigo sim. São quantas lâmpadas, mais ou menos?', 1],
    [idContratantes[0], 'Umas 20 tubulares. Queremos trocar por LED.', 1],
    [renatoUsuario.usuario_id, 'Fechado. Posso passar quinta às 8h para ver o local.', 0],
  ];
  for (let k = 0; k < CONVERSA.length; k++) {
    const [autor, textoMsg, lida] = CONVERSA[k];
    await run('INSERT INTO mensagens (conversa_id, autor_id, texto, lida, criado_em) VALUES (?, ?, ?, ?, ?)',
      [conversa.id, autor, textoMsg, lida, diasAtras(1, 9 + k)]);
  }

  // Todos os usuários de exemplo "aceitaram os termos" no dia do cadastro
  await run("UPDATE usuarios SET aceitou_termos_em = criado_em WHERE tipo <> 'admin'");
  await run("INSERT INTO auditoria (usuario, acao, detalhe, criado_em) VALUES ('Sistema', 'seed', 'Dados de exemplo inseridos', datetime('now', 'localtime'))");

  // Acessos dos últimos 30 dias (buscas, visualizações e contatos)
  const slugs = Object.keys(PESO_PROCURA);
  const pesoTotal = slugs.reduce((s, k) => s + PESO_PROCURA[k], 0);
  await exec('BEGIN');
  for (let dia = 29; dia >= 0; dia--) {
    const quantidade = 6 + Math.floor(aleatorio() * 10) + Math.floor((29 - dia) / 4); // procura crescendo
    for (let q = 0; q < quantidade; q++) {
      let sorteio = aleatorio() * pesoTotal;
      const slug = slugs.find((k) => (sorteio -= PESO_PROCURA[k]) < 0) || slugs[0];
      const tipo = aleatorio() < 0.45 ? 'busca' : aleatorio() < 0.7 ? 'visualizacao' : 'contato';
      const doMesmoServico = PRESTADORES.map((p, i) => (p[1] === slug ? idPrestadores[i] : null)).filter(Boolean);
      const prestador = tipo === 'busca' ? null : sortear(doMesmoServico);
      await run('INSERT INTO acessos (categoria_id, prestador_id, tipo, criado_em) VALUES (?, ?, ?, ?)',
        [idCategoria[slug], prestador, tipo, diasAtras(dia)]);
    }
  }
  await exec('COMMIT');
}

// Execução direta pelo terminal
if (require.main === module) {
  (async () => {
    if (process.argv.includes('--reset')) {
      await exec(`
        PRAGMA foreign_keys = OFF;
        DROP TABLE IF EXISTS auditoria; DROP TABLE IF EXISTS mensagens; DROP TABLE IF EXISTS conversas;
        DROP TABLE IF EXISTS favoritos; DROP TABLE IF EXISTS avaliacoes;
        DROP TABLE IF EXISTS acessos; DROP TABLE IF EXISTS interesses; DROP TABLE IF EXISTS vagas;
        DROP TABLE IF EXISTS fotos; DROP TABLE IF EXISTS prestadores; DROP TABLE IF EXISTS campos_categoria;
        DROP TABLE IF EXISTS categorias; DROP TABLE IF EXISTS sessoes; DROP TABLE IF EXISTS usuarios;
        PRAGMA foreign_keys = ON;`);
      console.log('Tabelas apagadas.');
    }
    await iniciarBanco();
    const { total } = await get('SELECT COUNT(*) AS total FROM categorias');
    if (total > 0) {
      console.log('O banco já tem dados. Use "npm run reset" para recomeçar do zero.');
    } else {
      await semear();
      console.log('Dados de exemplo inseridos.');
    }
    await fechar();
  })().catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { semear };
