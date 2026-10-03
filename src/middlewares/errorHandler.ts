import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { ApiError } from "../utils/api-errors";
import { databaseErrorCode, isDatabaseUnavailable, safeErrorType } from "../lib/databaseConnection";

const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Erro de validação",
      errorCode: "VALIDATION_ERROR",
      errors: err.errors.map((issue) => ({ code: issue.code, path: issue.path, message: issue.message })),
      requestId: req.requestId,
    });
  }

  if (err instanceof multer.MulterError) {
    const tooLarge = err.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({
      message: tooLarge ? "A imagem excede o tamanho permitido" : "Arquivo de imagem inválido",
      errorCode: err.code,
      errors: [],
      requestId: req.requestId,
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      message: err.message,
      errorCode: "API_ERROR",
      errors: [],
      requestId: req.requestId,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const conflict = err.code === "P2002" || err.code === "P2003";
    const notFound = err.code === "P2025";
    if (conflict || notFound) {
      return res.status(conflict ? 409 : 404).json({
        message: conflict ? "O recurso conflita com dados existentes" : "Recurso não encontrado",
        errorCode: err.code,
        errors: [],
        requestId: req.requestId,
      });
    }
  }

  const errorStatus = typeof err === "object" && err !== null && "status" in err ? err.status : undefined;
  const errorType = typeof err === "object" && err !== null && "type" in err ? err.type : undefined;
  const invalidJson = errorStatus === 400 && errorType === "entity.parse.failed";
  const tooLarge = errorStatus === 413;
  const databaseUnavailable = isDatabaseUnavailable(err);
  const statusCode = invalidJson ? 400 : tooLarge ? 413 : databaseUnavailable ? 503 : 500;
  const errorCode = invalidJson ? "INVALID_JSON" : tooLarge ? "PAYLOAD_TOO_LARGE" : databaseUnavailable ? "DATABASE_UNAVAILABLE" : "INTERNAL_SERVER_ERROR";
  console.error(JSON.stringify({
    requestId: req.requestId,
    method: req.method,
    // The route template excludes path parameters, query strings and provider payloads.
    route: typeof req.route?.path === "string" ? req.route.path : "unmatched",
    errorCode,
    errorType: safeErrorType(err),
    databaseCode: databaseErrorCode(err),
  }));

  if (databaseUnavailable) res.setHeader("Retry-After", "1");

  return res.status(statusCode).json({
    message: invalidJson ? "JSON inválido" : tooLarge ? "Corpo da requisição excede o tamanho permitido" : databaseUnavailable ? "Serviço temporariamente indisponível. Tente novamente em instantes." : "Erro interno do servidor",
    errorCode,
    errors: [],
    requestId: req.requestId,
  });
};

export default errorHandler;
