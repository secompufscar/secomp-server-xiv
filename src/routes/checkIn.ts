import { Router } from "express";
import { authMiddleware, isAdmin } from "../middlewares/authMiddleware";
import checkInController from "../controllers/checkInController";

const router = Router();

/**
 * @swagger
 * /check-in/{userId}/{activityId}:
 *   post:
 *     summary: Realiza o check-in de um usuário em uma atividade.
 *     tags:
 *       - Check-In
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: ID do usuário que está fazendo o check-in.
 *         schema:
 *           type: string
 *       - in: path
 *         name: activityId
 *         required: true
 *         description: ID da atividade em que o usuário está fazendo check-in.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Check-in realizado com sucesso.
 *       404:
 *         description: Usuário ou atividade não encontrados.
 *       400:
 *         description: Solicitação inválida, como check-in já realizado ou atividade inexistente.
 *       403:
 *         description: Operação restrita a administradores.
 */
router.post("/:userId/:activityId", authMiddleware, isAdmin, checkInController.checkIn);

/**
 * @swagger
 * /check-in/participants/{activityId}:
 *   get:
 *     summary: Lista todos os participantes de uma atividade.
 *     tags:
 *       - Check-In
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: activityId
 *         required: true
 *         description: ID da atividade para listar os participantes.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de participantes retornada com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   userId:
 *                     type: string
 *                   activityId:
 *                     type: string
 *       404:
 *         description: Atividade não encontrada ou sem participantes.
 *       403:
 *         description: Operação restrita a administradores.
 */
router.get("/participants/:activityId", authMiddleware, isAdmin, checkInController.listParticipants);

export default router;
