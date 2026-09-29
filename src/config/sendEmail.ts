import { requireSecuritySecret } from "./securitySecrets";

interface EmailConfig {
  email_secret: string;
}

export const email: EmailConfig = {
  get email_secret() { return requireSecuritySecret("EMAIL_SECRET"); },
};
