import { getSigningSecret } from "./securitySecrets";

interface EmailConfig {
  email_secret: string;
}

export const email: EmailConfig = {
  get email_secret() { return getSigningSecret("EMAIL_SECRET"); },
};
