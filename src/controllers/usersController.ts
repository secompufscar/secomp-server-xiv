import { Request, Response } from "express";
import usersService from "../services/usersService";
import { UpdateProfileDTO } from "../dtos/usersDtos";

export default {
  async login(request: Request, response: Response) {
    const supportsRefresh = Boolean(request.header("x-app-version"));
    const data = await usersService.login(request.body, supportsRefresh);
    response.status(200).json(data);
  },

  async refresh(request: Request, response: Response) {
    const data = await usersService.refreshSession(request.body?.refreshToken);
    response.status(200).json(data);
  },

  async logout(request: Request, response: Response) {
    await usersService.logout(request.body?.refreshToken);
    response.status(204).send();
  },

  async signup(request: Request, response: Response) {
    const data = await usersService.signup(request.body);

    response.status(200).json(data);
  },

  async getProfile(request: Request, response: Response) {
    return response.json(request.user);
  },

  async getAuthenticatedUser(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      const user = await usersService.getUserById(userId);

      return res.json(user);
    } catch (error) {
      console.error("Erro em getProfile:", error);
      return res.status(500).json({ message: "Erro interno no servidor" });
    }
  },

  async confirmEmail(request: Request, response: Response) {
    try {
      const data = await usersService.confirmUser(request.params.token);

      if (data) {
        return response.redirect("/email-confirmado");
      } else {
        return response.redirect("/email-confirmado?erro=usuario-nao-reconhecido");
      }
    } catch {
      return response.redirect("/email-confirmado?erro=erro-interno");
    }
  },

  async sendForgotPasswordEmail(request: Request, response: Response) {
    try {
      const { email } = request.body;
      await usersService.sendForgotPasswordEmail(email);
      response.status(200).json({ message: "Email enviado com sucesso" });
    } catch (error) {
      response.status(500).json({ message: "Erro ao enviar email" });
    }
  },

  async updateForgottenPassword(request: Request, response: Response) {
    try {
      const { token } = request.params; 
      const { senha } = request.body; 

      const data = await usersService.updatePassword(token, senha);
      return response.status(200).json(data);
    } catch (error) {
      response.status(500).json({ message: "Erro ao atualizar senha" });
    }
  },

  async getUserRanking(request: Request, response: Response) {
    try {
      const ranking = await usersService.getUserRanking(request.params.id);
      response.status(200).json({ rank: ranking });
    } catch (error) {
      console.error("Erro usersController.ts: " + error);
      response.status(500).json({ message: "Erro ao consultar ranking do usuario" });
    }
  },

  async getTop50Ranking(request: Request, response: Response) {
    try {
      const topUsers = await usersService.getTop50Ranking();

      return response.status(200).json({
        success: true,
        data: topUsers,
      });
    } catch (error) {
      console.error("Erro usersRankingController.ts - getTop50Ranking:", error);
      return response.status(500).json({
        success: false,
        message: "Erro ao obter o ranking dos usuários",
      });
    }
  },

  async getUserPoints(request: Request, response: Response) {
    try {
      const data = await usersService.getUserScore(request.params.id);
      response.status(200).json(data);
    } catch (error) {
      console.error("Erro usersController.ts - getUserPoints: " + error);
      response.status(500).json({ message: "Erro ao obter pontuação do usuário" });
    }
  },

  async updateProfile(request: Request, response: Response) {
    const userId = request.user.id;

    const updateData: UpdateProfileDTO = request.body;

    if (!userId) {
      return response.status(401).json({ message: "Usuário não autenticado corretamente." });
    }

    const updatedUser = await usersService.updateProfile(userId, updateData);

    return response.status(200).json(updatedUser);
  },

  async getUserActivitiesCount(request: Request, response: Response) {
    const { id } = request.params;
    const count = await usersService.countUserActivities(id);

    return response.status(200).json({ totalActivities: count });
  },

  async getUserDetails(request: Request, response: Response) {
        const userId = request.params.id;
        const userDetails = await usersService.getUserDetails(userId);
        
        response.status(200).json(userDetails);
  },

  async registerPushToken(req: Request, res: Response) {
    try {
      const user = req.user as { id: string };
      const userId = user?.id;
      const { token } = req.body;

      if (!userId || typeof userId !== 'string') {
        return res.status(401).json({
            success: false,
            message: 'Usuário não autenticado ou ID inválido',
        });
      }

      if (!token || typeof token !== 'string') {
        return res.status(400).json({
            success: false,
            message: 'Token inválido ou ausente',
        });
      }

      const result = await usersService.addPushToken(userId, token);

      return res.status(200).json({
        success: true,
        message: 'Token de push registrado com sucesso',
        user: result.user,
      });
    } catch (error) {
      console.error('Erro ao registrar token de push:', error);
      return res.status(500).json({
        success: false,
        message: 'Erro interno ao registrar o token de push',
      });
    }
  }
};
