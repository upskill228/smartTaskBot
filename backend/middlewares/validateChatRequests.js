/* Este middleware valida o input antes de chegar à lógica principal da aplicação. Ele garante que as mensagens de chat recebidas tenham o formato esperado, evitando que dados inválidos sejam processados pelos controllers e services.
*/

/* Extrai a mensagem enviada pelo frontend e verifica:
- se existe (!message)
- se é uma string (typeof message !== 'string')
- se não é apenas espaços em branco (!message.trim())

Se alguma dessas condições for verdadeira, cria um erro de validação usando createValidationError() e passa para o próximo middleware (que é o middleware global de tratamento de erros) para enviar uma resposta de erro padronizada para o cliente.
*/
import { createValidationError } from '../utils/validationHelpers.js';

export function validateChatMessage(req, res, next) {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return next(createValidationError('O campo "message" é obrigatório e deve ser uma string.'));
  }

  next();
}

// Faz-se esta validação do input ANTES da chamada à AI para evitar requests desnecessárias.

// Nota: No futuro posso actualizar para uma biblioteca schema-based como Zod mas por agora deixo esta validação simples e direta, já que o payload é muito simples (apenas uma mensagem de texto).