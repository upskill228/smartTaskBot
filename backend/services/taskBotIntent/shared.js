// Fonte única de regex e normalização para manter critérios consistentes entre módulos.
const greetingPattern = /^(ola|oi|hello|bom dia|boa tarde|boa noite|hey|saudacoes)[!. ]*$/;
const createIntentPattern = /\b(cria|criar|adiciona|adicionar|regista|registar|agenda|agendar|faz uma tarefa|nova tarefa|create|add|schedule|new task)\b/;
const updateIntentPattern = /\b(atualiza|actualiza|atualizar|actualizar|muda|mudar|altera|alterar|edita|editar|atribui|atribuir|define|definir|marca|marcar|conclui|concluir|completa|completar|update|change|edit|assign|set|mark|complete)\b/;
const deleteIntentPattern = /\b(apaga|apagar|elimina|eliminar|remove|remover|delete)\b/;
const filterIntentPattern = /\b(mostra|mostrar|lista|listar|filtra|filtrar|quais|tenho|ver tarefas|ver task|show|list|what are|what tasks|do i have)\b/;
const taskContextPattern = /\b(tarefa|tarefas|task|tasks|prioridade|priority|prazo|due date|data limite|responsavel|assignee|espaco|space|essa tarefa|ultima tarefa|last_task)\b/;
const taskMutationDetailPattern = /\b(urgente|alta|media|baixa|low|medium|high|urgent|prioridade|priority|ontem|yesterday|amanha|tomorrow|hoje|today|data|prazo|due date|atribui|atribuir|assign|responsavel|assignee|espaco|space|concluida|pendente|completa|completar|conclui|concluir|marca|marcar|completed|pending)\b/;
const reminderIntentPattern = /\b(lembra-me|lembrete|recorda-me|recordar-me|remind me)\b/;
const reminderConfirmationPromptPattern = /\b(queres que crie uma tarefa com isso|queres que registe uma tarefa com isso|devo criar uma tarefa com isso|posso transformar isso numa tarefa|queres que transforme esse pedido numa tarefa|transforme esse pedido numa tarefa)\b/;
const helpPattern = /^(ajuda|help|socorro)[!. ]*$/;
const capabilitiesPattern = /^(o que consegues fazer|o que podes fazer|como podes ajudar|que tipo de tarefas fazes)[?.! ]*$/;
const thanksPattern = /^(obrigado|obrigada|thanks|thank you)[!. ]*$/;
const contextualThanksPattern = /\b(obrigado|obrigada|thanks|thank you)\b|\b(esta bem|ta bem|ok|okay|perfeito|boa|combinado|certo)\b.*\b(obrigado|obrigada|thanks|thank you)\b/;
const confirmationPattern = /^(sim|ok|okay|certo|combinado|perfeito|otimo|boa|pode ser|pode ficar assim|esta bem|esta bem assim|sim pode ficar assim|sim, pode ficar assim|esta otimo)[!. ]*$/;
const goodbyePattern = /^(adeus|ate logo|tchau|xau|bye)[!. ]*$/;
const promptInjectionPattern = /\b(esquece que es|ignora as instrucoes|ignora as instrucoes anteriores|ignora o system prompt|agora es|finge que es|atua como|age como|pretende ser|faz de conta que es|deixa de ser o taskbot|forget you are|ignore the previous instructions|ignore the system prompt|you are now|pretend to be|act as)\b/;
const missingTaskInfoPattern = /\b(qual e o titulo|qual e o nome da tarefa|indica o titulo|titulo da tarefa|que titulo|que nome da tarefa|falta.*titulo|qual e o prazo|qual e a data|quando e o prazo|que data|que prazo|falta.*prazo|falta.*data|define?r? um prazo|desejas definir um prazo|queres definir um prazo|para quando|para que dia|que dia|quando queres que crie|quando queres criar|que dia queres|qual e o espaco|em que espaco|que espaco|falta.*espaco|qual e o responsavel|a quem devo atribuir|a quem queres atribuir|quem e o responsavel|quem fica responsavel|falta.*responsavel|atribuir um responsavel|atribuir um responsável|definir um responsavel|definir um responsável|qual e a prioridade|que prioridade|falta.*prioridade|qual tarefa|que tarefa|que tarefa queres atualizar|que tarefa queres alterar|qual e a tarefa|indica a tarefa|indica o target|qual e o id da tarefa|que id)\b/;
const dateFilterClarificationPromptPattern = /\b(formato de data|data de ontem|dias anteriores|datas anteriores|antes de hoje|sem data limite|sem prazo|tarefas em atraso)\b/;
const dateFilterClarificationReplyPattern = /\b(ontem|dias anteriores|datas anteriores|antes de hoje|em atraso|sem data limite|sem prazo|nao mostres|não mostres|so com data|só com data)\b/;
const weekdayPattern = /\b(segunda(?:-feira)?|terca(?:-feira)?|terça(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado|sábado|domingo)\b/;
const recentTaskSuccessReplyPattern = /\b(tarefa .* foi criada com sucesso|tarefa criada com sucesso|tarefa .* foi atualizada|tarefa atualizada com sucesso|atualizei .* tarefa)\b/;
const numericIdReplyPattern = /^(?:id\s*[:#-]?\s*)?(\d+)$/;
const clauseSeparatorPattern = /[;\n]+/;

const priorityValueMap = {
  baixa: 'LOW',
  low: 'LOW',
  media: 'MEDIUM',
  medium: 'MEDIUM',
  alta: 'HIGH',
  high: 'HIGH',
  urgente: 'URGENT',
  urgent: 'URGENT',
};

export function normalizeText(text = '') {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

export function buildIsoDateFromDayMonth(day, month, referenceDate = new Date()) {
  const numericDay = Number(day);
  const numericMonth = Number(month);

  if (!Number.isInteger(numericDay) || !Number.isInteger(numericMonth) || numericDay < 1 || numericDay > 31 || numericMonth < 1 || numericMonth > 12) {
    return null;
  }

  return `${referenceDate.getFullYear()}-${padDatePart(numericMonth)}-${padDatePart(numericDay)}`;
}

export function isThanksLike(normalizedMessage) {
  return thanksPattern.test(normalizedMessage) || contextualThanksPattern.test(normalizedMessage);
}

export function isConfirmationLike(normalizedMessage) {
  return confirmationPattern.test(normalizedMessage);
}

export function isAffirmativeTaskFollowUp(normalizedMessage) {
  if (isConfirmationLike(normalizedMessage)) {
    return true;
  }

  return /^(sim|ok|okay|certo|combinado|perfeito|boa|pode ser)\b/.test(normalizedMessage);
}

export function hasExplicitTaskIntent(normalizedMessage) {
  return [createIntentPattern, updateIntentPattern, deleteIntentPattern, filterIntentPattern, taskContextPattern]
    .some((pattern) => pattern.test(normalizedMessage));
}

export function isLocalSmallTalk(normalizedMessage) {
  return greetingPattern.test(normalizedMessage)
    || helpPattern.test(normalizedMessage)
    || capabilitiesPattern.test(normalizedMessage)
    || isThanksLike(normalizedMessage)
    || goodbyePattern.test(normalizedMessage);
}

export function isContextualTaskFollowUp(normalizedMessage, recentAssistantText = '') {
  const normalizedAssistantText = normalizeText(recentAssistantText);
  const hasDateLikeFollowUp = Boolean(parsePendingDueDateValue(normalizedMessage)) || weekdayPattern.test(normalizedMessage);

  if (!normalizedAssistantText || isLocalSmallTalk(normalizedMessage) || hasExplicitTaskIntent(normalizedMessage)) {
    return false;
  }

  return missingTaskInfoPattern.test(normalizedAssistantText)
    || (recentTaskSuccessReplyPattern.test(normalizedAssistantText)
      && (taskMutationDetailPattern.test(normalizedMessage) || hasDateLikeFollowUp))
    || (dateFilterClarificationPromptPattern.test(normalizedAssistantText)
      && dateFilterClarificationReplyPattern.test(normalizedMessage));
}

export function isReminderLikeMessage(normalizedMessage) {
  return reminderIntentPattern.test(normalizedMessage);
}

export function isReminderCreateFollowUp(normalizedMessage, recentAssistantText = '') {
  const normalizedAssistantText = normalizeText(recentAssistantText);

  if (!normalizedAssistantText || !reminderConfirmationPromptPattern.test(normalizedAssistantText)) {
    return false;
  }

  return isAffirmativeTaskFollowUp(normalizedMessage) || createIntentPattern.test(normalizedMessage);
}

export function isPromptInjectionAttempt(normalizedMessage) {
  return promptInjectionPattern.test(normalizedMessage);
}

export function hasTaskManagementIntent(normalizedMessage) {
  return [createIntentPattern, updateIntentPattern, deleteIntentPattern, filterIntentPattern]
    .some((pattern) => pattern.test(normalizedMessage));
}

export function hasTaskMutationIntent(normalizedMessage) {
  return [createIntentPattern, updateIntentPattern, deleteIntentPattern]
    .some((pattern) => pattern.test(normalizedMessage));
}

export function inferTaskActionFromMessage(normalizedMessage) {
  if (updateIntentPattern.test(normalizedMessage)) {
    return 'update_task';
  }

  if (deleteIntentPattern.test(normalizedMessage)) {
    return 'delete_task';
  }

  if (createIntentPattern.test(normalizedMessage)) {
    return 'create_task';
  }

  if (filterIntentPattern.test(normalizedMessage)) {
    return 'filter_tasks';
  }

  return null;
}

export function formatTaskReference(target) {
  if (!hasValue(target) || target === 'last_task') {
    return 'essa tarefa';
  }

  return `a tarefa "${target}"`;
}

export function parsePendingTargetValue(normalizedMessage) {
  const idMatch = normalizedMessage.match(numericIdReplyPattern);
  return idMatch ? idMatch[1] : null;
}

export function parsePendingPriorityValue(normalizedMessage) {
  return priorityValueMap[normalizedMessage] || null;
}

export function parsePendingDueDateValue(normalizedMessage) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedMessage)) {
    return normalizedMessage;
  }

  if (normalizedMessage === 'ontem' || normalizedMessage === 'hoje' || normalizedMessage === 'amanha' || normalizedMessage === 'amanhã') {
    return normalizedMessage;
  }

  const partialDateMatch = normalizedMessage.match(/^(\d{1,2})[/-](\d{1,2})$/);

  if (!partialDateMatch) {
    return null;
  }

  return buildIsoDateFromDayMonth(partialDateMatch[1], partialDateMatch[2]);
}

export function splitMixedScopeClauses(message = '') {
  return message
    .split(clauseSeparatorPattern)
    .map((part) => normalizeText(part))
    .filter(Boolean);
}

export {
  createIntentPattern,
  updateIntentPattern,
  deleteIntentPattern,
  filterIntentPattern,
  taskContextPattern,
  taskMutationDetailPattern,
  greetingPattern,
  helpPattern,
  capabilitiesPattern,
  goodbyePattern,
};