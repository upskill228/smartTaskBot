/* Validações base da camada de infraestrutura AI.

Estas validações garantem que:
- a configuração mínima da Gemini existe
- os parâmetros recebidos têm o formato esperado
- erros de configuração são detetados o mais cedo possível

A abordagem fail-fast evita chamadas inválidas à API
e simplifica o debugging durante desenvolvimento.
*/


// Valida configuração genérica das chamadas à Gemini.
//
// Verifica:
// - existência da API key
// - integridade do objeto config
//
// Impede que a infraestrutura AI execute com estado inválido.
export function validateBaseConfig(config) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY não definida no .env');
    }

    if (config === null || typeof config !== 'object' || Array.isArray(config)) {
        throw new Error('Config inválida para a chamada à AI');
    }
}

// Valida o formato do array contents utilizado pela Gemini.
//
// A API espera um histórico conversacional estruturado.
// Esta validação garante que existe pelo menos uma mensagem válida
// antes da chamada ao provider.
export function validateContents(contents) {
    if (!Array.isArray(contents) || contents.length === 0) {
        throw new Error('Contents inválido para a chamada à AI');
    }
}