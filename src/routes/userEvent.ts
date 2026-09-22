import { Router } from "express";
import { authMiddleware, isAdmin } from "../middlewares/authMiddleware";
import userEventController from "../controllers/userEventController";

const routes = Router();

/**
 * @swagger
 * /userEvent/event/{eventId}:
 *   get:
 *     tags: [UserEvents]
 *     summary: Lista inscrições de um evento (somente administradores)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de inscrições com identidade mínima (id e nome)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserEventDTO'
 *       401:
 *         description: Token ausente ou inválido
 *       403:
 *         description: Requer administrador
 */
routes.get("/event/:eventId", authMiddleware, isAdmin, userEventController.findByEventId);

/**
 * @swagger
 * /userEvent/user/{userId}:
 *   get:
 *     tags: [UserEvents]
 *     summary: Lista eventos de um usuário
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de inscrições do usuário
 *       401:
 *         description: Não autorizado
 */
routes.get("/user/:userId", authMiddleware, userEventController.findByUserId);

/**
 * @swagger
 * /userEvent/user/{userId}/event/{eventId}:
 *   get:
 *     tags: [UserEvents]
 *     summary: Busca inscrição de um usuário em um evento específico
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: eventId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Inscrição encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserEventDTO'
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Inscrição não encontrada
 */
routes.get("/user/:userId/event/:eventId", authMiddleware, userEventController.findByUserIdEventId);

/**
 * @swagger
 * /userEvent:
 *   post:
 *     tags: [UserEvents]
 *     summary: Inscreve usuário no evento atual
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Inscrição realizada
 *       400:
 *         description: Usuário já está inscrito
 *       401:
 *         description: Não autorizado
 */
routes.post("/", authMiddleware, userEventController.create);

/**
 * @swagger
 * /userEvent/{id}:
 *   delete:
 *     tags: [UserEvents]
 *     summary: Remove inscrição de usuário
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Inscrição removida
 *       404:
 *         description: Inscrição não encontrada
 *       401:
 *         description: Não autorizado
 */
routes.delete("/:id", authMiddleware, userEventController.delete);

export default routes;
