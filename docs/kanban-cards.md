# ANTI CLT Web System — cards do Kanban

Todos os cards abaixo estão **concluídos** (coluna "Concluído").
O campo **Responsável** fica em branco para cada integrante preencher com o que fez de verdade.
Copie o título para o nome do card e o restante para a descrição. Os itens de checklist podem virar o checklist do card.

Etiquetas usadas: `Documentação` · `Design` · `Front-end` · `Back-end` · `Banco de dados` · `Qualidade` · `Segurança`

---

## 1. Documentação e fundamentos do projeto
**Etiqueta:** Documentação · **Status:** Concluído · **Responsável:** ______

**Descrição:** Definição do ANTI CLT Web System, um portal que aproxima clientes (pessoas, comércios, condomínios) de prestadores de serviços técnicos e de diária em Porto Velho, com contato direto e sem taxa.

**Checklist**
- [x] Problema: quem precisa de um serviço rápido não sabe em quem confiar, e o autônomo não tem vitrine
- [x] Público-alvo: prestadores autônomos, pequenas empresas e comércios, famílias e condomínios
- [x] Escopo: portfólio aberto, vagas de diária, cadastro por categoria, chat, avaliações e dashboard
- [x] Tecnologias: HTML5, CSS3, JavaScript, Node.js, Express, SQLite3
- [x] Etapas: referências → identidade visual → banco → API → telas → testes → documentação

**Como verificar:** `README.md` na raiz do projeto.

---

## 2. Identidade visual: logo
**Etiqueta:** Design · **Status:** Concluído · **Responsável:** ______

**Descrição:** Criação do logo (símbolo da carteira de trabalho partida + logotipo ANTI**CLT**) e aplicação no site.

**Checklist**
- [x] Conceito: a carteira partida na diagonal, com a parte de cima subindo (romper o molde e crescer)
- [x] Versões: fundo escuro, fundo claro, símbolo sozinho e ícone de aplicativo
- [x] Arquivos em SVG e PNG
- [x] Aplicado no cabeçalho, rodapé, login da administração e favicon
- [x] Documento explicando o porquê do logo

**Como verificar:** `docs/ANTI-CLT-01-Logo.pdf` e `docs/logo/`.

---

## 3. Identidade visual: paleta de cores e tipografia
**Etiqueta:** Design · **Status:** Concluído · **Responsável:** ______

**Descrição:** Paleta escura em preto, branco e cinzas, com o branco como única cor de ação, e fonte Inter.

**Checklist**
- [x] 10 cores definidas como variáveis CSS (`public/css/estilo.css`)
- [x] Cores de estado (sucesso, erro, aviso) reservadas e sempre acompanhadas de texto
- [x] Contraste conferido pela fórmula WCAG 2.1 (texto principal 18:1)
- [x] Cinza de apoio ajustado de #7C7C85 para #85858E para passar no nível AA
- [x] Documento explicando o porquê da paleta

**Como verificar:** `docs/ANTI-CLT-02-Paleta-de-cores.pdf`.

---

## 4. Referências e definição do layout
**Etiqueta:** Design · **Status:** Concluído · **Responsável:** ______

**Descrição:** Levantamento de referências visuais e definição da estrutura das telas.

**Checklist**
- [x] Referência 1: site antigo do ANTI CLT (cards com foto, login e cadastro em tela dividida)
- [x] Referência 2: site de arquitetura (hero escuro com foto, título grande e fino, menu em pílula)
- [x] Mapa de páginas: início, como funciona, portfólio, vagas, login, cadastro, painel, admin, dashboard
- [x] Layout responsivo (computador, tablet e celular)

---

## 5. Front-end: páginas públicas
**Etiqueta:** Front-end · **Status:** Concluído · **Responsável:** ______

**Descrição:** Landing page e páginas institucionais.

**Checklist**
- [x] Início: hero com mosaico de fotos, números vindos do banco, quem somos, público-alvo, vantagens, categorias
- [x] Como funciona: passo a passo para clientes e para prestadores + perguntas frequentes
- [x] Termos de uso e privacidade (`/privacidade`)
- [x] Cabeçalho e rodapé montados por JavaScript (um código só para todas as páginas)

**Como verificar:** `public/index.html`, `public/como-funciona.html`, `public/privacidade.html`.

---

## 6. Front-end: portfólio de prestadores
**Etiqueta:** Front-end · **Status:** Concluído · **Responsável:** ______

**Descrição:** Área aberta com os prestadores separados por categoria, fotos em carrossel e contato.

**Checklist**
- [x] Abas por categoria (com contagem)
- [x] Busca por nome, bairro ou serviço; filtro por bairro; ordenação
- [x] "Carregar mais" (paginação feita no banco)
- [x] Carrossel de fotos estilo Instagram (arrastar, setas, bolinhas, contador)
- [x] Perfil em modal com respostas específicas da categoria
- [x] Botões de WhatsApp, Instagram e "Enviar mensagem"
- [x] Favoritar (coração) e avaliações com estrelas no perfil

**Como verificar:** `/portfolio` — arquivos `public/portfolio.html`, `public/js/portfolio.js`, `public/js/carrossel.js`.

---

## 7. Front-end: cadastro por categoria e logins
**Etiqueta:** Front-end · **Status:** Concluído · **Responsável:** ______

**Descrição:** Cadastro em etapas cujo formulário muda conforme a área escolhida, e telas de login separadas.

**Checklist**
- [x] Etapa 1: escolher entre cliente e prestador
- [x] Etapa 2: prestador escolhe a categoria
- [x] Etapa 3: formulário com as perguntas da categoria, vindas do banco (ex.: eletricista informa NR-10)
- [x] Envio de fotos já no cadastro (reduzidas no navegador antes de enviar)
- [x] Aceite obrigatório dos termos
- [x] Login com abas "Sou cliente" e "Sou prestador"; login da administração separado em `/admin`

**Como verificar:** `/cadastro`, `/login`, `/admin`.

---

## 8. Front-end: painel do cliente e do prestador
**Etiqueta:** Front-end · **Status:** Concluído · **Responsável:** ______

**Descrição:** Área logada de cada tipo de usuário.

**Checklist**
- [x] Prestador: editar perfil, gerenciar fotos, vagas de interesse, avaliações recebidas
- [x] Cliente: publicar, editar, encerrar e excluir vagas; ver interessados; favoritos
- [x] Chat entre cliente e prestador (atualiza a cada 4 s, contador de não lidas no cabeçalho)
- [x] Conta: editar dados, trocar senha, baixar meus dados, excluir conta

**Como verificar:** `/painel` — `public/js/painel.js`.

---

## 9. Front-end: dashboard administrativa
**Etiqueta:** Front-end · **Status:** Concluído · **Responsável:** ______

**Descrição:** Painel do administrador com resumos das inscrições e dos serviços mais procurados.

**Checklist**
- [x] 5 indicadores: inscritos, prestadores, vagas abertas, contatos, avaliações
- [x] Gráfico de inscrições por dia e gráfico de serviços mais procurados (SVG feito à mão, sem biblioteca)
- [x] Alternar gráfico ↔ tabela (acessibilidade)
- [x] Filtro de período (7, 30 e 90 dias)
- [x] Tabelas: últimas inscrições, por categoria, mais vistos, mais bem avaliados
- [x] Gestão de usuários e categorias, auditoria, exportar CSV

**Como verificar:** `/admin` → `/dashboard`.

---

## 10. Back-end: servidor e API REST
**Etiqueta:** Back-end · **Status:** Concluído · **Responsável:** ______

**Descrição:** Servidor Node.js com Express servindo a API e os arquivos do front.

**Checklist**
- [x] 47 rotas em 9 grupos (auth, categorias, prestadores, avaliações, favoritos, chat, vagas, conta, administração)
- [x] CRUD completo de vagas, categorias, usuários, fotos, avaliações e favoritos
- [x] Tratamento de erros sem expor detalhes internos
- [x] Exportação de relatórios em CSV (abre no Excel)
- [x] App separado do servidor (`app.js` × `server.js`) para permitir testes

**Como verificar:** pasta `server/` e página `/docs`.

---

## 11. Back-end: autenticação e segurança
**Etiqueta:** Back-end · Segurança · **Status:** Concluído · **Responsável:** ______

**Checklist**
- [x] Senhas com hash scrypt + salt (módulo nativo `crypto`)
- [x] Sessões por token, válidas por 7 dias
- [x] Cada área de login aceita só o seu tipo de conta
- [x] 5 logins errados bloqueiam por 15 minutos
- [x] Consultas SQL sempre com parâmetros (contra SQL injection)
- [x] Texto escapado no front antes de exibir (contra XSS)
- [x] Auditoria de ações (logins, cadastros, vagas, ações do admin)
- [x] LGPD: aceite com data, baixar meus dados, excluir conta

**Como verificar:** `server/auth.js`, `server/auditoria.js`, seção Auditoria da dashboard.

---

## 12. Banco de dados: modelagem SQLite3
**Etiqueta:** Banco de dados · **Status:** Concluído · **Responsável:** ______

**Descrição:** Banco local em SQLite3 com 14 tabelas e chaves estrangeiras.

**Checklist**
- [x] Tabelas: usuarios, sessoes, categorias, campos_categoria, prestadores, fotos, vagas, interesses, avaliacoes, favoritos, conversas, mensagens, acessos, auditoria
- [x] Chaves estrangeiras com `ON DELETE CASCADE` (excluir conta apaga tudo ligado a ela)
- [x] Restrições `UNIQUE` e `CHECK` (ex.: nota de 1 a 5; uma avaliação por cliente e prestador)
- [x] Índices nas colunas mais consultadas
- [x] Migração automática para bancos de versões anteriores
- [x] Diagrama entidade-relacionamento gerado a partir do `schema.sql`

**Como verificar:** `server/schema.sql`, `docs/modelo-er.svg`; abrir `data/anticlt.db` no DB Browser for SQLite.

---

## 13. Banco de dados: dados de exemplo
**Etiqueta:** Banco de dados · **Status:** Concluído · **Responsável:** ______

**Checklist**
- [x] 8 categorias com perguntas específicas de cadastro
- [x] 16 prestadores, 6 clientes e 1 admin (todos fictícios)
- [x] Vagas, interesses, avaliações, favoritos, uma conversa e 30 dias de acessos
- [x] Comandos `npm run seed` e `npm run reset`

**Como verificar:** `server/seed.js`.

---

## 14. Qualidade: testes automatizados
**Etiqueta:** Qualidade · **Status:** Concluído · **Responsável:** ______

**Descrição:** 24 testes da API com `node:test`, usando um banco temporário.

**Checklist**
- [x] Autenticação: login por área, bloqueio por tentativas, termos, cadastro por categoria, e-mail repetido
- [x] Portfólio: paginação, filtro, ordenação
- [x] Vagas: CRUD e permissões
- [x] Avaliações, favoritos e chat
- [x] Administração: dashboard, CSV, auditoria, regras de exclusão
- [x] Todos passando (`npm test`)

**Como verificar:** `tests/api.test.js`.

---

## 15. Documentação técnica
**Etiqueta:** Documentação · **Status:** Concluído · **Responsável:** ______

**Checklist**
- [x] README com instalação, contas de teste, páginas, estrutura de pastas e banco
- [x] Página `/docs` com as 47 rotas da API, exemplos de entrada e saída, e o diagrama do banco
- [x] Comentários no código explicando cada parte

---

### Sugestão para o Backlog (ainda não feito)
- Protótipo estilo Figma com as telas e as referências
- Documento final do projeto (texto/PDF) com tudo o que foi feito no front, back, Node.js e SQLite3
