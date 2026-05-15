import {
  formatTaskReference,
  hasValue,
  normalizeText,
  parsePendingDueDateValue,
  parsePendingPriorityValue,
  parsePendingTargetValue,
} from './shared.js';

// Faz a ponte entre linguagem ambígua e argumentos estruturados.
function isMissingPriorityClarification(normalizedMessage, functionCall) {
  if (functionCall?.name !== 'update_task') {
    return false;
  }

  const asksForPriorityChange = /\b(prioridade|priority)\b/.test(normalizedMessage)
    && /\b(atualiza|actualiza|atualizar|actualizar|muda|mudar|altera|alterar|edita|editar|define|definir|set|change|update|edit)\b/.test(normalizedMessage);

  return asksForPriorityChange && !hasValue(functionCall?.args?.priority);
}

function inferMissingFieldFromClarificationReply(clarificationReply, functionCall) {
  const normalizedReply = normalizeText(clarificationReply);

  if (!normalizedReply) {
    return null;
  }

  if (functionCall?.name === 'update_task' && /\b(que prioridade|qual e a prioridade)\b/.test(normalizedReply)) {
    return 'priority';
  }

  if (/\b(que data|qual e a data|que prazo|para quando|data em formato)\b/.test(normalizedReply)) {
    return 'dueDate';
  }

  if (/\b(que tarefa|qual e a tarefa|indica a tarefa|indica o titulo|indica o id da tarefa|qual e o id da tarefa|que id|target)\b/.test(normalizedReply)) {
    return 'target';
  }

  return null;
}

export function createPendingTaskAction(functionCall, clarificationReply) {
  const missingField = inferMissingFieldFromClarificationReply(clarificationReply, functionCall);

  if (!functionCall?.name || !missingField) {
    return null;
  }

  return {
    toolName: functionCall.name,
    args: { ...(functionCall.args || {}) },
    missingField,
  };
}

export function resumePendingTaskAction(message, pendingTaskAction) {
  if (!pendingTaskAction?.toolName || !pendingTaskAction?.missingField) {
    return null;
  }

  const normalizedMessage = normalizeText(message);
  let nextValue = null;

  switch (pendingTaskAction.missingField) {
    case 'target':
      nextValue = parsePendingTargetValue(normalizedMessage);
      break;
    case 'dueDate':
      nextValue = parsePendingDueDateValue(normalizedMessage);
      break;
    case 'priority':
      nextValue = parsePendingPriorityValue(normalizedMessage);
      break;
    default:
      nextValue = null;
  }

  if (!hasValue(nextValue)) {
    return null;
  }

  return {
    name: pendingTaskAction.toolName,
    args: {
      ...(pendingTaskAction.args || {}),
      [pendingTaskAction.missingField]: nextValue,
    },
  };
}

// Clarificação preventiva antes de executar uma tool quando o pedido ainda está incompleto.
export function buildTaskToolClarification(message, functionCall) {
  const normalizedMessage = normalizeText(message);

  if (isMissingPriorityClarification(normalizedMessage, functionCall)) {
    return `Que prioridade queres definir para ${formatTaskReference(functionCall?.args?.target)}? Podes escolher baixa, media, alta ou urgente.`;
  }

  return null;
}

// Traduz erros técnicos/estruturais em perguntas curtas e úteis para o utilizador.
export function buildTaskValidationClarification(message, functionCall, errorMessage = '') {
  const normalizedErrorMessage = normalizeText(errorMessage);

  if (normalizedErrorMessage === 'target e obrigatorio') {
    if (functionCall?.name === 'delete_task') {
      return 'Que tarefa queres apagar? Indica o titulo, o id ou diz "essa tarefa" se te referes a uma tarefa recente.';
    }

    if (functionCall?.name === 'update_task') {
      return 'Que tarefa queres editar? Indica o titulo, o id ou diz "essa tarefa" se te referes a uma tarefa recente.';
    }
  }

  if (normalizedErrorMessage.startsWith('data invalida')) {
    return 'Que data queres usar? Indica-a em YYYY-MM-DD ou usa ontem/hoje/amanha. Se preferires, tambem podes responder com um formato curto como 15/05.';
  }

  if (normalizedErrorMessage === 'prioridade invalida') {
    return `Que prioridade queres definir para ${formatTaskReference(functionCall?.args?.target)}? Podes escolher baixa, media, alta ou urgente.`;
  }

  return null;
}