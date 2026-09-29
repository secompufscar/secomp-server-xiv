import type { CorsOptions } from "cors";

const defaultCorsOrigins = [
  "http://localhost:8081",
  "https://secompufscar.com.br",
  "https://app.secompufscar.com.br",
  "https://secomp-app-xiv.vercel.app",
  "https://secomp-app-xiv-git-main-secomp-tis-projects.vercel.app",
  "http://localhost:3000",
];

// Keep published clients working even when an environment lists only extra origins.
export function getCorsOrigins(additionalOrigins = process.env.CORS_ORIGINS): string[] {
  const configured = (additionalOrigins ?? "").split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return [...new Set([...defaultCorsOrigins, ...configured])];
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sizeLimit(value: string | undefined, fallback: string) {
  return value && /^\d+(?:kb|mb)$/i.test(value.trim()) ? value.trim().toLowerCase() : fallback;
}

export const httpConfig = {
  bodyLimit: sizeLimit(process.env.HTTP_BODY_LIMIT, "1mb"),
  corsOrigins: getCorsOrigins(),
  trustProxyHops: positiveInteger(process.env.TRUST_PROXY_HOPS, 1),
  uploadMaxBytes: positiveInteger(process.env.UPLOAD_MAX_MB, 8) * 1024 * 1024,
  authRateLimitWindowMs: positiveInteger(process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES, 15) * 60 * 1000,
  authRateLimitMax: positiveInteger(process.env.AUTH_RATE_LIMIT_MAX_FAILURES, 20),
  accountRateLimitWindowMs: positiveInteger(process.env.ACCOUNT_RATE_LIMIT_WINDOW_MINUTES, 60) * 60 * 1000,
  accountRateLimitMax: positiveInteger(process.env.ACCOUNT_RATE_LIMIT_MAX_REQUESTS, 20),
};

export const corsOptions: CorsOptions = {
  origin: httpConfig.corsOrigins,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
};
