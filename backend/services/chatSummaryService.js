/* Compressão incremental de histórico antigo para reduzir custo e limite de contexto. */

import { callGeminiWithContents } from '../infra/ai/callGemini.js';
// Limites conservadores para evitar summaries demasiado longos.
const SUMMARY_MAX_OUTPUT_TOKENS = 120;
const SUMMARY_MAX_CHARACTERS = 280;

// Prompt estável e restritivo para evitar summaries inventados ou demasiado verbosos.
const SUMMARY_SYSTEM_INSTRUCTION = `
És um sistema de compressão de contexto.

Objetivo:
- Gerar um resumo fiel e curto de uma conversa.

Regras:
- Nunca inventes informação
- Não uses markdown, listas ou títulos
- Não incluas explicações meta sobre o processo
- Responde apenas com texto simples em português europeu
- Mantém apenas informação relevante para continuidade da conversa
`;

// Compacta espaços e impõe o limite final de caracteres.
function normalizeSummaryText(summary) {
  const compact = summary.replace(/\s+/g, ' ').trim();

  if (compact.length <= SUMMARY_MAX_CHARACTERS) {
    return compact;
  }

  return `${compact.slice(0, SUMMARY_MAX_CHARACTERS - 3).trimEnd()}...`;
}

// Resume histórico antigo reutilizando o summary anterior quando ele já existe.
export async function summarizeHistory(messages, previousSummary = null) {
  const prompt = [
    // memória anterior (compressão incremental)
    ...(previousSummary
      ? [
          {
            role: 'user',
            parts: [{ text: `[RESUMO ANTERIOR] ${previousSummary}` }],
          },
        ]
      : []), // garante que o sistema funciona mesmo sem resumo anterior

    // mensagens antigas
    ...messages,

    // tarefa de compressão
    {
      role: 'user',
      parts: [
        {
          text: `
Resume a conversa com base no histórico fornecido.

Inclui apenas:
- pedidos do utilizador
- ações executadas
- estado de tarefas
- decisões relevantes

Ignora:
- saudações
- repetições
- informação irrelevante
          `.trim(),
        },
      ],
    },
  ];

  const summary = await callGeminiWithContents(prompt, undefined, {
    systemInstruction: SUMMARY_SYSTEM_INSTRUCTION,
    temperature: 0.1,
    maxOutputTokens: SUMMARY_MAX_OUTPUT_TOKENS,
  });

  return normalizeSummaryText(summary);
}