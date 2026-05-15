/* Gestão de contexto conversacional por utilizador.

Combina:
- histórico recente em RAM
- hidratação a partir da BD
- resumo incremental para limitar tokens

Isto é uma arquitetura híbrida:
persistência + cache + compressão contextual
*/

import { getChatHistoryByUser } from '../infra/db/chatRepository.js';
import { summarizeHistory } from './chatSummaryService.js';

/* Map é mais apropriado para armazenamento dinâmico indexado por chave porque:
- permite qualquer tipo de chave
- tem melhor semântica para cache/state
- APIs mais claras (get/set/has)
- evita colisões com propriedades herdadas do Object

Neste caso funciona como memória temporária de contexto conversacional,
evitando leituras constantes à base de dados durante uma conversa ativa.

A persistência definitiva continua a ser feita na BD através do chat_history.
Em caso de restart do servidor, apenas o estado temporário em memória é perdido.
*/
const chatStateByUser = new Map();
const MAX_ACTIVE_HISTORY = 5;

/* *** IMPORTANTE: ***
o userId ainda é simulado, não vem de autenticação real
*/

function getUserChatState(userId) {
  if (!chatStateByUser.has(userId)) {
    chatStateByUser.set(userId, {
      history: [],
      summary: null,
      pendingTaskAction: null,
      hydrated: false, // esta "flag" permite distinguir estado ainda não carregado, de estado já sincronizado em memória
    });
  }

  return chatStateByUser.get(userId);
}

// Função lazy hydration: só carrega histórico da BD quando necessário e evita queries repetidas;
// Depois do primeiro carregamento, o contexto fica em RAM
export async function hydrateHistoryByUser(userId) {
  const state = getUserChatState(userId);

  if (state.hydrated) {
    return state;
  }

  const persistedHistory = await getChatHistoryByUser(userId);
  state.history.length = 0;
  state.history.push(...persistedHistory);
  state.summary = null;
  state.hydrated = true;

  return state;
}

export function getHistoryByUser(userId) {
  return getUserChatState(userId).history;
}

export function getSummaryByUser(userId) {
  return getUserChatState(userId).summary;
}

export function getPendingTaskActionByUser(userId) {
  return getUserChatState(userId).pendingTaskAction;
}

export function setPendingTaskActionByUser(userId, pendingTaskAction) {
  getUserChatState(userId).pendingTaskAction = pendingTaskAction || null;
}

export function clearPendingTaskActionByUser(userId) {
  getUserChatState(userId).pendingTaskAction = null;
}

export function clearHistoryByUser(userId) {
  chatStateByUser.set(userId, {
    history: [],
    summary: null,
    pendingTaskAction: null,
    hydrated: true,
  });
}

// Resume mensagens antigas e mantém apenas a janela recente ativa em RAM.
export async function limitHistoryWithSummaryByUser(userId) {
  const state = getUserChatState(userId);

  if (state.history.length <= MAX_ACTIVE_HISTORY) return;

  const oldMessages = state.history.slice(0, -MAX_ACTIVE_HISTORY);
  const recentMessages = state.history.slice(-MAX_ACTIVE_HISTORY);

  let newSummary = state.summary;

  try {
    newSummary = await summarizeHistory(oldMessages, state.summary);
  } catch {
    newSummary = state.summary;
  }

  state.summary = newSummary;
  state.history.length = 0;
  state.history.push(...recentMessages);
}