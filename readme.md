# Projeto realizado por

Leonor Pereira

## Repositório

https://github.com/upskill228/smartTaskBot.git

## Descrição

O SmartTaskBot é uma aplicação de gestão de tarefas com interface conversacional.
Permite criar, editar, listar, concluir e apagar tarefas através de linguagem natural, com frontend em React e backend em Express integrado com Gemini.

## Tecnologias

### Backend

- Node.js
- Express
- MySQL
- Gemini API com `@google/genai`
- Zod
- Dotenv

### Frontend

- React
- Vite
- React Router
- TanStack React Query
- Chart.js

## Estrutura do projeto

- `backend/`: API, lógica conversacional, validação e acesso à base de dados
- `frontend/`: interface web da aplicação

## Pré-requisitos

Antes de executar o projeto, é necessário ter instalado:

- Node.js
- npm
- MySQL
- uma chave válida da Gemini API

## Variáveis de ambiente

Na pasta `backend/`, cria um ficheiro `.env` com os valores necessários:

```env
GEMINI_API_KEY=coloca_aqui_a_tua_chave
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=palavra_passe
DB_NAME=smarttaskbot
PORT=3000
```

Variáveis opcionais:

```env
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_FALLBACK_MODELS=gemini-3.1-flash-lite,gemini-3-flash,gemini-2.5-flash,
GEMINI_DEBUG_LOGS=true
GEMINI_DEBUG_JSON=false
```

No frontend, `VITE_API_URL` é opcional. Se não for definida, a aplicação usa por defeito `http://localhost:3000`.

## Passos para executar o projeto

### 1. Clonar o repositório

```bash
git clone https://github.com/upskill228/smartTaskBot.git
```

### 2. Entrar na pasta do projeto

```bash
cd smartTaskBot
```

### 3. Instalar dependências do backend

```bash
cd backend
npm install
```

### 4. Configurar o ficheiro `.env`

Criar o ficheiro `.env` na pasta `backend/` com as variáveis indicadas acima.

### 5. Iniciar o backend

```bash
npm start
```

O backend ficará disponível em:

```text
http://localhost:3000
```

### 6. Iniciar o frontend

Num novo terminal:

```bash
cd frontend
npm install
npm run dev
```

O frontend ficará disponível no endereço mostrado pelo Vite no terminal, normalmente:

```text
http://localhost:5173
```

## Scripts úteis

### Backend

```bash
npm start
npm test
```

### Frontend

```bash
npm run dev
npm run build
npm run lint
```

## Notas

- O backend prepara o schema necessário da base de dados no arranque.
- O endpoint principal do chat é `POST /api/taskbot/chat`.
- A aplicação também suporta `POST /api/taskbot/chat/stream` para respostas incrementais no chat.

