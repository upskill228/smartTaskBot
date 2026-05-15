 /* Camada de definição de tools (function calling) do TaskBot.

  Arquitetura:

  A implementação de function calling foi separada em módulos para evitar:
  - mistura de IA com lógica de negócio (SQL / validação / services)
  - acoplamento entre parsing da resposta e execução de ações
  - duplicação de configuração da Gemini

  Fluxo completo do system:

  1. tools são declaradas aqui (schema de inputs)
  2. são injetadas em taskBotGeminiConfig.js via functionDeclarations
  3. callGemini.js envia tools para a Gemini
  4. resposta contém functionCall
  5. taskBotReplyService.js extrai functionCall
  6. taskBotService.js executa loop de tools
  7. backend constrói manualmente functionResponse

  Importante:
  - a Gemini NÃO executa nada diretamente
  - apenas sugere ações estruturadas
  - toda execução é controlada pelo backend
 */

import { Type } from '@google/genai';

// Tools divididas por funcionalidade - facilita organização e manutenção;

 /* Tool de criação de tarefas.

O modelo apenas sugere os parâmetros.
A validação e persistência são responsabilidade do backend.
 */
export const createTaskTool = {
  name: 'create_task',
  description: 'Creates a new task in the system. Use dueDate only in YYYY-MM-DD format. Convert relative dates like ontem, hoje or amanha before calling.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      task: {
        type: Type.STRING,
        description: 'Short task title in Portuguese.'
      },
      priority: {
        type: Type.STRING,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        description: 'Priority level when explicitly present or clearly implied.'
      },
      dueDate: {
        type: Type.STRING,
        description: 'Task due date in YYYY-MM-DD only.'
      },
      space: {
        type: Type.STRING,
        description: 'Optional workspace, team or area.'
      },
      assignee: {
        type: Type.STRING,
        description: 'Optional assignee name.'
      }
    },
    required: ['task']
  }
};

 /* Tool para atualização de tarefas existentes.

  Suporta resolução flexível de alvo:
  - ID explícito
  - fragmento de título
  - referência contextual (last_task)

  Isto permite interação natural em linguagem humana.
 */
export const updateTaskTool = {
  name: 'update_task',
  description: 'Updates an existing task. Use target="last_task" for references like essa tarefa. Use dueDate only in YYYY-MM-DD format. To mark a task as completed or pending, use the completed boolean instead of changing the title.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      target: {
        type: Type.STRING,
        description: 'Task identifier, title fragment, or last_task.'
      },
      task: {
        type: Type.STRING,
        description: 'New task title.'
      },
      priority: {
        type: Type.STRING,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        description: 'Updated priority level.'
      },
      dueDate: {
        type: Type.STRING,
        description: 'Updated due date in YYYY-MM-DD only.'
      },
      space: {
        type: Type.STRING,
        description: 'Updated workspace, team or area.'
      },
      assignee: {
        type: Type.STRING,
        description: 'Updated assignee name.'
      },
      completed: {
        type: Type.BOOLEAN,
        description: 'Task completion status. Use true for concluida and false for pendente.'
      }
    },
    required: ['target']
  }
};

 /* Tool de remoção de tarefas.

  O backend resolve a tarefa real com base no "target".
  Evita que o modelo precise de IDs internos.
 */
export const deleteTaskTool = {
  name: 'delete_task',
  description: 'Deletes a task. Use target="last_task" for references to the most recent task in context.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      target: {
        type: Type.STRING,
        description: 'Task identifier, title fragment, or last_task.'
      }
    },
    required: ['target']
  }
};

 /* Tool de filtragem de tarefas.

  Permite queries estruturadas sobre tarefas armazenadas.

  Suporta filtros combináveis:
  - prioridade
  - intervalo temporal (dueDate / dueDateBefore)
  - existência de data
  - workspace (space)
  - responsável (assignee)

  Isto permite ao modelo transformar linguagem natural em queries estruturadas.
 */
export const filterTasksTool = {
  name: 'filter_tasks',
  description: 'Filters tasks by criteria. Use dueDate and dueDateBefore only in YYYY-MM-DD format. Convert relative dates like ontem, hoje or amanha before calling and only include filters requested or clearly implied.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      priority: {
        type: Type.STRING,
        description: 'Priority filter.'
      },
      dueDate: {
        type: Type.STRING,
        description: 'Due date filter in YYYY-MM-DD only.'
      },
      dueDateBefore: {
        type: Type.STRING,
        description: 'Only include tasks with due date earlier than this YYYY-MM-DD date.'
      },
      hasDueDate: {
        type: Type.BOOLEAN,
        description: 'When true, include only tasks that have a due date. When false, include only tasks without due date.'
      },
      space: {
        type: Type.STRING,
        description: 'Workspace, team or area filter.'
      },
      assignee: {
        type: Type.STRING,
        description: 'Assignee name filter.'
      }
    }
  }
};