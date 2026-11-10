// Documentação da API (fonte única).
// A página /docs mostra esta lista; o README tem um resumo.
// acesso: publico | logado | cliente | prestador | admin

const ROTAS_DOCUMENTADAS = [
  {
    grupo: 'Autenticação',
    rotas: [
      { metodo: 'POST', caminho: '/api/auth/cadastro', acesso: 'publico', descricao: 'Cria conta de cliente ou de prestador. O prestador envia também o perfil e as respostas específicas da categoria.',
        corpo: { nome: 'Roberto da Silva', email: 'roberto@exemplo.com', senha: '123456', tipo: 'prestador', telefone: '69999990000', aceitou_termos: true,
          prestador: { categoria_id: 1, titulo: 'Eletricista residencial', bairro: 'Centro', anos_experiencia: 5, dados_especificos: { area_atuacao: 'Residencial', nr10: 'Sim', servicos: ['Iluminação'] } } },
        resposta: { token: '…', usuario: { id: 30, nome: 'Roberto da Silva', tipo: 'prestador' } } },
      { metodo: 'POST', caminho: '/api/auth/login', acesso: 'publico', descricao: 'Entra numa área (cliente, prestador ou admin). Cada área só aceita o seu tipo de conta. 5 erros seguidos bloqueiam por 15 minutos.',
        corpo: { email: 'contato@mercadinho.exemplo', senha: '123456', area: 'cliente' }, resposta: { token: '…', usuario: { id: 2, tipo: 'contratante' } } },
      { metodo: 'POST', caminho: '/api/auth/logout', acesso: 'logado', descricao: 'Encerra a sessão atual.' },
      { metodo: 'GET', caminho: '/api/auth/eu', acesso: 'logado', descricao: 'Dados do usuário logado. A sessão vale 7 dias.' },
    ],
  },
  {
    grupo: 'Categorias',
    rotas: [
      { metodo: 'GET', caminho: '/api/categorias', acesso: 'publico', descricao: 'Lista as categorias com número de prestadores e de vagas abertas.' },
      { metodo: 'GET', caminho: '/api/categorias/:id/campos', acesso: 'publico', descricao: 'Perguntas específicas do cadastro daquela categoria.' },
      { metodo: 'POST', caminho: '/api/categorias', acesso: 'admin', descricao: 'Cria categoria.', corpo: { nome: 'Serralheiro', descricao: 'Portões e grades' } },
      { metodo: 'PUT', caminho: '/api/categorias/:id', acesso: 'admin', descricao: 'Edita nome e descrição.' },
      { metodo: 'DELETE', caminho: '/api/categorias/:id', acesso: 'admin', descricao: 'Exclui, desde que não tenha prestadores nem vagas.' },
    ],
  },
  {
    grupo: 'Prestadores e portfólio',
    rotas: [
      { metodo: 'GET', caminho: '/api/prestadores?categoria=&busca=&bairro=&ordem=&pagina=1&limite=9', acesso: 'publico',
        descricao: 'Portfólio paginado no banco (LIMIT/OFFSET). ordem: recentes, avaliacao, experiencia, nome. Para cliente logado, cada item traz "favorito".',
        resposta: { itens: ['…'], total: 16, pagina: 1, limite: 9, paginas: 2 } },
      { metodo: 'GET', caminho: '/api/prestadores/bairros', acesso: 'publico', descricao: 'Bairros que têm prestador (usado no filtro).' },
      { metodo: 'GET', caminho: '/api/prestadores/:id', acesso: 'publico', descricao: 'Perfil público com fotos, campos específicos e média das avaliações.' },
      { metodo: 'GET', caminho: '/api/prestadores/eu/perfil', acesso: 'prestador', descricao: 'Perfil do prestador logado.' },
      { metodo: 'PUT', caminho: '/api/prestadores/eu/perfil', acesso: 'prestador', descricao: 'Atualiza o perfil (inclusive a categoria e as respostas específicas).' },
      { metodo: 'POST', caminho: '/api/prestadores/eu/fotos', acesso: 'prestador', descricao: 'Envia foto em base64 (PNG, JPG ou WEBP, até 4 MB, máximo 8).', corpo: { imagem: 'data:image/jpeg;base64,…' } },
      { metodo: 'DELETE', caminho: '/api/prestadores/eu/fotos/:fotoId', acesso: 'prestador', descricao: 'Apaga uma foto.' },
      { metodo: 'GET', caminho: '/api/prestadores/eu/interesses', acesso: 'prestador', descricao: 'Vagas em que o prestador demonstrou interesse.' },
      { metodo: 'GET', caminho: '/api/prestadores/eu/avaliacoes', acesso: 'prestador', descricao: 'Avaliações recebidas.' },
    ],
  },
  {
    grupo: 'Avaliações',
    rotas: [
      { metodo: 'GET', caminho: '/api/prestadores/:id/avaliacoes', acesso: 'publico', descricao: 'Lista, média e distribuição por estrelas. Para cliente logado, traz "minha".',
        resposta: { media: 4.7, total: 6, distribuicao: [{ nota: 5, total: 4 }], minha: null, itens: ['…'] } },
      { metodo: 'POST', caminho: '/api/prestadores/:id/avaliacoes', acesso: 'cliente', descricao: 'Cria ou atualiza a avaliação do cliente (uma por prestador).', corpo: { nota: 5, comentario: 'Pontual e caprichoso.' } },
      { metodo: 'DELETE', caminho: '/api/prestadores/:id/avaliacoes', acesso: 'cliente', descricao: 'Apaga a própria avaliação.' },
    ],
  },
  {
    grupo: 'Favoritos',
    rotas: [
      { metodo: 'GET', caminho: '/api/favoritos', acesso: 'cliente', descricao: 'Prestadores salvos.' },
      { metodo: 'POST', caminho: '/api/favoritos/:prestadorId', acesso: 'cliente', descricao: 'Salva um prestador.' },
      { metodo: 'DELETE', caminho: '/api/favoritos/:prestadorId', acesso: 'cliente', descricao: 'Remove dos salvos.' },
    ],
  },
  {
    grupo: 'Chat',
    rotas: [
      { metodo: 'POST', caminho: '/api/conversas', acesso: 'logado', descricao: 'Abre (ou reaproveita) uma conversa. Cliente envia prestador_id; prestador envia vaga_id para falar com o cliente da vaga.',
        corpo: { prestador_id: 3 }, resposta: { id: 7 } },
      { metodo: 'GET', caminho: '/api/conversas', acesso: 'logado', descricao: 'Minhas conversas com a última mensagem e o número de não lidas.' },
      { metodo: 'GET', caminho: '/api/conversas/nao-lidas', acesso: 'logado', descricao: 'Total de mensagens não lidas (contador do cabeçalho).' },
      { metodo: 'GET', caminho: '/api/conversas/:id/mensagens?depois=0', acesso: 'logado', descricao: 'Mensagens com id maior que "depois" (o front consulta a cada 4 s). Marca como lidas.' },
      { metodo: 'POST', caminho: '/api/conversas/:id/mensagens', acesso: 'logado', descricao: 'Envia mensagem (até 1000 caracteres).', corpo: { texto: 'Olá! Pode amanhã às 8h?' } },
    ],
  },
  {
    grupo: 'Vagas de diária',
    rotas: [
      { metodo: 'GET', caminho: '/api/vagas?categoria=&status=aberta', acesso: 'publico', descricao: 'Vagas abertas (ou encerradas).' },
      { metodo: 'GET', caminho: '/api/vagas/minhas', acesso: 'cliente', descricao: 'Vagas publicadas pelo cliente logado.' },
      { metodo: 'POST', caminho: '/api/vagas', acesso: 'cliente', descricao: 'Publica vaga.', corpo: { titulo: 'Trocar tomadas', categoria_id: 1, data_servico: '2026-12-01', horario: '8h às 12h', bairro: 'Centro', descricao: '…' } },
      { metodo: 'PUT', caminho: '/api/vagas/:id', acesso: 'cliente', descricao: 'Edita, encerra ou reabre (status: aberta | encerrada).' },
      { metodo: 'DELETE', caminho: '/api/vagas/:id', acesso: 'cliente', descricao: 'Exclui a vaga.' },
      { metodo: 'GET', caminho: '/api/vagas/:id/interessados', acesso: 'cliente', descricao: 'Prestadores interessados (só o dono da vaga).' },
      { metodo: 'POST', caminho: '/api/vagas/:id/interesse', acesso: 'prestador', descricao: 'Demonstra interesse.' },
      { metodo: 'DELETE', caminho: '/api/vagas/:id/interesse', acesso: 'prestador', descricao: 'Retira o interesse.' },
    ],
  },
  {
    grupo: 'Minha conta (LGPD)',
    rotas: [
      { metodo: 'PUT', caminho: '/api/conta', acesso: 'logado', descricao: 'Edita nome e telefone; troca a senha (derruba as outras sessões).', corpo: { nome: '…', senha_atual: '…', nova_senha: '…' } },
      { metodo: 'GET', caminho: '/api/conta/dados', acesso: 'logado', descricao: 'Baixa uma cópia de todos os dados da conta em JSON (direito de acesso da LGPD).' },
      { metodo: 'DELETE', caminho: '/api/conta', acesso: 'logado', descricao: 'Exclui a conta e tudo ligado a ela (direito de eliminação da LGPD).' },
    ],
  },
  {
    grupo: 'Dashboard e administração',
    rotas: [
      { metodo: 'POST', caminho: '/api/acessos', acesso: 'publico', descricao: 'Registra busca, visualização ou contato (alimenta "serviços mais procurados").', corpo: { tipo: 'busca', categoria: 'eletricista' } },
      { metodo: 'GET', caminho: '/api/dashboard?dias=30', acesso: 'admin', descricao: 'Totais, inscrições por dia, procura por categoria, melhores avaliados, últimas inscrições.' },
      { metodo: 'GET', caminho: '/api/dashboard/usuarios?tipo=&busca=', acesso: 'admin', descricao: 'Lista de contas.' },
      { metodo: 'PATCH', caminho: '/api/dashboard/usuarios/:id', acesso: 'admin', descricao: 'Ativa ou desativa uma conta.', corpo: { ativo: false } },
      { metodo: 'DELETE', caminho: '/api/dashboard/usuarios/:id', acesso: 'admin', descricao: 'Exclui uma conta.' },
      { metodo: 'GET', caminho: '/api/dashboard/exportar/:tipo', acesso: 'admin', descricao: 'Baixa CSV (abre no Excel). tipo: usuarios, procura ou vagas.' },
      { metodo: 'GET', caminho: '/api/dashboard/auditoria?acao=&pagina=1', acesso: 'admin', descricao: 'Registro de ações: logins, cadastros, vagas, ações do admin.' },
    ],
  },
];

module.exports = { ROTAS_DOCUMENTADAS };
