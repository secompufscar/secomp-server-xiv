import { Router } from "express";
import { authMiddleware, isAdmin } from "../middlewares/authMiddleware";
import usersController from "../controllers/usersController";

const routes = Router();

/**
 * @swagger
 * /signup:
 *   post:
 *     summary: User signup
 *     description: Register a new user.
 *     requestBody:
 *       description: User signup details
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 example: user123
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user123@example.com
 *               senha:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: User registered successfully
 *       400:
 *         description: Bad request
 */
routes.post("/signup", usersController.signup);

/**
 * @swagger
 * /login:
 *   post:
 *     summary: User login
 *     description: Authenticate a user and return a token.
 *     requestBody:
 *       description: User login details
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user123@example.com
 *               senha:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: User logged in successfully
 *       401:
 *         description: Unauthorized
 */
routes.post("/login", usersController.login);

/**
 * @swagger
 * /me:
 *   get:
 *     summary: Retorna o usuário autenticado
 *     description: Obtém as informações do usuário atualmente autenticado com base no token JWT enviado no header de autorização.
 *     security:
 *       - bearerAuth: []
 *     tags:
 *       - Users
 *     responses:
 *       200:
 *         description: Usuário autenticado retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "uuid-usuario-123"
 *                 nome:
 *                   type: string
 *                   example: "Fulano da Silva"
 *                 email:
 *                   type: string
 *                   example: "fulano@example.com"
 *                 tipo:
 *                   type: string
 *                   example: "USER"
 *                 confirmed:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Não autorizado (token ausente ou inválido)
 */
routes.get("/me", authMiddleware, usersController.getAuthenticatedUser);

/**
 * @swagger
 * /getProfile:
 *   get:
 *     summary: Get user profile
 *     description: Retrieve the profile of the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: 1
 *                 nome:
 *                   type: string
 *                   example: user123
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: user123@example.com
 *       401:
 *         description: Unauthorized
 */
routes.get("/getProfile", authMiddleware, usersController.getProfile);

/**
 * @swagger
 * /confirmation/{token}:
 *   get:
 *     summary: Confirmação de email
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         description: Token de confirmação de email para um determinado usuario.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuário com email confirmado corretamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 nome:
 *                   type: string
 *                 email:
 *                   type: string
 *                 tipo:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                 confirmed:
 *                   type: boolean
 *       500:
 *         description: Internal server error
 */
routes.get("/confirmation/:token", usersController.confirmEmail);

/**
 * @swagger
 * /updatePassword/{token}:
 *   patch:
 *     summary: Altera a senha de um usuário.
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         description: Token de reset de senha
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               senha:
 *                 type: string
 *                 example: "novaSenha123"
 *     responses:
 *       200:
 *         description: Usuário com senha alterada corretamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 nome:
 *                   type: string
 *                 email:
 *                   type: string
 *                 tipo:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                 confirmed:
 *                   type: boolean
 *       500:
 *         description: Internal server error
 */
routes.patch("/updatePassword/:token", usersController.updateForgottenPassword);

/**
 * @swagger
 * /sendForgotPasswordEmail:
 *   post:
 *     summary: Envia um email para um usuário que esqueceu sua senha.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "usuario@example.com"
 *     responses:
 *       200:
 *         description: Email de alteração de senha enviado
 *       500:
 *         description: Internal server error
 */
routes.post("/sendForgotPasswordEmail", usersController.sendForgotPasswordEmail);

/**
 * @swagger
 * /getUserPoints/{id}:
 *   get:
 *     summary: Retorna os pontos de um usuário
 *     description: Retorna a quantidade total de pontos do usuário com base no ID fornecido.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Pontos do usuário recuperados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pontos:
 *                   type: integer
 *                   example: 1200
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
routes.get("/getUserPoints/:id", authMiddleware, usersController.getUserPoints);

/**
 * @swagger
 * /getUserRanking/{id}:
 *   get:
 *     summary: Retorna o ranking de um usuário
 *     description: Retorna informações de ranking do usuário com base no ID fornecido.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Ranking do usuário recuperado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ranking:
 *                   type: integer
 *                   example: 5
 *                 pontos:
 *                   type: integer
 *                   example: 1200
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
routes.get("/getUserRanking/:id", authMiddleware, usersController.getUserRanking);

/**
 * @swagger
 * /ranking/top50:
 *   get:
 *     summary: Retorna o Top 50 do ranking
 *     description: Retorna os 50 melhores usuários do ranking da SECOMP, incluindo a posição de cada usuário (rank), pontuação, ID e nome.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Top 50 usuários recuperados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "uuid-do-usuario-123"
 *                       nome:
 *                         type: string
 *                         example: "Fulano de Tal"
 *                       points:
 *                         type: number
 *                         example: 150
 *                       rank:
 *                         type: integer
 *                         example: 1
 *       401:
 *         description: Usuário não autenticado
 *       500:
 *         description: Erro interno do servidor
 */
routes.get("/top50", authMiddleware, usersController.getTop50Ranking);

/**
 * @swagger
 * /updateProfile:
 *   patch:
 *     summary: Update user profile
 *     description: Update the authenticated user's name and/or email.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: User data to update. Both fields are optional.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 example: "Novo Nome do Usuario"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "novoemail@example.com"
 *     responses:
 *       '200':
 *         description: Profile updated successfully
 *       '400':
 *         description: Bad request (e.g., invalid email format, email already in use)
 *       '401':
 *         description: Unauthorized (invalid or missing token)
 */
routes.patch("/updateProfile", authMiddleware, usersController.updateProfile);

/**
 * @swagger
 * /users/{id}/activities/count:
 *   get:
 *     summary: Retorna a quantidade de atividades de um usuário
 *     description: Retorna a quantidade total de atividades em que um usuário específico está inscrito.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID do usuário
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       '200':
 *         description: Contagem de atividades recuperada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalActivities:
 *                   type: integer
 *                   example: 5
 *       '404':
 *         description: Usuário não encontrado
 *       '500':
 *         description: Erro interno do servidor
 */
routes.get("/:id/activities/count", authMiddleware, usersController.getUserActivitiesCount);

/**
 * @swagger
 * /users/details/{id}:
 *   get:
 *     summary: Retorna informações detalhadas de um usuário (Admin apenas)
 *     description: Obtém os detalhes de um usuário específico pelo ID. Requer autenticação e permissão de ADMIN.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID do usuário
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       '200':
 *         description: Informações do usuário recuperadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "some-uuid-123"
 *                 nome:
 *                   type: string
 *                   example: "Fulano de Tal"
 *                 email:
 *                   type: string
 *                   example: "fulano@example.com"
 *                 tipo:
 *                   type: string
 *                   example: "USUARIO"
 *                 confirmed:
 *                   type: boolean
 *                   example: true
 *                 points:
 *                   type: number
 *                   example: 150
 *       '401':
 *         description: Não autorizado (token inválido ou ausente)
 *       '403':
 *         description: Proibido (usuário não tem permissão de ADMIN)
 *       '404':
 *         description: Usuário não encontrado
 *       '500':
 *         description: Erro interno do servidor
 */
routes.get("/:id", authMiddleware, isAdmin, usersController.getUserDetails);

/**
 * @swagger
 * /registerPushToken:
 *   post:
 *     summary: Registra um token de push para notificações.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *               token:
 *                 type: object
 *                 properties:
 *                   token:
 *                     type: string
 *                     example: "exemploTokenPush123"
 *     responses:
 *       200:
 *         description: Token de push adicionado com sucesso
 *       400:
 *         description: Bad request
 */
routes.post("/registerPushToken", authMiddleware, usersController.registerPushToken);

export default routes;
