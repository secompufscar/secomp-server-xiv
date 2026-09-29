import { NextFunction, Request, Response } from "express";
import { getAppVersionResponse } from "../config/appVersion";

export default function appVersionMiddleware(request: Request, response: Response, next: NextFunction) {
  if (request.path === "/app/version") return next();
  if (process.env.APP_VERSION_ENFORCEMENT_ENABLED !== "true") return next();

  const platformHeader = request.header("x-app-platform")?.toLowerCase();
  // Legacy clients and browser links cannot declare a native app version.
  // This policy is an update hint, never an authentication boundary.
  if (platformHeader !== "android" && platformHeader !== "ios") return next();

  if (request.method === "GET" && /^\/users\/confirmation\/[^/]+\/?$/i.test(request.path)) return next();
  if (request.method === "POST" && /^\/users\/sendForgotPasswordEmail\/?$/i.test(request.path)) return next();
  if (request.method === "PATCH" && /^\/users\/updatePassword\/[^/]+\/?$/i.test(request.path)) return next();

  const platform = platformHeader;
  const currentVersion = request.header("x-app-version")?.trim();
  const versionResponse = getAppVersionResponse(platform, currentVersion);

  if (versionResponse.updateRequired) {
    return response.status(426).json({
      code: "APP_UPDATE_REQUIRED",
      ...versionResponse,
    });
  }

  next();
}
