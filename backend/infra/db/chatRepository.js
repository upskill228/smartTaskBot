/*
  Camada de repositório de chat (Chat History Repository)

  Responsabilidade:
  - persistir mensagens do utilizador e respostas da AI
  - recuperar histórico de conversa por utilizador
  - converter dados da base de dados para formato compatível com a Gemini API

  Este ficheiro NÃO contém:
  - lógica de negócio (ex: decisões da AI)
  - prompts
  - regras de tools/function calling

  Ele funciona apenas como ponte entre:
  MySQL <-> aplicação <-> formato de chat da Gemini
*/

import { db } from './db.js';

/* Persiste uma interação completa no histórico de chat.

    Estrutura:
    - user_message: input do utilizador
    - ai_response: resposta do modelo
    - user_id: opcional (permite multi-utilizador)

    Nota:
    - userId pode ser null (modo single-user / anon)
  */
export async function saveChat({ userMessage, aiResponse, userId }) {
  const query = `
    INSERT INTO chat_history (user_message, ai_response, user_id)
    VALUES (?, ?, ?)
  `;

  const values = [userMessage, aiResponse, userId || null];

  await db.execute(query, values);
}

/* Recupera histórico de chat de um utilizador.

    Fluxo:
    1. valida limite (defensivo)
    2. faz query à BD ordenada por mais recente
    3. inverte ordem (para ficar cronológica)
    4. transforma rows em formato Gemini "contents"

    Importante:
    - Gemini espera estrutura:
      {
        role: 'user' | 'model',
        parts: [{ text: string }]
      }
  */
export async function getChatHistoryByUser(userId, limit = 10) {
  const safeLimit = Number.isInteger(Number(limit)) && Number(limit) > 0
    ? Number(limit)
    : 10;

  /* Query parametrizada para userId (evita SQL injection).

    LIMIT não é parametrizado aqui porque MySQL não permite binding direto
    em LIMIT em alguns drivers — por isso foi sanitizado acima.
  */
  const query = `
    SELECT user_message, ai_response
    FROM chat_history
    WHERE user_id = ?
    ORDER BY id DESC
    LIMIT ${safeLimit}
  `;

  const [rows] = await db.execute(query, [userId || null]);

  /* Conversão de DB rows -> formato Gemini contents

    Cada row representa 1 turno:
    - user_message → role: 'user'
    - ai_response → role: 'model'

    flatMap é usado porque:
    - cada row pode gerar 0, 1 ou 2 mensagens
    - evita arrays aninhados
  */
  return rows
    .reverse()
    .flatMap((row) => {
      const messages = [];

      // Mensagem do utilizador
      if (typeof row.user_message === 'string' && row.user_message.trim()) {
        messages.push({
          role: 'user',
          parts: [{ text: row.user_message }],
        });
      }

      // Resposta da AI
      if (typeof row.ai_response === 'string' && row.ai_response.trim()) {
        messages.push({
          role: 'model',
          parts: [{ text: row.ai_response }],
        });
      }

      return messages;
    });
}

/* Nota de arquitetura:

  Este repositório está adaptado diretamente para LLM chat format.

  Trade-off:
  + facilita integração com Gemini (zero mapping extra no service)
  - acopla DB schema ao formato da API da AI

  Se o sistema crescer:
  seria interessante introduzir um "mapper layer"
  entre DB schema e AI schema.
*/