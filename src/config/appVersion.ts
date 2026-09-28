export type AppPlatform = "android" | "ios" | "web";

export interface AppVersionPolicy {
  platform: AppPlatform;
  minimumVersion: string;
  latestVersion: string;
  updateUrl: string;
  enforcementEnabled: boolean;
}

const DEFAULT_ANDROID_URL = "https://play.google.com/store/apps/details?id=com.secompufscar.app";
const DEFAULT_WEB_URL = "https://app.secompufscar.com.br";

export function isAppPlatform(value: unknown): value is AppPlatform {
  return value === "android" || value === "ios" || value === "web";
}

function readVersion(name: string, fallback = "1.0.0") {
  const value = process.env[name]?.trim();
  return value && parseVersion(value) ? value : fallback;
}

export function parseVersion(version: string): number[] | null {
  if (!/^\d+(\.\d+){0,3}$/.test(version)) return null;
  return version.split(".").map(Number);
}

export function compareVersions(left: string, right: string): number | null {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  if (!leftParts || !rightParts) return null;

  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }
  return 0;
}

export function getAppVersionPolicy(platform: AppPlatform): AppVersionPolicy {
  const enforcementEnabled = process.env.APP_VERSION_ENFORCEMENT_ENABLED === "true";
  if (platform === "web") {
    return {
      platform,
      minimumVersion: "0.0.0",
      latestVersion: "0.0.0",
      updateUrl: DEFAULT_WEB_URL,
      enforcementEnabled: false,
    };
  }

  const prefix = platform === "android" ? "APP_ANDROID" : "APP_IOS";
  return {
    platform,
    minimumVersion: readVersion(`${prefix}_MIN_VERSION`),
    latestVersion: readVersion(`${prefix}_LATEST_VERSION`),
    updateUrl: process.env[`${prefix}_UPDATE_URL`]?.trim()
      || (platform === "android" ? DEFAULT_ANDROID_URL : DEFAULT_WEB_URL),
    enforcementEnabled,
  };
}

export function getAppVersionResponse(platform: AppPlatform, currentVersion?: string) {
  const policy = getAppVersionPolicy(platform);
  const comparison = currentVersion ? compareVersions(currentVersion, policy.minimumVersion) : null;
  const updateRequired = platform !== "web" && (comparison === null || comparison < 0);

  return {
    ...policy,
    currentVersion: currentVersion ?? null,
    updateRequired,
    force: policy.enforcementEnabled && updateRequired,
    message: policy.enforcementEnabled && updateRequired
      ? "Atualize o aplicativo para continuar."
      : updateRequired
        ? "Há uma versão mais recente disponível."
        : "Aplicativo compatível.",
  };
}
