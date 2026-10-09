export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado') {
    super('NOT_FOUND', message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Sem permissão') {
    super('FORBIDDEN', message, 403);
  }
}

/** A requisição é válida, mas fere uma regra de negócio (ex.: entregar aluno que não embarcou). */
export class RegraDeNegocioError extends AppError {
  constructor(message: string) {
    super('REGRA_DE_NEGOCIO', message, 422);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflito') {
    super('CONFLICT', message, 409);
  }
}
