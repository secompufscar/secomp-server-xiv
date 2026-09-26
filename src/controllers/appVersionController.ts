import { Request, Response } from "express";
import { ApiError, ErrorsCode } from "../utils/api-errors";
import { getAppVersionResponse, isAppPlatform } from "../config/appVersion";

export default {
  getVersion(request: Request, response: Response) {
    const platformValue = String(request.query.platform ?? request.header("x-app-platform") ?? "").toLowerCase();
    if (!isAppPlatform(platformValue)) {
      throw new ApiError("Plataforma inválida. Use android, ios ou web.", ErrorsCode.BAD_REQUEST);
    }

    const currentVersion = String(request.query.currentVersion ?? request.header("x-app-version") ?? "").trim() || undefined;
    response.status(200).json(getAppVersionResponse(platformValue, currentVersion));
  },
};
