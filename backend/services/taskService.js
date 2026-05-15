/* Service de tarefas:

Faz a ponte entre controllers / tool calls e a persistência, mantendo aqui:
- resolução de targets
- validação de regras de negócio
- normalização de input/output

Fluxo arquitetural:
Controller (recebe request/resposta HTTP)
   ↓
Task Service (decide regras de negócio)
   ↓
Database (armazenamento persistente)

Nota importante:
  A AI nunca acede diretamente à base de dados.
  Apenas chama funções expostas por este service.
*/

import { db } from '../infra/db/db.js'; // O service não sabe detalhes da conexão MySQL, apenas usa a abstração db.
import { createValidationError } from '../utils/validationHelpers.js';
import {
  normalizeTaskTarget,
  normalizeTaskDueDateInput,
  validateCreateTask,
  validateTaskCompleted,
  validateTaskPriority,
  validateTaskTarget,
  validateUpdateTask,
} from '../utils/taskValidator.js'; // A validação foi extraída para uma camada dedicada, deixando o service focado apenas em lógica de negócio.

/* Normalização de datas
Esta função atua como um adaptador para normalizar a data de vencimento antes de qualquer operação que envolva datas, garantindo consistência em toda a aplicação. Ela é usada internamente pelo service para garantir que todas as datas sejam tratadas de forma uniforme, independentemente do formato de entrada fornecido pelo usuário ou pela Gemini. */
function normalizeDueDate(dueDate) {
  return normalizeTaskDueDateInput(dueDate);
}

/* Normalização de output da BD
Transforma snake_case da BD para camelCase usado na aplicação, e converte campos específicos (ex: completed para booleano) para garantir que o formato dos dados seja consistente em toda a aplicação, facilitando o consumo pelos controllers e pela Gemini. */
function normalizeTask(row) {
  if (!row) return null;

  return {
    id: row.id,
    task: row.title,
    priority: row.priority,
    dueDate: row.due_date,
    space: row.space,
    assignee: row.assignee,
    completed: Boolean(row.completed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* Normalização de títulos
Remove espaços inválidos, evita tarefas vazias e centraliza normalização textual para garantir que a lógica de negócio trabalhe com dados limpos e consistentes.
Devolve null se a tarefa for apenas espaços em branco, para evitar criar tarefas sem título.*/
function normalizeTaskTitle(task) {
  if (typeof task !== 'string') {
    return task;
  }

  const normalizedTask = task.trim();
  return normalizedTask || null;
}

// Order by updated_at DESC - o rail de atividade recente deve refletir as tarefas criadas ou editadas mais recentemente.
export async function listTasks() {
  const [rows] = await db.execute(
    'SELECT * FROM tasks ORDER BY updated_at DESC, id DESC'
  );

  return rows.map(normalizeTask);
}

// Resolve uma tarefa com base no target fornecido, que pode ser um ID numérico, a string especial "last_task" ou um fragmento de título. Esta função é usada para identificar a tarefa correta para operações de atualização ou exclusão, permitindo flexibilidade na referência às tarefas.
async function findTaskByTarget(target) {
  const normalizedTarget = normalizeTaskTarget(target);
  validateTaskTarget(normalizedTarget); // Fail Fast - garante que o target é válido antes de fazer qualquer consulta à base de dados, evita queries desnecessárias e protege a integridade dos dados.

  if (normalizedTarget === 'last_task') {
    const [rows] = await db.execute(
      'SELECT * FROM tasks ORDER BY id DESC LIMIT 1'
    );

    return rows[0] || null;
  }

  if (/^\d+$/.test(String(normalizedTarget))) {
    const [rows] = await db.execute(
      'SELECT * FROM tasks WHERE id = ? LIMIT 1',
      [Number(normalizedTarget)]
    );

    return rows[0] || null;
  }

  const [exactRows] = await db.execute(
    'SELECT * FROM tasks WHERE LOWER(TRIM(title)) = LOWER(TRIM(?)) ORDER BY id DESC',
    [normalizedTarget]
  );

  if (exactRows.length > 1) {
    throw createValidationError(`Encontrei várias tarefas com "${normalizedTarget}". Indica o id da tarefa que queres alterar ou apagar.`);
  }

  if (exactRows.length === 1) {
    return exactRows[0];
  }

  const [rows] = await db.execute(
    'SELECT * FROM tasks WHERE LOWER(title) LIKE LOWER(?) ORDER BY id DESC LIMIT 2',
    [`%${normalizedTarget}%`]
  );

  if (rows.length > 1) {
    throw createValidationError(`Encontrei várias tarefas com "${normalizedTarget}". Indica o id da tarefa que queres alterar ou apagar.`);
  }

  return rows[0] || null;
}

// Esta função é responsável por resolver o target para uma tarefa específica e lançar um erro de validação se a tarefa não for encontrada, garantindo que as operações de atualização e exclusão sejam realizadas apenas em tarefas existentes e fornecendo mensagens de erro claras para o usuário.
async function resolveTaskByTarget(target, notFoundMessage) {
  const task = await findTaskByTarget(target);

  if (!task) {
    throw createValidationError(notFoundMessage);
  }

  return task;
}

// Constrói o UPDATE dinâmico para suportar updates parciais sem tocar nos restantes campos.
function buildTaskUpdateStatement(args = {}) {
  const { task, priority, dueDate, space, assignee, completed } = args;
  const updates = [];
  const values = [];
  const normalizedTask = normalizeTaskTitle(task);

  if (normalizedTask) {
    updates.push('title = ?');
    values.push(normalizedTask);
  }

  if (priority !== undefined) {
    updates.push('priority = ?');
    values.push(priority);
  }

  if (dueDate !== undefined) {
    updates.push('due_date = ?');
    values.push(normalizeDueDate(dueDate));
  }

  if (space !== undefined) {
    updates.push('space = ?');
    values.push(space);
  }

  if (assignee !== undefined) {
    updates.push('assignee = ?');
    values.push(assignee);
  }

  if (completed !== undefined) {
    validateTaskCompleted(completed);
    updates.push('completed = ?');
    values.push(completed ? 1 : 0);
  }

  if (updates.length === 0) {
    throw createValidationError('Não há campos para atualizar');
  }

  return { updates, values };
}

// Aqui estão as operações principais de CRUD e filtragem de tarefas, cada uma seguindo um fluxo de validação, normalização, persistência e formatação de saída para garantir que os dados sejam tratados de forma consistente e robusta em toda a aplicação:

/* createTask:
validate
→ normalize
→ persist
→ reload
→ normalize output

SELECT depois do INSERT:
- garante retorno consistente,
- devolve objeto completo
- inclui defaults/transformações da BD
*/
export async function createTask(args = {}) {
  const { task, priority = null, dueDate = null, space = null, assignee = null } = args;
  validateCreateTask({ task, priority, dueDate });
  const normalizedDueDate = normalizeDueDate(dueDate);
  const normalizedTask = normalizeTaskTitle(task);

  const [result] = await db.execute(
    `
      INSERT INTO tasks (title, priority, due_date, space, assignee)
      VALUES (?, ?, ?, ?, ?)
    `,
    [normalizedTask, priority, normalizedDueDate, space, assignee]
  );

  const [rows] = await db.execute(
    'SELECT * FROM tasks WHERE id = ? LIMIT 1',
    [result.insertId]
  );

  return normalizeTask(rows[0]);
}

/* updateTask:
validate
→ resolver target
→ construir update dinâmico
→ executar
→ devolver estado atualizado
*/
export async function updateTask(args = {}) {
  const { target, task, priority, dueDate, space, assignee, completed } = args;
  validateUpdateTask({ target, priority, dueDate, completed });
  const existingTask = await resolveTaskByTarget(target, 'Tarefa não encontrada para atualizar');
  const { updates, values } = buildTaskUpdateStatement({ task, priority, dueDate, space, assignee, completed });

  values.push(existingTask.id);

  await db.execute(
    `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
    values
  );

  const [rows] = await db.execute(
    'SELECT * FROM tasks WHERE id = ? LIMIT 1',
    [existingTask.id]
  );

  return normalizeTask(rows[0]);
}

// Como o estado de conclusão é uma ação frequente e específica da UI, então foi tratado como operação dedicada.
export async function updateTaskCompletion(args = {}) {
  const { id, completed } = args;

  if (!id || !/^\d+$/.test(String(id))) {
    throw createValidationError('É necessário indicar um id válido para atualizar o estado da tarefa');
  }

  if (typeof completed !== 'boolean') {
    throw createValidationError('O campo completed deve ser booleano');
  }

  await db.execute('UPDATE tasks SET completed = ? WHERE id = ?', [completed ? 1 : 0, Number(id)]);

  const [rows] = await db.execute('SELECT * FROM tasks WHERE id = ? LIMIT 1', [Number(id)]);

  if (!rows[0]) {
    throw createValidationError('Tarefa não encontrada para atualizar o estado');
  }

  return normalizeTask(rows[0]);
}

// A função deleteTask é responsável por excluir uma tarefa com base no target fornecido, garantindo que a tarefa exista antes de tentar excluí-la e fornecendo uma resposta consistente após a exclusão.
export async function deleteTask(args = {}) {
  const { target } = args;
  const existingTask = await resolveTaskByTarget(target, 'Tarefa não encontrada para apagar');

  await db.execute('DELETE FROM tasks WHERE id = ?', [existingTask.id]);

  return normalizeTask(existingTask);
}

/* Esta função permite filtrar tarefas com base em critérios como prioridade, data de vencimento, espaço ou responsável, construindo dinamicamente a cláusula WHERE da consulta SQL para retornar apenas as tarefas que correspondem aos filtros fornecidos, e garantindo que os dados sejam normalizados antes de serem usados na consulta.

Fluxo: validar → normalizar → construir query → executar
*/
export async function filterTasks(args = {}) {
  validateTaskPriority(args.priority);

  const filters = [];
  const values = [];

  if (args.priority) {
    filters.push('priority = ?');
    values.push(args.priority);
  }

  if (args.dueDate) {
    filters.push('due_date = ?');
    values.push(normalizeDueDate(args.dueDate));
  }

  if (args.dueDateBefore) {
    filters.push('due_date < ?');
    values.push(normalizeDueDate(args.dueDateBefore));
  }

  if (typeof args.hasDueDate === 'boolean') {
    filters.push(args.hasDueDate ? 'due_date IS NOT NULL' : 'due_date IS NULL');
  }

  if (args.space) {
    filters.push('space = ?');
    values.push(args.space);
  }

  if (args.assignee) {
    filters.push('assignee = ?');
    values.push(args.assignee);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const [rows] = await db.execute(
    `SELECT * FROM tasks ${whereClause} ORDER BY id DESC`,
    values
  );

  return rows.map(normalizeTask);
}

// Faz a ponte entre function calls da Gemini e operações reais do backend.

export async function executeTaskAction(functionCall) {
  const action = functionCall?.name || functionCall?.action;
  const args = functionCall?.args || {};

  switch (action) { // switch case para rotear a ação para a função correta do service, garantindo que cada ação seja tratada de forma específica e organizada.
    case 'create_task':
      return createTask(args);
    case 'update_task':
      return updateTask(args);
    case 'delete_task':
      return deleteTask(args);
    case 'filter_tasks':
      return filterTasks(args);
    default:
      throw createValidationError('Função desconhecida');
  }
}