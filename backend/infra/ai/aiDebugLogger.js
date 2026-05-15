/*
Camada centralizada de debug/logging da integração Gemini.

Este ficheiro existe para:
- evitar espalhar console.log pela aplicação
- normalizar logs da AI num único formato
- permitir ativação/desativação via variáveis de ambiente
*/


// Flags independentes:
const DEBUG_LOG_ENABLED = /^(1|true|yes|on)$/i.test(process.env.GEMINI_DEBUG_LOGS || ''); // controla se existe logging
const DEBUG_LOG_JSON = /^(1|true|yes|on)$/i.test(process.env.GEMINI_DEBUG_JSON || ''); // define o formato do output

/* sanitizeValue:
- protege logs contra objetos demasiado grandes
- limita tamanho de strings e arrays
- evita outputs difíceis de ler no terminal
*/
function sanitizeValue(value) {
  if (value == null) {
    return value;
  }

  if (typeof value === 'string') {
    return value.length > 220 ? `${value.slice(0, 220)}...` : value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 10).map(sanitizeValue); //// Limita arrays para evitar flooding do terminal
  }

  if (typeof value === 'object') {
    // Recursividade permite sanitizar estruturas profundas sem assumir formatos específicos da Gemini.
    return Object.fromEntries(
      Object.entries(value).map(([key, currentValue]) => [key, sanitizeValue(currentValue)])
    );
  }

  return value;
}

/*formatDebugValue:
- cria logs formatados e legíveis para debugging manual

Optou-se por não usar apenas JSON.stringify porque:
- perde legibilidade em objetos grandes
- dificulta leitura de estruturas aninhadas
- gera linhas demasiado extensas
*/
function formatDebugValue(value, indentLevel = 0) {
  const indent = '  '.repeat(indentLevel);
  const nextIndent = '  '.repeat(indentLevel + 1);

  if (value == null) {
    return String(value);
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }

    return [
      '[',
      ...value.map((entry) => `${nextIndent}- ${formatDebugValue(entry, indentLevel + 1)}`),
      `${indent}]`,
    ].join('\n');
  }

  const entries = Object.entries(value);

  if (entries.length === 0) {
    return '{}';
  }

  return [
    '{',
    ...entries.map(([key, currentValue]) => {
      const formattedValue = formatDebugValue(currentValue, indentLevel + 1);
      const valueLines = formattedValue.split('\n');

      if (valueLines.length === 1) {
        return `${nextIndent}${key}: ${valueLines[0]}`;
      }

      return `${nextIndent}${key}: ${valueLines[0]}\n${valueLines.slice(1).join('\n')}`;
    }),
    `${indent}}`,
  ].join('\n');
}

export function isGeminiDebugLoggingEnabled() {
  return DEBUG_LOG_ENABLED;
}

export function logGeminiDebug(scope, event, details = {}) {
  if (!DEBUG_LOG_ENABLED) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    scope,
    event,
    ...sanitizeValue(details),
  };

  if (DEBUG_LOG_JSON) {
    console.log('[taskbot-debug]', JSON.stringify(payload));
    return;
  }

  const { timestamp, ...remainingPayload } = payload;
  const formattedDetails = formatDebugValue(remainingPayload, 1)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');

// Output formatado para debugging humano em ambiente local
console.log(`\n[taskbot-debug] ${timestamp}\n${formattedDetails}\n`);
}