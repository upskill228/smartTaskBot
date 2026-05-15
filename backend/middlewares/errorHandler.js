/* O tratamento de erros é centralizado no middleware global para evitar repetição de lógica nos controllers, garantindo que todas as respostas de erro tenham um formato consistente e informativo.

Os controllers apenas definem códigos de erro específicos para cada tipo de erro esperado, e o middleware global garante que esses códigos sejam incluídos nas respostas de erro.
*/

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      message: 'Rota não encontrada',
      code: 'NOT_FOUND',
    },
  });
}

export function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_SERVER_ERROR'; // código de erro genérico para erros inesperados sem código específico ;
  // não apaga os códigos personalizados definidos nos controllers, apenas fornece um fallback com um código de erro genérico para erros inesperados sem código específico

  res.status(statusCode).json({
    success: false,
    error: {
      message: error.message || 'Erro interno do servidor',
      code,
    },
  });
}