/* Camada de abstração de erros do provider de IA. Como a Gemini pode devolver erros em formatos diferentes (JSON, strings ou mensagens não estruturadas), este ficheiro normaliza esses erros para um formato consistente interno da aplicação.

- Separa erros de infraestrutura (AI) da lógica de negócio
- Converte erros técnicos em mensagens user-friendly
- Identifica erros transitórios vs permanentes
- centralizar o tratamento de erros da Gemini

--

Parsing defensivo para extrair o máximo de informação possível dos erros da Gemini, mesmo quando o formato é inconsistente ou inesperado.
O objetivo é permitir que a aplicação reaja de forma inteligente
a diferentes tipos de falhas da AI, como:
- rate limits
- indisponibilidade temporária
- configuração inválida do modelo

A função tenta primeiro interpretar o erro como JSON estruturado.
Caso falhe, aplica fallback parsing baseado no conteúdo da mensagem.
*/
function extractProviderErrorInfo(error) {
    const message = error?.message || '';

    try {
        const parsed = JSON.parse(message);
        const providerError = parsed?.error || {};

        return {
            code: providerError.code,
            status: providerError.status,
            message: providerError.message || message,
        };
    } catch {
        return {
            code: message.includes('429') ? 429 : message.includes('503') ? 503 : message.includes('404') ? 404 : null,
            status: message.includes('RESOURCE_EXHAUSTED')
                ? 'RESOURCE_EXHAUSTED'
                : message.includes('UNAVAILABLE')
                    ? 'UNAVAILABLE'
                    : message.includes('NOT_FOUND')
                        ? 'NOT_FOUND'
                        : null,
            message,
        };
    }
}

// Lógica de retry inteligente baseada no tipo de erro retornado pela Gemini. Erros de limite de taxa (429) e indisponibilidade temporária (503) são considerados transitórios e podem ser tratados com uma estratégia de retry exponencial, enquanto erros de recurso não encontrado (404) indicam um problema de configuração que deve ser corrigido pelo desenvolvedor.
export function isTransientGeminiError(error) {
    const providerError = extractProviderErrorInfo(error);

    return providerError.code === 429 || providerError.code === 503 || providerError.status === 'RESOURCE_EXHAUSTED' || providerError.status === 'UNAVAILABLE';
}

// UX Final - Converte erros técnicos da Gemini em mensagens amigáveis para o usuário final, evitando jargões técnicos e fornecendo orientações claras sobre o que aconteceu e o que o usuário pode fazer (como tentar novamente mais tarde ou verificar a configuração do modelo).
export function formatAIError(error) {
    const providerError = extractProviderErrorInfo(error);

    if (providerError.code === 429 || providerError.status === 'RESOURCE_EXHAUSTED') {
        return 'A IA atingiu o limite temporário de pedidos. Tenta novamente daqui a pouco.';
    }

    if (providerError.code === 503 || providerError.status === 'UNAVAILABLE') {
        return 'A Gemini está temporariamente indisponível. Tenta novamente dentro de instantes.';
    }

    if (providerError.code === 404 || providerError.status === 'NOT_FOUND') {
        return 'O modelo Gemini configurado não está disponível nesta conta ou nesta versão da API. Verifica a variável GEMINI_MODEL.';
    }

    return providerError.message || 'Erro desconhecido na chamada à AI';
}