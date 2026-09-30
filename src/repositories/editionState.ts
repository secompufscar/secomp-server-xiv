import { Prisma } from "@prisma/client";
import { ApiError, ErrorsCode } from "../utils/api-errors";

export const publicEventSelect = {
  id: true, year: true, startDate: true, endDate: true, isCurrent: true, createdAt: true,
} as const;
export function eventResponse<T extends { registrationsClosed?: boolean }>(event: T) {
  const { registrationsClosed: _internal, ...response } = event;
  return response;
}
// Always acquire this before user/activity/registration locks; never upgrade a shared lock.
export async function lockEditionState(tx: Prisma.TransactionClient, exclusive = false) {
  const rows = exclusive
    ? await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM editionStateLock WHERE id = 1 FOR UPDATE`
    : await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM editionStateLock WHERE id = 1 LOCK IN SHARE MODE`;
  if (rows.length !== 1) throw new ApiError("Controle de edição indisponível", ErrorsCode.INTERNAL_ERROR);
}
export async function requireEdition(tx: Prisma.TransactionClient, eventId: string) {
  const event = await tx.event.findUnique({ where: { id: eventId } });
  if (!event) throw new ApiError("Evento não encontrado", ErrorsCode.NOT_FOUND);
  return event;
}
export async function syncRegistrationProfile(tx: Prisma.TransactionClient, userId: string, eventId: string, status: number | null) {
  const event = await requireEdition(tx, eventId);
  if (!event.isCurrent) return;
  await tx.user.update({ where: { id: userId }, data: {
    registrationStatus: status ?? 0,
    currentEdition: status === null ? null : event.year.toString(),
  } });
}
// Only with the exclusive barrier, during an explicit current-edition transition.
export async function projectCurrentEdition(tx: Prisma.TransactionClient, eventId: string) {
  const event = await requireEdition(tx, eventId);
  await tx.user.updateMany({ data: { registrationStatus: 0, currentEdition: null } });
  await tx.$executeRaw`
    UPDATE users AS u JOIN userEvent AS r ON r.userId = u.id AND r.eventId = ${eventId}
    SET u.registrationStatus = r.status, u.currentEdition = ${event.year.toString()}`;
}
