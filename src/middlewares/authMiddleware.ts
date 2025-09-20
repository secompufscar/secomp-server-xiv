import { Request, Response, NextFunction } from "express";
import { UnauthorizedUserError } from "../utils/exceptions";
import { User } from "../entities/User";
import { JWT_SECRET } from "../secrets";
import * as jwt from "jsonwebtoken";
import { ApiError, ErrorsCode } from "../utils/api-errors";
import userRepository from "../repositories/usersRepository"; // Importa o repositório

type jwtPayload = {
  userId: string;
};

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const { authorization } = req.headers;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw new ApiError("Token não informado", ErrorsCode.UNAUTHORIZED);
    }

    const token = authorization.split(" ")[1];
    const { userId } = jwt.verify(token, JWT_SECRET) as jwtPayload;

    // Usa o repositório para buscar o usuário.
    const user = await userRepository.findById(userId);

    if (!user) {
      // Adicionado um check para caso o usuário não exista mais
      throw new ApiError("Usuário não encontrado", ErrorsCode.UNAUTHORIZED);
    }

    if (!user.confirmed) {
      throw new ApiError("Confirme o seu email para acessar", ErrorsCode.UNAUTHORIZED);
    }

    const { senha: _, ...loggedUser } = user;
    req.user = loggedUser;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: "Token expirado", statusCode: 401 });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Token inválido", statusCode: 401 });
    }

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({ message: error.message, statusCode: error.statusCode });
    }

    console.error("Erro em acesso:", error);
    return res.status(500).json({ message: "Erro interno no servidor", statusCode: 500 });
  }
}

export async function isAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as Omit<User, 'senha'>; 

  if (user && user.tipo && user.tipo.toUpperCase() === 'ADMIN') { 
    next(); 
  } else {
    return res.status(403).json({ message: "Acesso negado: Somente administradores podem acessar este recurso." });
  }
}
