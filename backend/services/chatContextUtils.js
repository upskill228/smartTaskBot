// Helpers para montar o array `contents` enviado à Gemini.

// Injeta o resumo antes do histórico recente apenas quando ele existe.
export function buildConversationContents(history, summary, summaryLabel = '[RESUMO]') {
  if (!summary) {
    return [...history];
  }

  return [
    {
      role: 'user',
      parts: [{ text: `${summaryLabel} ${summary}` }],
    },
    ...history,
  ];
}