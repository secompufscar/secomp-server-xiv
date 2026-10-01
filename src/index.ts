import "dotenv/config";
import { validateSecuritySecrets } from "./config/securitySecrets";

// Reject unsafe configuration before loading services, listening or scheduling work.
validateSecuritySecrets();

import "express-async-errors";
import express from "express";
import cors from "cors";
import errorHandler from "./middlewares/errorHandler";
import routes from "./routes";
import path from "path";
import { setupSwagger } from "./swagger";
import schedulerService from "./services/schedulerService";
import helmet from "helmet";
import requestId from "./middlewares/requestId";
import { corsOptions, httpConfig } from "./config/http";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", httpConfig.trustProxyHops);

// Set up view engine (EJS)
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Middleware
app.use(requestId);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: httpConfig.bodyLimit }));
app.use(express.urlencoded({ extended: false, limit: httpConfig.bodyLimit }));

// API Routes
app.use("/api/v1", routes);

// Swagger Documentation
setupSwagger(app);

// Rota para confirmação de e-mail
app.get("/email-confirmado", (req, res) => {
  const { erro } = req.query;

  if (erro === "usuario-nao-reconhecido") {
    return res.render("confirmationError", { motivo: "Usuário não reconhecido" });
  }
  if (erro === "erro-interno") {
    return res.render("confirmationError", { motivo: "Erro interno" });
  }

  return res.render("confirmationSuccess", { emailChanged: req.query.alteracao === "email" });
});

// Catch-all route for API root
app.get("/*", (_, response) => response.status(200).json({ message: "API SECOMP UFSCar XIV" }));

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
const MODE = process.env.NODE_ENV;
app.listen(PORT, () => {
  console.log(`> Servidor rodando na porta ${PORT}. Modo: ${MODE}`);
  void schedulerService.scheduleAllActivityNotifications().catch(() => {
    console.error("[Scheduler] initial-scheduling-failed");
  });
});
