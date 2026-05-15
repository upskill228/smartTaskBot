/* Este ficheiro é o ponto de entrada da aplicação, onde o servidor Express é configurado e iniciado. Ele define as rotas principais, middleware de validação e tratamento de erros, e garante que a aplicação esteja pronta para receber requisições.
*/

import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import taskBotRoutes from './routes/taskBotRoutes.js';
import { ensureTaskSchema } from './infra/db/db.js';

if (!process.env.GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY is not set in environment variables');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'TaskBot API',
    endpoints: [
      'GET /health',
      'GET /api/taskbot/tasks',
      'PATCH /api/taskbot/tasks/:id/status',
      'POST /api/taskbot/chat',
      'POST /api/taskbot/chat/stream'
    ],
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/taskbot', taskBotRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  await ensureTaskSchema(); // A aplicação só inicia o servidor depois de garantir que o schema da base de dados existe, reduzindo erros de runtime em produção.

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});