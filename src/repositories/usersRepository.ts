import { RankingUserResponse } from "../dtos/userResponses";
import { prisma } from "../lib/prisma";
import { User as PrismaUser, Prisma } from "@prisma/client";
import { User, RegistrationStatus } from "../entities/User";
import { CreateUserDTOS, UpdateQrCodeUsersDTOS, UpdateUserDTOS } from "../dtos/usersDtos";

function toUserEntity(prismaUser: PrismaUser): User {
  return {
    ...prismaUser,
    registrationStatus: prismaUser.registrationStatus as RegistrationStatus,
  };
}

export default {
  async list(): Promise<User[]> {
    const response = await prisma.user.findMany();
    return response.map(toUserEntity);
  },

  async findById(id: string): Promise<User | null> {
    const response = await prisma.user.findUnique({ where: { id } });
    return response ? toUserEntity(response) : null;
  },

  async findManyByIds(ids: string[]): Promise<User[]> {
    const response = await prisma.user.findMany({ where: { id: { in: ids } } });
    return response.map(toUserEntity);
  },

  async setRegistrationStatusForAllEligibleUsers(newStatus: number): Promise<void> {
    await prisma.user.updateMany({
      where: { registrationStatus: { not: newStatus } },
      data: { registrationStatus: newStatus },
    });
  },

  async updateUserEventStatus(userId: string, registrationStatusInput: number, currentEdition: number): Promise<User> {
    const response = await prisma.user.update({
      where: { id: userId },
      data: {
        registrationStatus: registrationStatusInput,
        currentEdition: currentEdition.toString(),
      },
    });
    return toUserEntity(response);
  },

  async setRegistrationStatusForUsers(userIds: string[], newStatus: number): Promise<void> {
    if (userIds.length === 0) {
      return;
    }
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { registrationStatus: newStatus },
    });
  },

  async findByEmail(email: string): Promise<User | null> {
    const response = await prisma.user.findUnique({ where: { email } });
    return response ? toUserEntity(response) : null;
  },

  async create(data: CreateUserDTOS): Promise<User> {
    const response = await prisma.user.create({ data });
    return toUserEntity(response);
  },

  async update(id: string, data: UpdateUserDTOS): Promise<User> {
    const response = await prisma.user.update({ where: { id }, data });
    return toUserEntity(response);
  },

  async delete(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } });
  },

  async updateQRCode(id: string, data: UpdateQrCodeUsersDTOS): Promise<User> {
    const response = await prisma.user.update({ where: { id }, data });
    return toUserEntity(response);
  },

  async addPoints(userId: string, points: number): Promise<User> {
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { points: { increment: points } },
      });
      return toUserEntity(updatedUser);
    } catch (error) {
      throw new Error(`Falha ao adicionar pontos para o usuário ${userId}`);
    }
  },

  async removePoints(userId: string, points: number): Promise<User> {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user) {
        throw new Error(`Usuário ${userId} não encontrado`);
      }

      if (user.points < points) {
        throw new Error(`Usuário ${userId} não possui pontos suficientes`);
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { points: { decrement: points } },
      });

      return toUserEntity(updatedUser);
    } catch (error) {
      throw new Error(
        `Falha ao remover pontos do usuário ${userId}: ${(error as Error).message}`,
      );
    }
  },

  async getUserPoints(id: string): Promise<{ points: number } | null> {
    return prisma.user.findUnique({
      where: { id },
      select: { points: true },
    });
  },

  async getUserRanking(id: string): Promise<number> {
    const result = await prisma.$queryRaw<{ rank: number }[]>(
      Prisma.sql`
              SELECT COUNT(*) + 1 AS \`rank\`
              FROM (
                SELECT
                  u.id,
                  u.points,
                  COUNT(CASE WHEN ua.presente = 1 THEN 1 END) AS presences,
                  u.createdAt
                FROM \`users\` u
                LEFT JOIN \`userAtActivity\` ua ON ua.userId = u.id
                GROUP BY u.id, u.points, u.createdAt
              ) AS other_users
              WHERE (
                other_users.points > (
                  SELECT points FROM \`users\` WHERE id = ${id}
                )
                OR (
                  other_users.points = (
                    SELECT points FROM \`users\` WHERE id = ${id}
                  ) AND other_users.presences > (
                    SELECT COUNT(*) FROM \`userAtActivity\`
                    WHERE userId = ${id} AND presente = 1
                  )
                )
                OR (
                  other_users.points = (
                    SELECT points FROM \`users\` WHERE id = ${id}
                  ) AND other_users.presences = (
                    SELECT COUNT(*) FROM \`userAtActivity\`
                    WHERE userId = ${id} AND presente = 1
                  ) AND other_users.createdAt < (
                    SELECT createdAt FROM \`users\` WHERE id = ${id}
                  )
                )
              );
            `,
    );

    if (result.length === 0) {
      throw new Error("Não foi possivel recuperar o ranking");
    }
    return Number(result[0].rank);
  },

  async getTop50RankingUsers(): Promise<RankingUserResponse[]> {
    const result = await prisma.$queryRaw<{ id: string; nome: string; points: number; ranking: bigint }[]>(Prisma.sql`
      SELECT
        sub.id, sub.nome, sub.points,
        ROW_NUMBER() OVER (
          ORDER BY sub.points DESC, sub.presences DESC, sub.createdAt ASC
        ) AS ranking
      FROM (
        SELECT 
          u.id, u.nome, u.points, u.createdAt,
          COUNT(CASE WHEN ua.presente = 1 THEN 1 END) AS presences
        FROM users u
        LEFT JOIN userAtActivity ua ON ua.userId = u.id
        GROUP BY u.id, u.nome, u.points, u.createdAt
      ) AS sub
      ORDER BY ranking
      LIMIT 50;
    `);

    return result.map(user => ({
      id: user.id,
      nome: user.nome,
      points: Number(user.points),
      rank: Number(user.ranking),
    }));
  },

  async findAll(): Promise<User[]> {
    const response = await prisma.user.findMany();
    return response.map(toUserEntity);
  },
};
