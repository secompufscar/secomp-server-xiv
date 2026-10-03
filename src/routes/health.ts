import { Router } from "express";
import { prisma } from "../lib/prisma";
import { withDatabaseConnectionRetry } from "../lib/databaseConnection";

export function createHealthRoutes(checkDatabase = () => withDatabaseConnectionRetry("database-health", () => prisma.$queryRaw`SELECT 1`)) {
  const routes = Router();

  routes.get("/live", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  routes.get("/ready", async (_request, response) => {
    try {
      await checkDatabase();
      response.status(200).json({ status: "ready" });
    } catch {
      response.status(503).json({ status: "unavailable" });
    }
  });

  return routes;
}

export default createHealthRoutes();
