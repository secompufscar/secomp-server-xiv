import { Prisma } from "@prisma/client";
import { setTimeout as delay } from "node:timers/promises";

type ConnectionOperation = "user-by-id" | "user-by-email" | "refresh-lookup" |
  "session-create" | "session-rotate" | "current-event" | "database-health";

export function databaseErrorCode(error: unknown): string | undefined {
  const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code
    : error instanceof Prisma.PrismaClientInitializationError ? error.errorCode : undefined;
  return code && /^P\d{4}$/.test(code) ? code : undefined;
}

export function isDatabaseUnavailable(error: unknown): boolean {
  return ["P1001", "P1002", "P1008", "P1017", "P2024"].includes(databaseErrorCode(error) ?? "");
}

// Only use for reads, or a transaction known to have failed before its first write.
// Never replay a write/commit whose result may be ambiguous after a disconnect.
export async function withDatabaseConnectionRetry<T>(
  operation: ConnectionOperation,
  action: () => Promise<T>,
  safeToRetry: () => boolean = () => true,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await action();
    } catch (error) {
      const code = databaseErrorCode(error);
      if (attempt >= 2 || !["P1001", "P1017"].includes(code ?? "") || !safeToRetry()) throw error;
      console.warn(JSON.stringify({ event: "DATABASE_CONNECTION_RETRY", operation, databaseCode: code, attempt: attempt + 1 }));
      await delay(attempt === 0 ? 100 : 250);
    }
  }
}

export function safeErrorType(error: unknown): string {
  if (databaseErrorCode(error)) return "DatabaseError";
  if (error instanceof Prisma.PrismaClientValidationError) return "DatabaseValidationError";
  if (error instanceof TypeError) return "TypeError";
  if (error instanceof RangeError) return "RangeError";
  if (error instanceof SyntaxError) return "SyntaxError";
  return error instanceof Error ? "Error" : "UnknownError";
}
