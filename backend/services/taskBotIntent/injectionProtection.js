import {
  hasTaskManagementIntent,
  isPromptInjectionAttempt,
  normalizeText,
} from './shared.js';

// Trata tentativas de sair do papel do TaskBot antes de qualquer interpretação de intent.
export function buildInjectionProtectionReply(message) {
  const normalizedMessage = normalizeText(message);

  if (isPromptInjectionAttempt(normalizedMessage) && !hasTaskManagementIntent(normalizedMessage)) {
    return 'Mantenho-me focado na gestão de tarefas. Posso ajudar-te a criar, editar, concluir, apagar ou listar tarefas.';
  }

  return null;
}