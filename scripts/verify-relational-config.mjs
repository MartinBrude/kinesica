import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

console.log("— Verificación config relacional (etapa 8) —");
execSync("php scripts/verify-relational-config.php", {
  stdio: "inherit",
  cwd: root,
});
