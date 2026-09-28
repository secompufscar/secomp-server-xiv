import { Router } from "express";
import appVersionController from "../controllers/appVersionController";

const routes = Router();

/**
 * @swagger
 * /app/version:
 *   get:
 *     summary: Consulta a compatibilidade da versão do aplicativo.
 *     tags:
 *       - App
 *     parameters:
 *       - in: query
 *         name: platform
 *         required: true
 *         schema:
 *           type: string
 *           enum: [android, ios, web]
 *       - in: query
 *         name: currentVersion
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Política de versão da plataforma.
 */
routes.get("/version", appVersionController.getVersion);

export default routes;
