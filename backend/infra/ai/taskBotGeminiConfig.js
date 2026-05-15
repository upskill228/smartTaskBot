/* Configuração do TaskBot para integração com a Gemini.

Este módulo define:
- system prompt base do agente
- tools (function calling) disponíveis
- configuração base reutilizável do TaskBot

Objetivo:
Isolar toda a configuração específica do agente de tarefas
da camada genérica de comunicação com a AI.

Diferença de responsabilidades:
- callGemini.js → comunicação com SDK da Gemini
- taskBotGeminiConfig.js → comportamento do agente
- tools.js → ações executáveis no sistema
*/

import { createSystemPrompt } from '../../utils/createSystemPrompt.js';
import {
  createTaskTool,
  updateTaskTool,
  deleteTaskTool,
  filterTasksTool,
} from './tools.js';

// Temperaturas definidas para comportamento do modelo:
//
// - TOOLS: ligeiramente mais flexível para interpretação de intenções
// - REPLY: mais determinístico para respostas finais consistentes
export const TASKBOT_TOOLS_TEMPERATURE = 0.2;
export const TASKBOT_REPLY_TEMPERATURE = 0.1;

// Constrói configuração base do TaskBot.
//
// Injeta o system prompt que define o comportamento do agente
// e permite extensão via config externo.
export function buildTaskBotConfig(config = {}) {
  return {
    systemInstruction: createSystemPrompt(), // systemInstruction tem prioridade base do agente
    ...config, // config pode sobrescrever parâmetros adicionais da Gemini
  };
}

// Função para injetar a configuração de tools de tarefas no modelo, mantendo o código organizado e modular.
export function getTaskToolsConfig() {
  return {
    tools: [
      {
        functionDeclarations: [
          createTaskTool,
          updateTaskTool,
          deleteTaskTool,
          filterTasksTool,
        ],
      },
    ],
  };
}