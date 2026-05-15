/* O controller recebe pedidos HTTP, extrai os dados necessários da request, chama os services apropriados e devolve respostas JSON padronizadas.

O controller ** NÂO ** deve:
- conter lógica de negócio,
- conhecer SQL
- falar diretamente com a BD
- falar directamente com Gemini ou outra API externa
(tudo isso é com os services)

O controller é também responsável por lidar com erros de forma consistente, usando o middleware de tratamento de erros para garantir que as respostas de erro sejam padronizadas e informativas.
*/

import { handleTaskBotMessage } from '../services/taskBotService.js';
import { deleteTask, listTasks, updateTaskCompletion } from '../services/taskService.js';

const DEMO_USER_ID = 'Pessoa Fictícia'; // Simula um utilizador único para a demo, já que não há autenticação real implementada.

export function getTaskBotSession(req, res) {
    return res.status(200).json({
        success: true,
        data: {
            userId: DEMO_USER_ID,
        },
    });
}

// Chama listTasks() do service para obter a lista de tarefas e devolve como resposta JSON
export async function getTasks(req, res, next) {
    try {
        const tasks = await listTasks();

        return res.status(200).json({
            success: true,
            data: tasks,
        });
    } catch (error) {
        error.code = error.code || 'TASKS_LIST_ERROR';
        next(error); // Passa o erro para o middleware global de tratamento de erros
    }
}

// Recebe mensagens do chat, chama handleTaskBotMessage() do service para processar a mensagem e devolve a resposta da IA como JSON
export async function taskBotChat(req, res, next) {
    try {
        const userId = DEMO_USER_ID; // userId simulado para a demo; numa versão futura deve vir de autenticação real
        const result = await handleTaskBotMessage(req.body.message.trim(), userId); // trim faz uma normalização extra antes de enviar para o service (prática defensiva)

        return res.status(200).json({
            success: true,
            data: {
                ...result,
                userId,
            }, /* O formato do payload depende do fluxo executado:
                - modo chat
                - execução de tool
                - resposta híbrida 
                
            O controller é neutro, só entrega resultado do service sem interpretar o conteúdo para manter a separação de responsabilidades */
        });
    } catch (error) {
        error.code = error.code || 'TASKBOT_CHAT_ERROR';
        next(error);
    }
}

// Função auxiliar para escrever eventos no stream de forma consistente
function writeStreamEvent(res, event) {
    res.write(`${JSON.stringify(event)}\n`);
}

export async function taskBotChatStream(req, res) {
    const userId = DEMO_USER_ID;

    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    try {
        writeStreamEvent(res, {
            type: 'status',
            stage: 'connected',
            message: 'Ligação de streaming iniciada.',
        });

        await handleTaskBotMessage(req.body.message.trim(), userId, {
            onEvent: async (event) => {
                writeStreamEvent(res, event);
            },
        });

        res.end();
    } catch (error) {
        writeStreamEvent(res, {
            type: 'error',
            error: {
                message: error?.message || 'Erro ao processar o streaming do chat.',
                code: error?.code || 'TASKBOT_CHAT_STREAM_ERROR',
                status: error?.statusCode || 500,
            },
        });

        res.end();
    }
}

// Atualiza o status de uma tarefa (concluída ou pendente) com base no ID e no novo status recebido na request, usando updateTaskCompletion() do service
export async function updateTaskStatus(req, res, next) {
    try {
        const task = await updateTaskCompletion({
            id: req.params.id, // ID da tarefa a atualizar, vindo dos parâmetros da URL - faz parte da rota REST para atualização de status
            completed: req.body.completed, // Novo status da tarefa, vindo do corpo da request
        });

        return res.status(200).json({
            success: true,
            data: task,
        });
    } catch (error) {
        error.code = error.code || 'TASK_STATUS_UPDATE_ERROR';
        next(error);
    }
}

export async function deleteTaskById(req, res, next) {
    try {
        const task = await deleteTask({
            target: req.params.id,
        });

        return res.status(200).json({
            success: true,
            data: task,
        });
    } catch (error) {
        error.code = error.code || 'TASK_DELETE_ERROR';
        next(error);
    }
}
