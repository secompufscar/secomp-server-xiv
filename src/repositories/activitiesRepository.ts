import { prisma } from "../lib/prisma"; 
import { UpdateActivityDTOS, CreateActivityDTOS, ActivityDTOS } from "../dtos/activitiesDtos";
import { lockEditionState } from "./editionState";
import { ApiError, ErrorsCode } from "../utils/api-errors";
import type { Prisma } from "@prisma/client";
import { assertCertificationAllowed, DEFAULT_DURATION_SOURCE } from "../services/activityCertification";
import { isCredentialingCategory } from "./participantDirectoryRepository";

async function hasCertificateReference(tx: Prisma.TransactionClient, id: string) {
  // MySQL JSON_CONTAINS matches an object's id within snapshot.activities, including revoked revisions.
  return !!await tx.certificate.findFirst({
    where: { snapshot: { path: "$.activities", array_contains: [{ id }] } }, select: { id: true },
  });
}

export default {
  async list(): Promise<ActivityDTOS[]> {
    const response = await prisma.activity.findMany({ include: { categoria: true } });
    return response;
  },

  async findById(id: string): Promise<ActivityDTOS | null> {
    const response = await prisma.activity.findUnique({
      where: { id },
      include: { categoria: true },
    });
    return response;
  },

  async findManyByCategoryId(categoriaId: string): Promise<ActivityDTOS[]> {
    const response = await prisma.activity.findMany({
      where: { categoriaId },
      include: { categoria: true },
    });
    return response;
  },

  async create(data: CreateActivityDTOS): Promise<ActivityDTOS> { 
    return prisma.$transaction(async tx => {
      await lockEditionState(tx);
      const categoria = await tx.category.findUnique({ where: { id: data.categoriaId } });
      if (!categoria) throw new ApiError("Categoria não encontrada", ErrorsCode.NOT_FOUND);
      assertCertificationAllowed({ ...data, categoria });
      return tx.activity.create({ data });
    });
  },

  async update(id: string, data: UpdateActivityDTOS): Promise<ActivityDTOS> {
    return prisma.$transaction(async tx => {
      await lockEditionState(tx);
      const rows = await tx.$queryRaw<Array<{ vagas: number | null }>>`
        SELECT vagas FROM atividades WHERE id = ${id} FOR UPDATE`;
      if (!rows.length) throw new ApiError("Atividade não encontrada", ErrorsCode.NOT_FOUND);
      const existing = await tx.activity.findUniqueOrThrow({ where: { id }, include: { categoria: true } });
      const categoria = data.categoriaId !== undefined && data.categoriaId !== existing.categoriaId
        ? await tx.category.findUnique({ where: { id: data.categoriaId } }) : existing.categoria;
      if (!categoria) throw new ApiError("Categoria não encontrada", ErrorsCode.NOT_FOUND);
      if (data.eventId !== undefined && data.eventId !== existing.eventId) {
        const enrollment = await tx.userAtActivity.findFirst({ where: { activityId: id }, select: { id: true } });
        const credentialHistory = isCredentialingCategory(existing.categoria) && existing.eventId
          && await tx.certificate.findFirst({ where: { eventId: existing.eventId }, select: { id: true } });
        if (enrollment || credentialHistory || await hasCertificateReference(tx, id)) {
          throw new ApiError("Não é possível mudar a edição de uma atividade com inscrições, presenças ou certificados históricos.", ErrorsCode.CONFLICT);
        }
      }
      if (isCredentialingCategory(categoria) !== isCredentialingCategory(existing.categoria)) {
        const presence = await tx.userAtActivity.findFirst({ where: { activityId: id, presente: true }, select: { id: true } });
        const certificate = existing.eventId && await tx.certificate.findFirst({ where: { eventId: existing.eventId }, select: { id: true } });
        if (presence || certificate) {
          throw new ApiError("Não é possível alterar a categoria de credenciamento com presenças ou certificados nesta edição.", ErrorsCode.CONFLICT);
        }
      }
      const certificationChanged = data.durationMinutes !== undefined;
      const merged = { ...existing, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)), categoria };
      // Metadata-only edits of legacy rows keep their configuration intact.
      if (certificationChanged || (data.nome !== undefined && data.nome !== existing.nome) || categoria.id !== existing.categoriaId) {
        assertCertificationAllowed(merged);
      }
      if (certificationChanged && data.durationSource === undefined) data = { ...data, durationSource: DEFAULT_DURATION_SOURCE };
      const updated = await tx.activity.update({ data, where: { id } });
      if (data.vagas !== undefined && data.vagas !== null && data.vagas !== rows[0].vagas) {
        const enrollments = await tx.userAtActivity.findMany({
          where: { activityId: id },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true, presente: true, listaEspera: true },
        });
        const presentCount = enrollments.filter(row => row.presente).length;
        if (data.vagas < presentCount) {
          throw new ApiError(`Não é possível reduzir abaixo de ${presentCount} pessoas com presença registrada.`, ErrorsCode.CONFLICT);
        }
        const confirmed = enrollments.filter(row => !row.listaEspera && !row.presente);
        const confirmedLimit = data.vagas - presentCount;
        const excess = confirmed.slice(confirmedLimit);
        if (excess.length) {
          await tx.userAtActivity.updateMany({
            where: { id: { in: excess.map(row => row.id) } },
            data: { listaEspera: true },
          });
        }
        const available = Math.max(0, confirmedLimit - confirmed.length);
        const promoted = enrollments.filter(row => row.listaEspera && !row.presente).slice(0, available);
        if (promoted.length) {
          await tx.userAtActivity.updateMany({
            where: { id: { in: promoted.map(row => row.id) } },
            data: { listaEspera: false, inscricaoPrevia: true },
          });
        }
      }
      return updated;
    });
  },

  async delete(id: string): Promise<void> {
    await prisma.$transaction(async (transaction) => {
      await lockEditionState(transaction);
      // Match check-in/cancellation lock order before touching attendance rows.
      const rows = await transaction.$queryRaw<Array<{ id: string }>>`SELECT id FROM atividades WHERE id = ${id} FOR UPDATE`;
      if (!rows.length) throw new ApiError("Atividade não encontrada", ErrorsCode.NOT_FOUND);
      const presence = await transaction.userAtActivity.findFirst({ where: { activityId: id, presente: true }, select: { id: true } });
      const activity = await transaction.activity.findUniqueOrThrow({ where: { id }, include: { categoria: true } });
      const credentialHistory = isCredentialingCategory(activity.categoria) && activity.eventId
        && await transaction.certificate.findFirst({ where: { eventId: activity.eventId }, select: { id: true } });
      if (presence || credentialHistory || await hasCertificateReference(transaction, id)) {
        throw new ApiError("Esta atividade possui presenças ou certificados históricos e não pode ser excluída.", ErrorsCode.CONFLICT);
      }
      await transaction.userAtActivity.deleteMany({ where: { activityId: id } });
      await transaction.activity.delete({ where: { id } });
    });
  },
};
