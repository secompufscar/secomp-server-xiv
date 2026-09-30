import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { createHmac, randomBytes } from "node:crypto";
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

type LimitConfig = Pick<typeof httpConfig,
  "authRateLimitWindowMs" | "authRateLimitMax" | "authNetworkRateLimitMax" |
  "accountRateLimitWindowMs" | "accountRateLimitMax" | "accountNetworkRateLimitMax">;

// One ephemeral key per factory/process; raw emails/tokens never become identity store keys.
export function createRateLimitPolicies(config: LimitConfig = httpConfig) {
  const secret = randomBytes(32);
  const digest = (parts: string[]) => createHmac("sha256", secret).update(JSON.stringify(parts)).digest("hex");
  const network = (request: Request) => ipKeyGenerator(request.ip ?? request.socket.remoteAddress ?? "unknown");
  const email = (request: Request) => typeof request.body?.email === "string"
    ? request.body.email.trim().toLowerCase() : "";
  const common = { standardHeaders: "draft-8" as const, legacyHeaders: false, handler };

  function policy(name: string, identity: (request: Request) => string, authentication: boolean) {
    const windowMs = authentication ? config.authRateLimitWindowMs : config.accountRateLimitWindowMs;
    const skipSuccessfulRequests = authentication;
    const networkLimit = rateLimit({
      ...common, windowMs, skipSuccessfulRequests, identifier: `${name}-network`,
      limit: authentication ? config.authNetworkRateLimitMax : config.accountNetworkRateLimitMax,
      // Library's default key generator handles IPv4 and IPv6 subnets.
    });
    const identityLimit = rateLimit({
      ...common, windowMs, skipSuccessfulRequests, identifier: `${name}-identity`,
      limit: authentication ? config.authRateLimitMax : config.accountRateLimitMax,
      keyGenerator: request => {
        const value = identity(request);
        // Login guesses are scoped to network + account, avoiding a global account lockout.
        // Recovery/signup protect the target email even across different networks.
        return digest([name, authentication || !value ? network(request) : "", value]);
      },
    });
    // Separate instances/stores for every operation and each layer.
    return [networkLimit, identityLimit] as const;
  }

  return {
    signupRateLimit: policy("signup", email, false),
    recoveryRateLimit: policy("recovery", email, false),
    loginRateLimit: policy("login", email, true),
    refreshRateLimit: policy("refresh", request => typeof request.body?.refreshToken === "string" ? request.body.refreshToken : "", true),
    passwordResetRateLimit: policy("password-reset", request => typeof request.params.token === "string" ? request.params.token : "", true),
  };
}

export const { signupRateLimit, recoveryRateLimit, loginRateLimit, refreshRateLimit, passwordResetRateLimit } = createRateLimitPolicies();
