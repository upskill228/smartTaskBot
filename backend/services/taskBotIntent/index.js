export {
  buildLocalChatReply,
  buildStatelessLocalChatReply,
} from './greetings.js';

export {
  buildTaskToolClarification,
  buildTaskValidationClarification,
  createPendingTaskAction,
  resumePendingTaskAction,
} from './clarificationFlows.js';

export {
  buildIntentFallbackReply,
  buildMixedScopeBoundaryReply,
  buildNoToolMutationReply,
  sanitizeTaskModelReply,
  shouldExecuteTaskTool,
} from './taskIntents.js';


/* Este arquivo serve como ponto central de exportação para todas as funcionalidades relacionadas com a interpretação de intenções do TaskBot. Ele organiza e expõe as funções de proteção contra prompt injection, interpretação de intenções, e fluxos de esclarecimento, garantindo que o backend possa importar facilmente as funcionalidades necessárias para processar mensagens do TaskBot de forma segura e eficaz. Ao centralizar essas exportações, facilitamos a manutenção e a escalabilidade do código, permitindo que novas funcionalidades ou ajustes sejam integrados sem afetar a estrutura geral do serviço. */