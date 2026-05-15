import { buildTaskValidationClarification } from './clarificationFlows.js';
import { buildLocalChatReply } from './greetings.js';
import {
  createIntentPattern,
  deleteIntentPattern,
  filterIntentPattern,
  hasExplicitTaskIntent,
  hasTaskManagementIntent,
  hasTaskMutationIntent,
  inferTaskActionFromMessage,
  isContextualTaskFollowUp,
  isLocalSmallTalk,
  isReminderCreateFollowUp,
  normalizeText,
  splitMixedScopeClauses,
  taskContextPattern,
  taskMutationDetailPattern,
  updateIntentPattern,
  greetingPattern,
} from './shared.js';

// Guardas determinísticas antes de qualquer mutação.
function hasMixedScopeSegments(message = '') {
  const clauses = splitMixedScopeClauses(message);

  if (clauses.length < 2) {
    return false;
  }

  const hasTaskClause = clauses.some((clause) => hasTaskManagementIntent(clause));
  const hasNonTaskClause = clauses.some((clause) => !hasTaskManagementIntent(clause) && !isLocalSmallTalk(clause));

  return hasTaskClause && hasNonTaskClause;
}

function hasPriorValidatedToolExecution(executedTools = []) {
  return Array.isArray(executedTools) && executedTools.length > 0;
}

// Distingue pedidos massivos/destrutivos de ações unitárias ou filtradas.
function isBulkMutationRequest(normalizedMessage) {
  return /\b(todas as tarefas|todos os tasks|all tasks|na base de dados|base de dados inteira|entire database|whole database)\b/.test(normalizedMessage);
}

export function sanitizeTaskModelReply(message, reply = '') {
  const normalizedReply = normalizeText(reply);

  if (!normalizedReply) {
    return reply;
  }

  if (!hasTaskManagementIntent(normalizeText(message))) {
    return reply;
  }

  const inferredAction = inferTaskActionFromMessage(normalizeText(message));
  const inferredFunctionCall = inferredAction ? { name: inferredAction, args: {} } : null;
  const clarificationReply = buildTaskValidationClarification(message, inferredFunctionCall, reply);

  return clarificationReply || reply;
}

export function buildMixedScopeBoundaryReply(message) {
  const normalizedMessage = normalizeText(message);

  if (!hasTaskManagementIntent(normalizedMessage) || !hasMixedScopeSegments(message)) {
    return null;
  }

  return 'Posso tratar da parte das tarefas, mas não respondo a perguntas fora do âmbito do TaskBot.';
}

export function buildNoToolMutationReply(message) {
  const normalizedMessage = normalizeText(message);

  if (!hasTaskMutationIntent(normalizedMessage)) {
    return null;
  }

  if (updateIntentPattern.test(normalizedMessage)) {
    return 'Posso ajudar-te a editar a tarefa, mas ainda não executei nenhuma alteração. Indica o id ou o título da tarefa e o campo que queres mudar.';
  }

  if (deleteIntentPattern.test(normalizedMessage)) {
    return 'Posso ajudar-te a apagar a tarefa, mas ainda não executei nenhuma alteração. Indica o id ou o título exato da tarefa.';
  }

  return 'Posso ajudar-te a criar a tarefa, mas ainda não executei nenhuma ação. Reformula o pedido só no âmbito das tarefas.';
}

export function shouldExecuteTaskTool(message, functionCall, recentAssistantText = '', executedTools = []) {
  const normalizedMessage = normalizeText(message);
  const toolName = functionCall?.name;
  const hasTaskContext = taskContextPattern.test(normalizedMessage);
  const hasPriorExecutions = hasPriorValidatedToolExecution(executedTools);
  const hasTaskMutationDetail = taskMutationDetailPattern.test(normalizedMessage);
  const hasExplicitTaskIntentFlag = hasExplicitTaskIntent(normalizedMessage);

  if (!toolName) {
    return false;
  }

  if (greetingPattern.test(normalizedMessage)) {
    return false;
  }

  if (isBulkMutationRequest(normalizedMessage) && (toolName === 'update_task' || toolName === 'delete_task')) {
    return false;
  }

  switch (toolName) {
    case 'create_task':
      return createIntentPattern.test(normalizedMessage)
        || isContextualTaskFollowUp(normalizedMessage, recentAssistantText)
        || isReminderCreateFollowUp(normalizedMessage, recentAssistantText);
    case 'update_task':
      // Depois de uma tool já validada, permite ajustes encadeados apenas se a mensagem continuar explicitamente focada em tarefas.
      return updateIntentPattern.test(normalizedMessage)
        || hasTaskContext
        || isContextualTaskFollowUp(normalizedMessage, recentAssistantText)
        || (hasPriorExecutions && hasExplicitTaskIntentFlag && hasTaskMutationDetail);
    case 'delete_task':
      return deleteIntentPattern.test(normalizedMessage) || hasTaskContext || (hasPriorExecutions && deleteIntentPattern.test(normalizedMessage));
    case 'filter_tasks':
      return filterIntentPattern.test(normalizedMessage) || hasTaskContext || (hasPriorExecutions && hasExplicitTaskIntentFlag);
    default:
      return false;
  }
}

export function buildIntentFallbackReply(message) {
  const localReply = buildLocalChatReply(message);

  if (localReply) {
    return localReply;
  }

  const normalizedMessage = normalizeText(message);

  if (isBulkMutationRequest(normalizedMessage) && updateIntentPattern.test(normalizedMessage)) {
    return 'Só posso editar uma tarefa de cada vez. Indica o id ou o título exato da tarefa que queres alterar.';
  }

  if (isBulkMutationRequest(normalizedMessage) && deleteIntentPattern.test(normalizedMessage)) {
    return 'Só posso apagar uma tarefa de cada vez. Indica o id ou o título exato da tarefa que queres remover.';
  }

  return 'Posso ajudar-te com tarefas, mas só executo ações quando o pedido é explícito. Se quiseres criar uma tarefa, diz por exemplo: "Cria uma tarefa para rever o logótipo".';
}