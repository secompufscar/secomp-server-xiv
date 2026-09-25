import { prisma } from "../lib/prisma";
import { CreateCategoryrDTOS, UpdateCategoryrDTOS, CategoryrDTOS } from "../dtos/categoriesDtos";

export default {
  async list(): Promise<CategoryrDTOS[]> {
    const response = await prisma.category.findMany();
    return response;
  },

  async findById(id: string): Promise<CategoryrDTOS | null> {
    const response = await prisma.category.findUnique({
      where: { id },
    });
    return response;
  },

  async create(data: CreateCategoryrDTOS & { slug: string }): Promise<CategoryrDTOS> {
    const response = await prisma.category.create({ data });
    return response;
  },

  async update(id: string, data: UpdateCategoryrDTOS): Promise<UpdateCategoryrDTOS> {
    const response = await prisma.category.update({
      where: { id },
      data,
    });
    return response;
  },

  async delete(id: string): Promise<void> {
    await prisma.category.delete({
      where: { id },
    });
  },
};
