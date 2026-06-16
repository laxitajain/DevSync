import { PrismaService } from "../../src/prisma/prisma.service";

/**
 * Integration tests run against a real Postgres instance, but in a dedicated
 * `devsync_test` schema so they never touch local dev data. The schema is
 * created and migrated by the global setup before any suite runs.
 *
 * We point the whole process at this URL *before* the Prisma client is ever
 * constructed (see the import at the top of `test-app.ts`).
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://devsync:devsync@localhost:5432/devsync?schema=devsync_test";

/**
 * Tables in dependency order. Truncating with CASCADE handles FKs regardless,
 * but listing them keeps the intent explicit and the reset deterministic.
 */
const TABLES = [
  "ActivityLog",
  "Attachment",
  "TaskComment",
  "TaskAssignee",
  "Task",
  "BoardColumn",
  "Board",
  "Project",
  "WorkspaceInvite",
  "WorkspaceMember",
  "Workspace",
  "RefreshToken",
  "EmailVerificationToken",
  "PasswordResetToken",
  "User"
];

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const quoted = TABLES.map((table) => `"${table}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`);
}
