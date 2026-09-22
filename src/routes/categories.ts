import { Router } from "express";
import categoriesController from "../controllers/categoriesController";
import { createCategorySchema, updateCategorySchema, categoryParamsSchema } from "../schemas/categorySchema";
import { authMiddleware } from "../middlewares/authMiddleware";
import validate from "../middlewares/validate";
import { adminMiddleware } from "../middlewares/adminMiddleware";

const routes = Router();

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Obtém uma lista de todas as categorias.
 *     tags:
 *       - Categories
 *     responses:
 *       200:
 *         description: Lista de categorias retornada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   nome:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 */
//routes.get('/', authMiddleware, categoriesController.list);
routes.get("/", categoriesController.list);

/**
 * @swagger
 * /categories/{id}:
 *   get:
 *     summary: Obtém uma categoria específica pelo ID.
 *     tags:
 *       - Categories
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID da categoria que deseja obter.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Categoria retornada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 nome:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Categoria não encontrada.
 */
//routes.get('/:id', authMiddleware, validate(undefined, categoryIdSchema), categoriesController.findById);
routes.get("/:id", categoriesController.findById);

/**
 * @swagger
 * /categories:
 *   post:
 *     summary: Cria uma nova categoria.
 *     tags:
 *       - Categories
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               requiresEnrollment:
 *                 type: boolean
 *                 description: Exige inscrição prévia para realizar check-in.
 *                 default: false
 *     responses:
 *       201:
 *         description: Categoria criada com sucesso.
 */
//routes.post('/', authMiddleware, validate(createCategorySchema), categoriesController.create);
routes.post("/", authMiddleware, adminMiddleware, validate(createCategorySchema), categoriesController.create);

/**
 * @swagger
 * /categories/{id}:
 *   put:
 *     summary: Atualiza uma categoria existente pelo ID.
 *     tags:
 *       - Categories
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID da categoria que deseja atualizar.
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               requiresEnrollment:
 *                 type: boolean
 *                 description: Exige inscrição prévia para realizar check-in.
 *     responses:
 *       200:
 *         description: Categoria atualizada com sucesso.
 *       404:
 *         description: Categoria não encontrada.
 */
routes.put("/:id", authMiddleware, adminMiddleware, validate(updateCategorySchema, categoryParamsSchema), categoriesController.update);

/**
 * @swagger
 * /categories/{id}:
 *   delete:
 *     summary: Deleta uma categoria pelo ID.
 *     tags:
 *       - Categories
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID da categoria que deseja deletar.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Categoria deletada com sucesso.
 *       404:
 *         description: Categoria não encontrada.
 */
routes.delete("/:id", authMiddleware, adminMiddleware, validate(undefined, categoryParamsSchema), categoriesController.delete);

export default routes;
