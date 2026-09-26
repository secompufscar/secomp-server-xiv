import { Prisma } from "@prisma/client";
import { User } from "../entities/User";

// Shared identities must never contain credentials, contact details or QR codes.
export const userIdentitySelect = { id: true, nome: true } satisfies Prisma.UserSelect;

export interface RankingUserResponse {
  id: string;
  nome: string;
  points: number;
  rank: number;
}

export function adminUserResponse(user: Partial<User>) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    tipo: user.tipo,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    confirmed: user.confirmed,
    registrationStatus: user.registrationStatus,
    currentEdition: user.currentEdition,
    points: user.points,
  };
}

// Only the authenticated owner's profile includes their check-in QR code.
export function profileResponse(user: Partial<User>) {
  return { ...adminUserResponse(user), qrCode: user.qrCode };
}
