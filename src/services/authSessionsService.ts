import { createHash, randomBytes } from "crypto";
import * as jwt from "jsonwebtoken";
import { auth } from "../config/auth";
import refreshSessionsRepository from "../repositories/refreshSessionsRepository";
import usersRepository from "../repositories/usersRepository";
import { ApiError, ErrorsCode } from "../utils/api-errors";
import { matchesAuthVersion } from "../utils/authVersion";

const refreshTtlDays = Math.max(1, Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30);

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function newRefreshToken() {
  return randomBytes(48).toString("base64url");
}

function expirationDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + refreshTtlDays);
  return date;
}

export function createAccessToken(userId: string, lifetime?: jwt.SignOptions["expiresIn"], authVersion = 0) {
  const expiresIn = lifetime ?? (process.env.ACCESS_TOKEN_EXPIRES_IN || "15m") as jwt.SignOptions["expiresIn"];
  return jwt.sign({ userId, authVersion }, auth.secret_token, { expiresIn });
}

export async function createSession(userId: string, authVersion = 0) {
  const refreshToken = newRefreshToken();
  await refreshSessionsRepository.create(userId, hashToken(refreshToken), expirationDate(), authVersion);
  return { token: createAccessToken(userId, undefined, authVersion), refreshToken };
}

export async function rotateSession(refreshToken: string) {
  if (typeof refreshToken !== "string" || !refreshToken) {
    throw new ApiError("Refresh token não informado", ErrorsCode.UNAUTHORIZED);
  }

  const session = await refreshSessionsRepository.findByHash(hashToken(refreshToken));
  if (!session) throw new ApiError("Sessão inválida", ErrorsCode.UNAUTHORIZED);
  const user = await usersRepository.findById(session.userId);
  if (!user || !user.confirmed) {
    await refreshSessionsRepository.revokeAllForUser(session.userId, session.authVersion ?? 0);
    throw new ApiError("Usuário não autorizado", ErrorsCode.UNAUTHORIZED);
  }
  if (!matchesAuthVersion(session.authVersion, user.authVersion ?? 0)) {
    throw new ApiError("Dados de acesso alterados; faça login novamente", ErrorsCode.UNAUTHORIZED);
  }
  if (session.revokedAt) {
    await refreshSessionsRepository.revokeAllForUser(session.userId, session.authVersion ?? 0);
    throw new ApiError("Sessão reutilizada; faça login novamente", ErrorsCode.UNAUTHORIZED);
  }
  if (session.expiresAt <= new Date()) {
    await refreshSessionsRepository.revoke(session.id);
    throw new ApiError("Sessão expirada", ErrorsCode.UNAUTHORIZED);
  }

  const replacement = newRefreshToken();
  const rotated = await refreshSessionsRepository.rotate(
    session.id,
    session.userId,
    hashToken(replacement),
    expirationDate(),
    user.authVersion ?? 0,
  );
  if (!rotated) throw new ApiError("Sessão já renovada", ErrorsCode.UNAUTHORIZED);

  return { token: createAccessToken(session.userId, undefined, user.authVersion ?? 0), refreshToken: replacement };
}

export async function revokeSession(refreshToken: string) {
  if (typeof refreshToken !== "string" || !refreshToken) return;
  const session = await refreshSessionsRepository.findByHash(hashToken(refreshToken));
  if (session) await refreshSessionsRepository.revoke(session.id);
}
