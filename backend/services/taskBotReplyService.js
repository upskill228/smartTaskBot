
/* Helpers para interpretar o turno do modelo e gerar replies de fallback. */

import { callGeminiWithContents } from '../infra/ai/callGemini.js';
import { buildTaskBotConfig, TASKBOT_REPLY_TEMPERATURE } from '../infra/ai/taskBotGeminiConfig.js';

// A resposta do modelo é lida ao nível das parts para suportar múltiplas function calls no mesmo turno, em vez de assumir apenas a primeira.
export function extractModelTurn(response) {
  const modelContent = response?.candidates?.[0]?.content || null;
  const contentParts = modelContent?.parts || []; // Como a estrutura da resposta da AI pode variar, optou-se por usar optional chaining para evitar crashes caso alguma propriedade venha indefinida.
  const functionCalls = contentParts
    .filter((part) => part?.functionCall)
    .map((part) => part.functionCall);
  const replyText = contentParts
    .filter((part) => typeof part?.text === 'string' && part.text.trim() && !part.thought)
    .map((part) => part.text.trim())
    .join('\n')
    .trim() || response?.text?.trim() || '';

  return {
    modelContent,
    functionCalls,
    replyText,
  };
}

// Faz uma segunda chamada opcional à Gemini para transformar resultado técnico em linguagem natural.
export async function buildNaturalReply({ contents, toolName, toolArgs, data }) {
  const fallbackReply = buildFallbackReply(toolName, data);
  const followUpContents = [
    ...contents,
    {
      role: 'user',
      parts: [
        {
          text: `A tool ${toolName} foi executada com os argumentos ${JSON.stringify(toolArgs)} e devolveu este resultado: ${JSON.stringify(data)}. Responde agora ao utilizador em português europeu, de forma curta e natural, confirmando apenas o que aconteceu e usando o contexto completo da conversa.`
        }
      ]
    }
  ];

  try {
    return await callGeminiWithContents(
      followUpContents,
      undefined,
      buildTaskBotConfig({ temperature: TASKBOT_REPLY_TEMPERATURE }),
    );
  } catch {
    return fallbackReply;
  }
}

export function buildToolExecutionFallback(executions = []) {
  if (!Array.isArray(executions) || executions.length === 0) {
    return 'Ação executada com sucesso.';
  }

  if (executions.length === 1) {
    const [{ toolName, data }] = executions;
    return buildFallbackReply(toolName, data);
  }

  return executions
    .map(({ toolName, data }) => buildFallbackReply(toolName, data))
    .join(' ')
    .trim();
}

export function buildReplyWithExecutedActions(reply, executions = []) {
  if (!Array.isArray(executions) || executions.length === 0) {
    return reply;
  }

  const executedSummary = executions.length === 1
    ? `Já executei esta parte: ${buildFallbackReply(executions[0].toolName, executions[0].data)}`
    : `Já executei estas partes: ${executions.map(({ toolName, data }) => buildFallbackReply(toolName, data)).join(' ')}`;

  return `${executedSummary} ${reply}`.trim();
}

// Mantém o sistema funcional mesmo que a segunda chamada à AI falhe.
function buildFallbackReply(toolName, data) {
  switch (toolName) {
    case 'create_task':
      return `Tarefa criada com sucesso: ${data.task}.`;
    case 'update_task':
      if (typeof data?.completed === 'boolean') {
        return data.completed
          ? `Tarefa marcada como concluída: ${data.task}.`
          : `Tarefa marcada como pendente: ${data.task}.`;
      }

      return `Tarefa atualizada com sucesso: ${data.task}.`;
    case 'delete_task':
      return `Tarefa apagada com sucesso: ${data.task}.`;
    case 'filter_tasks':
      return `Encontrei ${data.length} tarefa${data.length === 1 ? '' : 's'} com esses critérios.`;
    default:
      return 'Ação executada com sucesso.';
  }
}