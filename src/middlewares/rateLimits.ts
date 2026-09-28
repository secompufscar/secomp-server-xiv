import { rateLimit } from "express-rate-limit";
import { Request, Response } from "express";
import { httpConfig } from "../config/http";

function handler(request: Request, response: Response) {
  return response.status(429).json({
    message: "Muitas tentativas. Aguarde antes de tentar novamente.",
    errorCode: "RATE_LIMIT_EXCEEDED",
    errors: [],
    requestId: request.requestId,
  });
}

export const authenticationRateLimit = rateLimit({
  windowMs: httpConfig.authRateLimitWindowMs,
  limit: httpConfig.authRateLimitMax,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler,
});

export const accountRateLimit = rateLimit({
  windowMs: httpConfig.accountRateLimitWindowMs,
  limit: httpConfig.accountRateLimitMax,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler,
});
