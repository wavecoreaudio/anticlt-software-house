# ANTI CLT Web System

Portal de diárias e serviços técnicos (eletricista, encanador, pintor, diarista e outros), feito para a matéria de **Software House** — Engenharia da Computação.

- **Front-end:** HTML5, CSS3 e JavaScript puro (sem framework)
- **Back-end:** Node.js + Express (API REST)
- **Banco de dados:** SQLite3 local (arquivo `data/anticlt.db`)
- **Testes:** `node:test` (24 testes automatizados da API)
- Sem domínio nem serviço externo: tudo roda no computador.

> Todos os dados de exemplo (nomes, telefones, empresas e imagens) são **fictícios**.

---

## Como rodar

Pré-requisito: [Node.js](https://nodejs.org) 18 ou mais novo (22.5+ para gerar o diagrama do banco).

```bash
cd anti-clt-faculdade
npm install        # instala express e sqlite3
npm start          # sobe o servidor
```

Abra **http://localhost:3001**.

> A porta padrão é 3001 para não conflitar com outros projetos na 3000. Para usar outra: `set PORT=3002 && npm start` (cmd) ou `$env:PORT=3002; npm start` (PowerShell).

Na primeira vez o banco é criado e preenchido sozinho com dados de exemplo. Bancos de versões anteriores são atualizados automaticamente (migração), sem perder dados.

| Comando          | O que faz                                              |
|------------------|--------------------------------------------------------|
| `npm start`      | Sobe o servidor na porta 3001                          |
| `npm test`       | Roda os testes automatizados (usa um banco temporário) |
| `npm run seed`   | Insere os dados de exemplo (se o banco estiver vazio)  |
| `npm run reset`  | Apaga tudo e recria os dados de exemplo                |

### Contas de teste

| Tipo         | Onde entra                    | E-mail                          | Senha     |
|--------------|-------------------------------|---------------------------------|-----------|
| Cliente      | `/login`, aba "Sou cliente"   | contato@mercadinho.exemplo      | 123456    |
| Prestador    | `/login`, aba "Sou prestador" | renato.siqueira@email.exemplo   | 123456    |
| Admin        | `/admin`                      | admin@anticlt.local             | admin123  |

Cada área só aceita o seu tipo de conta. A página `/admin` não aparece no menu (há um link discreto no rodapé). **Troque a senha do admin** (Dashboard → Conta) antes de compartilhar o site por um link público.

---

## Funcionalidades

**Área aberta**
- Landing page (quem somos, público-alvo, vantagens), Como funciona, Termos e privacidade.
- Portfólio com abas por categoria, busca, filtro por bairro, ordenação (recentes, mais bem avaliados, mais experientes, nome) e paginação no banco ("carregar mais").
- Fotos em carrossel estilo Instagram; perfil em modal com respostas específicas da categoria, avaliações e contato (chat, WhatsApp, Instagram).
- Vagas de diária com filtro por categoria.

**Cliente** (no banco: `contratante`)
- Publica, edita, encerra e exclui vagas; vê os interessados.
- Avalia prestadores (1 a 5 estrelas + comentário), salva favoritos, conversa pelo chat.

**Prestador**
- Cadastro que muda conforme a categoria (ex.: eletricista informa NR-10).
- Edita perfil, envia fotos, demonstra interesse em vagas, conversa com clientes, vê as avaliações recebidas.

**Administração** (`/admin` → `/dashboard`)
- Indicadores, inscrições por dia, serviços mais procurados, prestadores mais vistos e mais bem avaliados.
- CRUD de usuários (ativar, desativar, excluir) e de categorias.
- Exportação em CSV (inscrições, procura, vagas) que abre no Excel.
- Auditoria: registro de logins, cadastros, vagas e ações do admin.

**Qualidade e segurança**
- Senhas com `scrypt` + salt; sessões que expiram em 7 dias; troca de senha derruba as outras sessões.
- 5 logins errados seguidos bloqueiam aquele e-mail por 15 minutos.
- Consultas SQL sempre com parâmetros (`?`); o front escapa todo texto antes de exibir (contra XSS).
- LGPD: aceite dos termos no cadastro (com data), "Baixar meus dados" e "Excluir minha conta" no painel.
- Testes automatizados da API e documentação em `/docs`.

---

## Páginas

| Página | Endereço | Acesso |
|---|---|---|
| Início | `/` | aberto |
| Como funciona | `/como-funciona` | aberto |
| Portfólio | `/portfolio` | aberto |
| Vagas | `/vagas` | aberto (interesse exige login de prestador) |
| Termos e privacidade | `/privacidade` | aberto |
| Documentação da API + diagrama do banco | `/docs` | aberto |
| Login de cliente e de prestador | `/login` | aberto |
| Cadastro | `/cadastro` | aberto |
| Painel do cliente / prestador | `/painel` | logado |
| Login da administração | `/admin` | aberto (só contas admin entram) |
| Dashboard | `/dashboard` | admin |

---

## Estrutura de pastas

```
anti-clt-faculdade/
├── package.json
├── server/
│   ├── server.js          # inicia banco + servidor
│   ├── app.js             # monta o Express (usado também pelos testes)
│   ├── db.js              # conexão SQLite3, funções run/get/all e migrações
│   ├── schema.sql         # criação das tabelas
│   ├── seed.js            # dados de exemplo
│   ├── auth.js            # hash de senha, sessões, limite de tentativas
│   ├── auditoria.js       # registro de ações
│   ├── docs.js            # documentação das rotas (alimenta /docs)
│   └── rotas/
│       ├── auth.js        # cadastro, login por área, logout
│       ├── categorias.js  # CRUD de categorias + campos específicos
│       ├── prestadores.js # portfólio paginado, perfil, fotos, avaliações
│       ├── vagas.js       # CRUD de vagas + interesse
│       ├── social.js      # favoritos e chat
│       ├── dashboard.js   # métricas, usuários, CSV, auditoria, conta/LGPD
│       └── util.js
├── public/                # front-end (uma página HTML por tela, um JS por página)
├── tests/api.test.js      # testes automatizados
├── docs/modelo-er.svg     # diagrama do banco
├── scripts/
│   ├── gerar-imagens.js   # imagens ilustrativas do portfólio
│   └── gerar-diagrama.js  # diagrama do banco a partir do schema.sql
└── data/anticlt.db        # criado ao rodar (fica fora do Git)
```

---

## Banco de dados

14 tabelas. Diagrama completo em `docs/modelo-er.svg` (e na página `/docs`).

| Tabela | Para quê |
|---|---|
| `usuarios` | todas as contas (prestador, cliente/contratante, admin) + data do aceite dos termos |
| `sessoes` | tokens de login (valem 7 dias) |
| `categorias` | áreas de serviço (abas do portfólio) |
| `campos_categoria` | perguntas específicas do cadastro de cada área |
| `prestadores` | perfil público; respostas específicas em `dados_especificos` (JSON) |
| `fotos` | fotos do carrossel de cada prestador |
| `vagas` | diárias publicadas por clientes |
| `interesses` | prestador interessado numa vaga |
| `avaliacoes` | nota de 1 a 5 + comentário (uma por cliente/prestador) |
| `favoritos` | prestadores salvos pelo cliente |
| `conversas` / `mensagens` | chat entre cliente e prestador |
| `acessos` | buscas, visualizações e contatos (alimenta "serviços mais procurados") |
| `auditoria` | registro de ações importantes |

Para olhar o banco: [DB Browser for SQLite](https://sqlitebrowser.org) abrindo `data/anticlt.db`.

---

## API

A lista completa, com exemplos de entrada e saída, está em **http://localhost:3001/docs** (fonte: `server/docs.js`). São 47 rotas em 9 grupos: autenticação, categorias, prestadores, avaliações, favoritos, chat, vagas, conta (LGPD) e administração.

Rotas protegidas recebem o cabeçalho `Authorization: Bearer <token>`.

---

## Testes

```bash
npm test
```

Os testes sobem o app numa porta livre com um banco temporário e cobrem: login por área, bloqueio por tentativas, aceite dos termos, validação do cadastro por categoria, paginação e filtros do portfólio, permissões nas vagas, avaliações, favoritos, chat, dashboard, CSV, auditoria e regras de exclusão.
