/* As rotas REST (rota de chat e as rotas para obter e atualizar tarefas) foram usadas para operações diretas da interface.

As operações semânticas, como apagar tarefas através de linguagem natural e contexto conversacional, foram centralizadas no fluxo de IA usando function calling.
*/

import express from 'express';
import { deleteTaskById, getTaskBotSession, getTasks, taskBotChat, taskBotChatStream, updateTaskStatus } from '../controllers/taskBotController.js';
import { validateChatMessage } from '../middlewares/validateChatRequests.js';

const router = express.Router();

router.get('/session', getTaskBotSession);

// Rota para obter a lista de tarefas
router.get('/tasks', getTasks);

// Rota para atualizar o status de uma tarefa através do checkbox/toggle
router.patch('/tasks/:id/status', updateTaskStatus);

// Rota para eliminar uma tarefa de forma determinística pelo id
router.delete('/tasks/:id', deleteTaskById);

// Rota para lidar com mensagens do chat do TaskBot
router.post('/chat', validateChatMessage, taskBotChat);
router.post('/chat/stream', validateChatMessage, taskBotChatStream);

export default router;