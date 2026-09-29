const secretNames = ["JWT_SECRET", "JWT_RESET_SECRET", "EMAIL_SECRET"] as const;
type SecretName = typeof secretNames[number];

export function requireSecuritySecret(name: SecretName, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name];
  if (!value || value.trim() !== value || Buffer.byteLength(value, "utf8") < 32 || /^your_/i.test(value)) {
    throw new Error(`${name} deve conter um segredo próprio de pelo menos 32 bytes, sem espaços nas extremidades`);
  }
  return value;
}

export function validateSecuritySecrets(env: NodeJS.ProcessEnv = process.env): void {
  const values = secretNames.map((name) => requireSecuritySecret(name, env));
  if (new Set(values).size !== values.length) {
    throw new Error("JWT_SECRET, JWT_RESET_SECRET e EMAIL_SECRET devem ser distintos");
  }
}
