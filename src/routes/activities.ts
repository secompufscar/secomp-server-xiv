import { Router } from "express";
import activitiesController from "../controllers/activitiesController";
import { createActivitySchema, activityIdSchema, updateActivitySchema } from "../schemas/activitySchema";
import { authMiddleware } from "../middlewares/authMiddleware";
import validate from "../middlewares/validate";
import { adminMiddleware } from "../middlewares/adminMiddleware";

const routes = Router();

/**
 * @swagger
 * /activities:
 *   get:
 *     summary: Obtém uma lista de todas as atividades.
 *     tags:
 *       - Activities
 *     responses:
 *       200:
 *         description: Lista de atividades retornada com sucesso.
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
 *                   data:
 *                     type: string
 *                     format: date-time
 *                   vagas:
 *                     type: integer
 *                   detalhes:
 *                     type: string
 *                   palestranteNome:
 *                     type: string
 *                   categoriaId:
 *                     type: string
 *                   eventId:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 */
//routes.get('/', authMiddleware, activitiesController.list);
routes.get("/", activitiesController.list);

/**
 * @swagger
 * /activities/{id}:
 *   get:
 *     summary: Obtém uma atividade específica pelo ID.
 *     tags:
 *       - Activities
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID da atividade que deseja obter.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Atividade retornada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 nome:
 *                   type: string
 *                 data:
 *                   type: string
 *                   format: date-time
 *                 vagas:
 *                   type: integer
 *                 detalhes:
 *                   type: string
 *                 palestranteNome:
 *                   type: string
 *                 categoriaId:
 *                   type: string
 *                 eventId:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Atividade não encontrada.
 */
routes.get("/:id", activitiesController.findById);

/**
 * @swagger
 * /activities:
 *   post:
 *     summary: Cria uma nova atividade.
 *     tags:
 *       - Activities
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               data:
 *                 type: string
 *                 format: date-time
 *               vagas:
 *                 type: integer
 *               detalhes:
 *                 type: string
 *               palestranteNome:
 *                 type: string
 *               categoriaId:
 *                 type: string
 *               eventId:
 *                 type: string
 *                 description: Edição do evento; usa a edição atual quando omitido.
 *     responses:
 *       201:
 *         description: Atividade criada com sucesso.
 */
//routes.post('/', authMiddleware, validate(createActivitySchema), activitiesController.create);
routes.post("/", authMiddleware, adminMiddleware, activitiesController.create);

/**
 * @swagger
 * /activities/{id}:
 *   put:
 *     summary: Atualiza uma atividade existente pelo ID.
 *     tags:
 *       - Activities
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID da atividade que deseja atualizar.
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
 *               data:
 *                 type: string
 *                 format: date-time
 *               vagas:
 *                 type: integer
 *               detalhes:
 *                 type: string
 *               palestranteNome:
 *                 type: string
 *               categoriaId:
 *                 type: string
 *               eventId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Atividade atualizada com sucesso.
 *       404:
 *         description: Atividade não encontrada.
 */
routes.put("/:id", validate(updateActivitySchema, activityIdSchema), authMiddleware, adminMiddleware, activitiesController.update);

/**
 * @swagger
 * /activities/{id}:
 *   delete:
 *     summary: Deleta uma atividade pelo ID.
 *     tags:
 *       - Activities
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID da atividade que deseja deletar.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Atividade deletada com sucesso.
 *       404:
 *         description: Atividade não encontrada.
 */
routes.delete("/:id", authMiddleware, validate(undefined, activityIdSchema), adminMiddleware, activitiesController.delete);

export default routes;
