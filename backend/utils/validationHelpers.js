/* ferramenta para criar erros consistentes -> segue para errorHandler.js

createValidationError -> cria erros;
errorHandler -> processa erros já existentes
*/

export function createValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400; // o cliente enviou dados inválidos
  error.code = 'VALIDATION_ERROR';
  return error;
}