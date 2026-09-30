// Tokens issued before this field existed belong to version zero.
export function matchesAuthVersion(tokenVersion: unknown, userVersion = 0): boolean {
  const version = tokenVersion === undefined ? 0 : tokenVersion;
  return typeof version === "number" && Number.isSafeInteger(version) && version >= 0 && version === userVersion;
}
