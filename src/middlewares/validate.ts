import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

const validate = (bodySchema?: ZodSchema<any>, pathSchema?: ZodSchema<any>) => (req: Request, res: Response, next: NextFunction) => {
  try {
    // Valida o corpo da solicitação se o esquema do corpo estiver presente
    if (bodySchema) {
      req.body = bodySchema.parse(req.body);
    }

    // Valida os parâmetros de caminho se o esquema de caminho estiver presente
    if (pathSchema) {
      req.params = pathSchema.parse(req.params);
    }

    // Avança para o próximo middleware se a validação for bem-sucedida
    next();
  } catch (error) {
    next(error);
  }
};

export default validate;
