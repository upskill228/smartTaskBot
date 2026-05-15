/* Camada de infraestrutura responsável pela comunicação com a Gemini.

Responsabilidades:
- comunicar diretamente com a API da Gemini
- validar configuração e inputs base
- executar retries e fallbacks de modelo
- normalizar extração de respostas
- devolver texto bruto ao restante sistema

Importante:
Esta camada NÃO gere histórico conversacional nem regras de negócio.

A gestão de memória/histórico pertence aos services da aplicação,
mantendo a separação entre:
- infraestrutura AI
- contexto conversacional
- lógica de negócio

Esta função não conhece tarefas, SQL ou entidades da aplicação.
Fluxo esperado:
prompt/contents -> Gemini -> texto
*/


import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';
import { formatAIError, isTransientGeminiError } from './aiErrorMapper.js';
import { logGeminiDebug } from './aiDebugLogger.js';
import { validateBaseConfig, validateContents } from './aiValidators.js';
import { buildTaskBotConfig, getTaskToolsConfig } from './taskBotGeminiConfig.js';

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash';
const FALLBACK_GEMINI_MODELS = (process.env.GEMINI_FALLBACK_MODELS || '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);

// Constrói a lista de modelos candidatos.
//
// O primeiro modelo é o principal configurado na aplicação.
// Os restantes funcionam como fallback para cenários de:
// - indisponibilidade
// - rate limit
// - falhas transitórias do provider
function buildModelCandidates(model = DEFAULT_GEMINI_MODEL) {
    return [model, ...FALLBACK_GEMINI_MODELS.filter((fallbackModel) => fallbackModel !== model)];
}

// Executa a chamada à Gemini com retry e fallback de modelos.
//
// Estratégia:
// 1. tenta o modelo principal
// 2. em erros transitórios, faz retry automático
// 3. se necessário, tenta modelos fallback
//
// Isto aumenta a resiliência da aplicação perante:
// - rate limits
// - indisponibilidade temporária
// - falhas ocasionais da API
async function generateGeminiResponseWithRetry(contents, model, config) {
    const modelCandidates = buildModelCandidates(model);
    let lastError;

    for (const currentModel of modelCandidates) {
        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                logGeminiDebug('ai-call', 'model-attempt', {
                    model: currentModel,
                    attempt: attempt + 1,
                    candidateCount: modelCandidates.length,
                    contentsCount: Array.isArray(contents) ? contents.length : 0,
                });

                const response = await generateGeminiResponse(contents, currentModel, config);

                logGeminiDebug('ai-call', 'model-success', {
                    model: currentModel,
                    attempt: attempt + 1,
                });

                return response;
            } catch (error) {
                lastError = error;
                const transient = isTransientGeminiError(error);

                logGeminiDebug('ai-call', 'model-error', {
                    model: currentModel,
                    attempt: attempt + 1,
                    transient,
                    message: error?.message || 'Erro desconhecido',
                });

                if (!transient) {
                    throw error;
                }

                if (attempt === 1) {
                    logGeminiDebug('ai-call', 'model-exhausted', {
                        model: currentModel,
                        attempts: attempt + 1,
                    });
                    break;
                }
            }
        }
    }

    throw lastError;
}

// Wrapper mínimo sobre a SDK(biblioteca @google/genai) da Gemini.
// Mantém a chamada centralizada para facilitar manutenção futura.
async function generateGeminiResponse(contents, model, config) {
    return ai.models.generateContent({
        model,
        contents,
        config,
    });
}

// Extraiu-se texto utilizável da resposta da Gemini.
//
// A Gemini pode devolver texto em estruturas diferentes
// dependendo do tipo de resposta gerada.
//
// A função tenta:
// 1. usar response.text()
// 2. fazer fallback para parts textuais da candidate response
//
// Também ignora parts internas de reasoning/thought.
function extractResponseText(response) {
    const text = response?.text?.trim();

    if (text) {
        return text;
    }

    const partsText = response?.candidates?.[0]?.content?.parts
        ?.filter((part) => typeof part.text === 'string' && !part.thought)
        .map((part) => part.text.trim())
        .filter(Boolean)
        .join('\n');

    if (!partsText) throw new Error('Resposta vazia da AI');

    return partsText;
}

// Garante defaults consistentes para todas as chamadas AI.
//
// A temperatura é normalizada para evitar comportamento
// imprevisível quando o valor não é fornecido explicitamente.
function buildFinalConfig(config = {}) {
    return {
        ...config,
        temperature:
            typeof config.temperature === 'number'
                ? config.temperature
                : 0.2,
    };
}

// ----- callGemini -----

// Chamada simples à Gemini usando apenas um prompt textual.
// Utilizada em cenários sem histórico conversacional.
export async function callGemini(
    prompt,
    model = DEFAULT_GEMINI_MODEL,
    config = {}
) {
    try {
        logGeminiDebug('ai-call', 'call-gemini-start', {
            model,
            promptLength: typeof prompt === 'string' ? prompt.length : 0,
        });

        validateBaseConfig(config);

        if (!prompt || typeof prompt !== 'string') {
            throw new Error('Prompt inválido para a chamada à AI');
        }

        const finalConfig = buildFinalConfig(config);

        const response = await generateGeminiResponseWithRetry(
            [{ role: 'user', parts: [{ text: prompt }] }],
            model,
            finalConfig
        );

        return extractResponseText(response);
    } catch (err) {
        throw new Error('Erro na chamada à AI: ' + formatAIError(err));
    }
}

// ----- callGeminiWithContents -----

// Chamada à Gemini usando contents já estruturados.
//
// Permite enviar histórico conversacional completo no formato esperado pela API da Gemini.
export async function callGeminiWithContents(
    contents,
    model = DEFAULT_GEMINI_MODEL,
    config = {}
) {
    try {
        logGeminiDebug('ai-call', 'call-gemini-with-contents-start', {
            model,
            contentsCount: Array.isArray(contents) ? contents.length : 0,
        });

        validateBaseConfig(config);
        validateContents(contents);

        const finalConfig = buildFinalConfig(config);

        const response = await generateGeminiResponseWithRetry(contents, model, finalConfig);

        return extractResponseText(response);
    } catch (err) {
        throw new Error('Erro na chamada à AI: ' + formatAIError(err));
    }
}

// Encapsula o function calling da Gemini.
//
// Centraliza:
// - tools declarations
// - system prompt
// - retries
// - configuração do modelo
//
// Evita duplicação de configuração AI nos services
// e mantém o fluxo conversacional desacoplado
// da infraestrutura da Gemini.
export async function callGeminiWithTaskToolsResponse(
    contents,
    model = DEFAULT_GEMINI_MODEL,
    config = {}
) {
    try {
        logGeminiDebug('ai-call', 'call-gemini-with-tools-start', {
            model,
            contentsCount: Array.isArray(contents) ? contents.length : 0,
        });

        validateBaseConfig(config);
        validateContents(contents);

        const finalConfig = buildFinalConfig(
            buildTaskBotConfig({
                ...getTaskToolsConfig(),
                ...config,
            })
        );

        return await generateGeminiResponseWithRetry(contents, model, finalConfig);
    } catch (err) {
        throw new Error('Erro na chamada à AI: ' + formatAIError(err));
    }
}

/* Diferença entre os modos de chamada:

callGemini:
- prompt simples
- sem histórico estruturado

callGeminiWithContents:
- conversa completa
- suporta múltiplas mensagens/contexto
*/

// ----- callGeminiStream -----

// Executa geração em streaming.
//
// Útil para:
// - respostas longas
// - streaming incremental no frontend
// - geração contínua de conteúdo
export async function callGeminiStream(
  contents,
        model = DEFAULT_GEMINI_MODEL,
  config = {}
) {
  try {
    validateBaseConfig(config);

    const finalConfig = buildFinalConfig(config);

                const stream = await ai.models.generateContentStream({
      model,
      contents,
            config: finalConfig,
    });

        return stream;
  } catch (err) {
    throw new Error('Erro no stream da AI: ' + err.message);
  }
}
