import { execSync } from "child_process";
import { resolve } from "path";
import { TEST_DATABASE_URL } from "./utils/database";

const DB_PACKAGE_DIR = resolve(__dirname, "../../../packages/db");

/**
 * Runs once before the entire e2e suite. Applies all Prisma migrations to the
 * isolated `devsync_test` schema using `migrate deploy` (the same command a
 * production deploy would run), creating the schema if it does not exist.
 */
export default async function globalSetup(): Promise<void> {
  execSync("npx prisma migrate deploy", {
    cwd: DB_PACKAGE_DIR,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit"
  });
}
