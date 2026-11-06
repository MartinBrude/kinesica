import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

console.log("— Verificación backfill relacional —");
execSync("php scripts/verify-relational-backfill.php", {
  stdio: "inherit",
  cwd: root,
});
