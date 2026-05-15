import { buildInjectionProtectionReply } from './injectionProtection.js';
import {
  capabilitiesPattern,
  goodbyePattern,
  greetingPattern,
  hasExplicitTaskIntent,
  helpPattern,
  isConfirmationLike,
  isContextualTaskFollowUp,
  isReminderCreateFollowUp,
  isReminderLikeMessage,
  isThanksLike,
  normalizeText,
} from './shared.js';

// Respostas locais e previsíveis que não justificam chamar a AI.
export function buildStatelessLocalChatReply(message) {
  const normalizedMessage = normalizeText(message);
  const injectionReply = buildInjectionProtectionReply(message);

  if (injectionReply) {
    return injectionReply;
  }

  if (isReminderLikeMessage(normalizedMessage)) {
    return 'Posso transformar isso numa tarefa. Queres que crie uma tarefa com esse prazo?';
  }

  if (greetingPattern.test(normalizedMessage)) {
    return 'Olá. Precisas criar, editar, apagar ou listar tarefas? Escreve, por exemplo: "Cria uma tarefa para rever o relatório amanhã".';
  }

  if (helpPattern.test(normalizedMessage) || capabilitiesPattern.test(normalizedMessage)) {
    return 'Posso ajudar-te a criar, editar, concluir, apagar e listar tarefas. Por exemplo: "Cria uma tarefa urgente para amanhã", "Mostra as tarefas pendentes" ou "Marca a última tarefa como concluída".';
  }

  if (isThanksLike(normalizedMessage)) {
    return 'De nada. Se quiseres, continuo a ajudar-te com as tuas tarefas.';
  }

  if (goodbyePattern.test(normalizedMessage)) {
    return 'Até já. Quando voltares, estou por aqui para ajudar com as tuas tarefas.';
  }

  return null;
}

export function buildLocalChatReply(message, recentAssistantText = '') {
  const normalizedMessage = normalizeText(message);

  // Em follow-ups de tarefa, deixa o fluxo principal decidir se deve retomar a ação pendente.
  if (isContextualTaskFollowUp(normalizedMessage, recentAssistantText) || isReminderCreateFollowUp(normalizedMessage, recentAssistantText)) {
    return null;
  }

  const statelessLocalReply = buildStatelessLocalChatReply(message);

  if (statelessLocalReply) {
    return statelessLocalReply;
  }

  if (recentAssistantText && isConfirmationLike(normalizedMessage)) {
    return 'Perfeito. Se quiseres, continuo a ajudar-te com as tuas tarefas.';
  }

  if (!hasExplicitTaskIntent(normalizedMessage)) {
    return 'Estou focado na gestão de tarefas. Posso ajudar-te a criar, editar, apagar ou listar tarefas se me disseres o que precisas.';
  }

  return null;
}