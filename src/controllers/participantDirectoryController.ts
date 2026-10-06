import { Request, Response } from "express";
import { z } from "zod";
import { listParticipantDirectory } from "../repositories/participantDirectoryRepository";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  q: z.string().trim().max(120).default(""),
  credentialed: z.enum(["all", "yes", "no"]).default("all"),
});

export async function participantDirectory(req: Request, res: Response) {
  const query = querySchema.safeParse(req.query);
  if (!query.success) return res.status(400).json({ message: "Filtros de participantes inválidos", statusCode: 400 });
  return res.status(200).json(await listParticipantDirectory(query.data));
}
