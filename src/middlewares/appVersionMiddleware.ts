import { NextFunction, Request, Response } from "express";
import { getAppVersionResponse, isAppPlatform } from "../config/appVersion";

export default function appVersionMiddleware(request: Request, response: Response, next: NextFunction) {
  if (request.path === "/app/version") return next();
  if (process.env.APP_VERSION_ENFORCEMENT_ENABLED !== "true") return next();

  const platformHeader = request.header("x-app-platform")?.toLowerCase();
  if (platformHeader === "web") return next();

  const platform = isAppPlatform(platformHeader) ? platformHeader : "android";
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
