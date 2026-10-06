import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { ApiError, ErrorsCode } from "../utils/api-errors";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
export const isCredentialingCategory = (category: { nome: string; slug: string }) => {
  const slug = normalize(category.slug);
  return slug === "credenciamento" || slug.startsWith("credenciamento-") || normalize(category.nome) === "credenciamento";
};

export interface DirectoryQuery { page: number; q: string; credentialed: "all" | "yes" | "no" }

export async function listParticipantDirectory({ page, q, credentialed }: DirectoryQuery) {
  return prisma.$transaction(async tx => {
    const events = await tx.event.findMany({ where: { isCurrent: true }, select: { id: true, year: true } });
    if (events.length !== 1) throw new ApiError("Não há uma única edição atual para consultar o credenciamento.", ErrorsCode.CONFLICT);
    const event = events[0];
    const activities = await tx.activity.findMany({ where: { eventId: event.id }, select: { id: true, nome: true, categoria: { select: { nome: true, slug: true } } } });
    const matches = activities.filter(activity => isCredentialingCategory(activity.categoria));
    if (matches.length !== 1) throw new ApiError("Não há uma única atividade de credenciamento na edição atual.", ErrorsCode.CONFLICT);
    const activityId = matches[0].id;
    const presence = { activityId, presente: true };
    const search: Prisma.UserWhereInput = q ? { OR: [{ nome: { contains: q } }, { email: { contains: q } }] } : {};
    const where: Prisma.UserWhereInput = {
      ...search,
      ...(credentialed === "all" ? {} : { userAtActivity: credentialed === "yes" ? { some: presence } : { none: presence } }),
    };
    const total = await tx.user.count({ where });
    const credentialedCount = await tx.user.count({ where: { ...search, userAtActivity: { some: presence } } });
    const notCredentialedCount = await tx.user.count({ where: { ...search, userAtActivity: { none: presence } } });
    const pageSize = 50;
    const actualPage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
    const users = await tx.user.findMany({
      where, orderBy: [{ nome: "asc" }, { id: "asc" }], skip: (actualPage - 1) * pageSize, take: pageSize,
      select: { id: true, nome: true, email: true, userAtActivity: { where: presence, select: { checkedInAt: true }, take: 1 } },
    });
    return {
      event: { id: event.id, year: event.year }, activityId, page: actualPage, pageSize, total, credentialedCount, notCredentialedCount,
      users: users.map(user => ({ id: user.id, nome: user.nome, email: user.email,
        credentialed: user.userAtActivity.length > 0, credentialedAt: user.userAtActivity[0]?.checkedInAt ?? null,
      })),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
