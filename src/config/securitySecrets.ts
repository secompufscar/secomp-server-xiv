import * as jwt from "jsonwebtoken";

const secretNames = ["JWT_SECRET", "JWT_RESET_SECRET", "EMAIL_SECRET"] as const;
type SecretName = typeof secretNames[number];
const signingNames: Record<SecretName, string> = {
  JWT_SECRET: "JWT_SIGNING_SECRET",
  JWT_RESET_SECRET: "JWT_RESET_SIGNING_SECRET",
  EMAIL_SECRET: "EMAIL_SIGNING_SECRET",
};

function validSecret(value: string | undefined, minimumBytes: number): value is string {
  return Boolean(value && value.trim() === value && Buffer.byteLength(value, "utf8") >= minimumBytes
    && !/^your_/i.test(value));
}

export function requireSecuritySecret(name: SecretName, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name];
  if (!validSecret(value, 16)) {
    throw new Error(`${name} deve conter um segredo próprio válido de pelo menos 16 bytes, sem espaços nas extremidades`);
  }
  if (Buffer.byteLength(value, "utf8") < 32 && !validSecret(env[signingNames[name]], 32)) {
    throw new Error(`${name} legado exige ${signingNames[name]} distinto de pelo menos 32 bytes`);
  }
  return value;
}

export function getSigningSecret(name: SecretName, env: NodeJS.ProcessEnv = process.env): string {
  const legacy = requireSecuritySecret(name, env);
  const replacement = env[signingNames[name]];
  if (replacement && !validSecret(replacement, 32)) {
    throw new Error(`${signingNames[name]} deve conter pelo menos 32 bytes, sem espaços nas extremidades`);
  }
  return replacement || legacy;
}

export function verifySecurityToken(token: string, name: SecretName): string | jwt.JwtPayload {
  const signing = getSigningSecret(name);
  const legacy = requireSecuritySecret(name);
  try {
    return jwt.verify(token, signing);
  } catch (error) {
    if (legacy !== signing && error instanceof jwt.JsonWebTokenError && error.message === "invalid signature") {
      return jwt.verify(token, legacy);
    }
    throw error;
  }
}

export function validateSecuritySecrets(env: NodeJS.ProcessEnv = process.env): void {
  const values = secretNames.flatMap((name) => {
    const legacy = requireSecuritySecret(name, env);
    const signing = getSigningSecret(name, env);
    return legacy === signing ? [legacy] : [legacy, signing];
  });
  if (new Set(values).size !== values.length) {
    throw new Error("Segredos de autenticação, recuperação e e-mail devem ser distintos");
  }
}
