/* Este ficheiro centraliza validações relacionadas com tarefas antes da persistência na base de dados.

Mesmo usando AI e function calling, o backend continua responsável pela validação final dos dados.
O backend deve garantir que os dados recebidos são válidos e seguros para processar, evitando erros e mantendo a integridade da aplicação.

(é validação determinística depois da interpretação probabilística da AI)

Fluxo con defesa em profundidade:

Frontend Validation
        ↓
Prompt Constraints
        ↓
Function Calling Schema
        ↓
Backend Validation
        ↓
Database
*/

import { createValidationError } from './validationHelpers.js';

// Uma única fonte de verdade - Evita repetição, melhora a manutenção e garante consistência com a BD (ENUM)
const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

// Converte Date para formato ISO YYYY-MM-DD - usado para normalizar datas antes de persistência.
function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

// Verifica se um valor é string não vazia após trim - usado para validação defensiva de inputs.
function hasText(value) {
  return typeof value === 'string' && value.trim() !== '';
}

export function normalizeTaskTarget(target) {
  if (typeof target !== 'string') {
    return target;
  }

  const trimmedTarget = target.trim();
  const prefixedIdMatch = trimmedTarget.match(/^id\s*(\d+)$/i);
  const hashOnlyIdMatch = trimmedTarget.match(/^#(\d+)$/);
  const titleWithHashIdMatch = trimmedTarget.match(/^.+\s+#(\d+)$/);

  if (prefixedIdMatch) {
    return prefixedIdMatch[1];
  }

  if (hashOnlyIdMatch) {
    return hashOnlyIdMatch[1];
  }

  if (titleWithHashIdMatch) {
    return titleWithHashIdMatch[1];
  }

  return trimmedTarget;
}

// Valida se o input de data é aceitável no sistema - aceita formato ISO ou linguagem natural controlada ("ontem", "hoje", "amanhã").
function isAcceptedDueDateInput(value) {
  if (!hasText(value)) {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();

  return /^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)
    || normalizedValue === 'ontem'
    || normalizedValue === 'hoje'
    || normalizedValue === 'amanha'
    || normalizedValue === 'amanhã';
}

// Valida prioridade da tarefa apenas se for fornecida.
// Permite undefined/null para updates parciais.
export function validateTaskPriority(priority) {
  if (priority === undefined || priority === null || priority === '') {
    return;
  }

  if (!validPriorities.includes(priority)) {
    throw createValidationError('Prioridade inválida');
  }
}

export function validateTaskCompleted(completed) {
  if (completed === undefined || completed === null || completed === '') {
    return;
  }

  if (typeof completed !== 'boolean') {
    throw createValidationError('O campo completed deve ser booleano');
  }
}

// Valida entrada de data antes de qualquer normalização - aceita apenas formatos controlados para evitar inconsistência na lógica de negócio.
export function validateTaskDueDateInput(dueDate) {
  if (dueDate === undefined || dueDate === null || dueDate === '') {
    return;
  }

  if (typeof dueDate !== 'string' || !isAcceptedDueDateInput(dueDate)) {
    throw createValidationError('Data inválida. Usa YYYY-MM-DD, ontem, hoje ou amanhã');
  }
}

// Converte input de data (incluindo linguagem natural) para formato ISO.
export function normalizeTaskDueDateInput(dueDate, referenceDate = new Date()) {
  if (dueDate === undefined || dueDate === null || dueDate === '') {
    return null;
  }

  validateTaskDueDateInput(dueDate);

  const normalizedValue = dueDate.trim().toLowerCase();

  // Caso já seja ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return normalizedValue;
  }

  // Tradução de linguagem natural controlada
  if (normalizedValue === 'ontem') {
    const yesterday = new Date(referenceDate);
    yesterday.setDate(referenceDate.getDate() - 1);
    return toIsoDate(yesterday);
  }

  if (normalizedValue === 'hoje') {
    return toIsoDate(referenceDate);
  }

  if (normalizedValue === 'amanha' || normalizedValue === 'amanhã') {
    const tomorrow = new Date(referenceDate);
    tomorrow.setDate(referenceDate.getDate() + 1);
    return toIsoDate(tomorrow);
  }

  throw createValidationError('Data inválida. Usa YYYY-MM-DD, ontem, hoje ou amanhã');
}

// Valida o identificador da tarefa alvo.
// Suporta ID numérico ou referência textual (ex: last_task).
export function validateTaskTarget(target) {
  const normalizedTarget = normalizeTaskTarget(target);

  if (!hasText(normalizedTarget) && !/^\d+$/.test(String(normalizedTarget ?? ''))) {
    throw createValidationError('Target é obrigatório');
  }
}

// Valida payload de criação de tarefa.
// Garante que campos essenciais existem antes de chegar à camada de persistência.
export function validateCreateTask({ task, priority, dueDate }) {
  if (!hasText(task)) {
    throw createValidationError('Título da tarefa é obrigatório');
  }

  validateTaskPriority(priority);
  validateTaskDueDateInput(dueDate);
}

// Valida payload de atualização de tarefa.
// Não exige todos os campos porque updates são parciais (PATCH semantics).
export function validateUpdateTask(data) {
  validateTaskTarget(data.target);
  validateTaskPriority(data.priority);
  validateTaskDueDateInput(data.dueDate);
  validateTaskCompleted(data.completed);
}

/*
Este ficheiro não pertence à camada de serviços porque não executa lógica de negócio nem acesso à base de dados.

A sua responsabilidade é apenas validar e normalizar dados de entrada antes de chegarem à camada de persistência.

Mesmo com constraints na base de dados, esta validação é necessária porque:
- a BD deve ser a última linha de defesa
- o sistema deve falhar de forma controlada e previsível
- inputs podem vir da AI, API ou utilizadores externos

No futuro, esta lógica poderia ser substituída por uma abordagem schema-based (ex: Zod),
mas aqui optou-se por validação explícita para maior controlo e clareza.
*/