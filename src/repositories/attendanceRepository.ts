import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError, ErrorsCode } from "../utils/api-errors";
import { lockEditionState, requireEdition } from "./editionState";

export function attendanceResponse<T extends { creditedPoints?: number | null }>(row: T) {
  const { creditedPoints: _internal, ...response } = row;
  return response;
}
export async function lockAttendanceUser(tx: Prisma.TransactionClient, userId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
  if (!rows.length) throw new ApiError("Usuário não encontrado", ErrorsCode.NOT_FOUND);
}
async function lockActivity(tx: Prisma.TransactionClient, activityId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM atividades WHERE id = ${activityId} FOR UPDATE`;
  if (!rows.length) throw new ApiError("Atividade não encontrada", ErrorsCode.NOT_FOUND);
  return tx.activity.findUniqueOrThrow({ where: { id: activityId }, include: { categoria: true } });
}
export async function assertActivityEligibility(tx: Prisma.TransactionClient, userId: string, eventId: string | null) {
  // Legacy undated/unlinked activities retain the current-event fallback.
  const edition = eventId ?? (await tx.event.findFirst({ where: { isCurrent: true } }))?.id;
  if (!edition) throw new ApiError("Nenhum evento ativo no momento", ErrorsCode.CONFLICT);
  if ((await requireEdition(tx, edition)).registrationsClosed) throw new ApiError("Inscrições desta edição estão encerradas", ErrorsCode.CONFLICT);
  const rows = await tx.$queryRaw<Array<{ status: number }>>`
    SELECT status FROM userEvent WHERE userId = ${userId} AND eventId = ${edition} FOR UPDATE`;
  if (rows[0]?.status !== 1) throw new ApiError("Usuário não esta inscrito neste evento!", ErrorsCode.BAD_REQUEST);
}
async function adjustPoints(tx: Prisma.TransactionClient, userId: string, delta: number) {
  if (!delta) return;
  const changed = await tx.user.updateMany({ where: { id: userId, ...(delta < 0 ? { points: { gte: -delta } } : {}) }, data: { points: { increment: delta } } });
  if (changed.count !== 1) throw new ApiError("Saldo de pontos inconsistente; solicite revisão administrativa", ErrorsCode.CONFLICT);
}

export default {
  async checkIn(userId: string, activityId: string) {
    return prisma.$transaction(async tx => {
      await lockEditionState(tx);
      await lockAttendanceUser(tx, userId);
      const activity = await lockActivity(tx, activityId);
      await assertActivityEligibility(tx, userId, activity.eventId);
      const row = await tx.userAtActivity.findUnique({ where: { userId_activityId: { userId, activityId } } });
      if (row?.presente) throw new ApiError("Este usuário já realizou o check-in nesta atividade", ErrorsCode.CONFLICT);
      if (activity.categoria.requiresEnrollment && !row) throw new ApiError("Usuário não está cadastrado na atividade", ErrorsCode.BAD_REQUEST);
      if (row?.listaEspera) throw new ApiError("Usuário está na lista de espera e não pode realizar o check-in", ErrorsCode.FORBIDDEN);
      const creditedPoints = Math.max(0, activity.points);
      const checkedInAt = new Date();
      const result = row
        ? await tx.userAtActivity.update({ where: { id: row.id }, data: { presente: true, creditedPoints, checkedInAt } })
        : await tx.userAtActivity.create({ data: { userId, activityId, presente: true, inscricaoPrevia: false, listaEspera: false, creditedPoints, checkedInAt } });
      await adjustPoints(tx, userId, creditedPoints);
      return attendanceResponse(result);
    });
  },
  async update(id: string, data: { presente?: boolean; inscricaoPrevia?: boolean; listaEspera?: boolean }) {
    const hint = await prisma.userAtActivity.findUnique({ where: { id }, select: { userId: true, activityId: true } });
    if (!hint) throw new ApiError("Registro não encontrado", ErrorsCode.NOT_FOUND);
    return prisma.$transaction(async tx => {
      await lockEditionState(tx);
      await lockAttendanceUser(tx, hint.userId);
      const activity = await lockActivity(tx, hint.activityId);
      const row = await tx.userAtActivity.findUnique({ where: { id } });
      if (!row) throw new ApiError("Registro não encontrado", ErrorsCode.NOT_FOUND);
      const present = data.presente ?? row.presente;
      const waiting = data.listaEspera ?? row.listaEspera;
      if (present && waiting) throw new ApiError("Presença não pode estar na lista de espera", ErrorsCode.CONFLICT);
      let creditedPoints = row.creditedPoints;
      let delta = 0;
      if (present !== row.presente) {
        if (present) {
          await assertActivityEligibility(tx, row.userId, activity.eventId);
          if (waiting) throw new ApiError("Usuário está na lista de espera", ErrorsCode.FORBIDDEN);
          creditedPoints = Math.max(0, activity.points);
          delta = creditedPoints;
        } else {
          // For an unknown legacy grant, preserve the former cancellation valuation.
          delta = -(row.creditedPoints ?? Math.max(0, activity.points));
          creditedPoints = 0;
        }
      }
      const result = await tx.userAtActivity.update({ where: { id }, data: { presente: present, listaEspera: waiting, inscricaoPrevia: data.inscricaoPrevia ?? row.inscricaoPrevia, creditedPoints,
        ...(present !== row.presente ? { checkedInAt: present ? new Date() : null } : {}),
      } });
      await adjustPoints(tx, row.userId, delta);
      return attendanceResponse(result);
    });
  },
  async remove(userId: string, activityId: string) {
    return prisma.$transaction(async tx => {
      await lockEditionState(tx);
      await lockAttendanceUser(tx, userId);
      const activity = await lockActivity(tx, activityId);
      const row = await tx.userAtActivity.findUnique({ where: { userId_activityId: { userId, activityId } } });
      if (!row) throw new ApiError("Registro não encontrado", ErrorsCode.NOT_FOUND);
      if (row.presente) await adjustPoints(tx, userId, -(row.creditedPoints ?? Math.max(0, activity.points)));
      await tx.userAtActivity.delete({ where: { id: row.id } });
      if (activity.vagas !== null) {
        const occupied = await tx.userAtActivity.count({ where: { activityId, listaEspera: false } });
        if (occupied < activity.vagas) {
          const next = await tx.userAtActivity.findFirst({ where: { activityId, listaEspera: true, presente: false }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
          if (next) await tx.userAtActivity.update({ where: { id: next.id }, data: { listaEspera: false, inscricaoPrevia: true, presente: false, creditedPoints: 0 } });
        }
      }
      return attendanceResponse(row);
    });
  },
  async presentSummary(activityId: string) {
    return prisma.$transaction(async tx => {
      if (!await tx.activity.findUnique({ where: { id: activityId }, select: { id: true } })) throw new ApiError("Atividade não encontrada", ErrorsCode.NOT_FOUND);
      const rows = await tx.userAtActivity.findMany({ where: { activityId, presente: true }, select: { user: { select: { id: true, nome: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
      return { totalPresentes: rows.length, presentes: rows.map(row => ({ userId: row.user.id, nome: row.user.nome })) };
    });
  },
};
