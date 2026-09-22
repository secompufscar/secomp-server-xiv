import categoriesRepository from "../repositories/categoriesRepository";
import activitiesRepository from "../repositories/activitiesRepository";
import { CreateCategoryrDTOS, UpdateCategoryrDTOS } from "../dtos/categoriesDtos";
import { ApiError, ErrorsCode } from "../utils/api-errors";

export default {
  async findById(id: string) {
    const category = await categoriesRepository.findById(id);

    if (!category) {
      throw new ApiError("category was not found by this id", ErrorsCode.NOT_FOUND);
    }

    return category;
  },

  async list() {
    const categories = await categoriesRepository.list();
    return categories;
  },

  async create({ nome, requiresEnrollment }: CreateCategoryrDTOS) {
    const category = await categoriesRepository.create({
      nome,
      requiresEnrollment,
    });
    return category;
  },

  async update(id: string, data: UpdateCategoryrDTOS) {
    const previousCategory = await categoriesRepository.findById(id);

    if (!previousCategory) {
      throw new ApiError("Category was not found by this id", ErrorsCode.NOT_FOUND);
    }
    const updatedCategory = await categoriesRepository.update(id, data);
    return updatedCategory;
  },

  async delete(id: string) {
    const existingActivities = await activitiesRepository.findManyByCategoryId(id);

    if (!existingActivities) {
      throw new ApiError("Esta categoria não pode ser excluida porque ainda há atividades nela", ErrorsCode.CONFLICT);
    }

    const deletedCategory = await categoriesRepository.delete(id);
    return deletedCategory;
  },
};
