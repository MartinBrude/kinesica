// Ejecuta las pruebas PHP de interacciones contra una MariaDB/MySQL temporal real.
// Requiere `php` y `mariadbd` + `mariadb-install-db` (brew install php mariadb).
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

function which(bin) {
  const r = spawnSync("which", [bin], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

const php = which("php");
const mariadbd = which("mariadbd") || which("mysqld");
const installDb = which("mariadb-install-db") || which("mysql_install_db");
const adminBin = which("mariadb-admin") || which("mysqladmin");
const clientBin = which("mariadb") || which("mysql");
if (!php || !mariadbd || !installDb || !adminBin || !clientBin) {
  console.error("Faltan herramientas: php, mariadbd, mariadb-install-db, mariadb-admin, mariadb (brew install php mariadb).");
  process.exit(1);
}

const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kin-int-"));
const dataDir = path.join(tmp, "data");
const sock = path.join(tmp, "db.sock");
const port = await freePort();
let server = null;

function cleanup(code) {
  if (server && !server.killed) server.kill("SIGTERM");
  setTimeout(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    process.exit(code);
  }, 1500);
}

const baseDir = path.resolve(path.dirname(fs.realpathSync(mariadbd)), "..");
let r = spawnSync(
  installDb,
  ["--no-defaults", `--datadir=${dataDir}`, `--basedir=${baseDir}`, "--auth-root-authentication-method=normal", "--skip-test-db"],
  { encoding: "utf8" },
);
if (r.status !== 0) {
  console.error("No se pudo inicializar MariaDB temporal:\n" + (r.stdout || "") + (r.stderr || ""));
  cleanup(1);
} else {
  server = spawn(
    mariadbd,
    ["--no-defaults", `--datadir=${dataDir}`, `--socket=${sock}`, `--port=${port}`, "--bind-address=127.0.0.1", `--pid-file=${path.join(tmp, "db.pid")}`, "--innodb-flush-log-at-trx-commit=0"],
    { stdio: "ignore" },
  );
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    await new Promise((res) => setTimeout(res, 500));
    ready = spawnSync(adminBin, ["--no-defaults", "-S", sock, "-uroot", "ping"], { encoding: "utf8" }).status === 0;
  }
  if (!ready) {
    console.error("MariaDB temporal no arrancó.");
    cleanup(1);
  } else {
    const sql = "CREATE DATABASE kt CHARACTER SET utf8mb4; CREATE USER 'kt'@'127.0.0.1' IDENTIFIED BY 'kt'; GRANT ALL ON *.* TO 'kt'@'127.0.0.1'; FLUSH PRIVILEGES;";
    r = spawnSync(clientBin, ["--no-defaults", "-S", sock, "-uroot", "-e", sql], { encoding: "utf8" });
    if (r.status !== 0) {
      console.error(r.stderr);
      cleanup(1);
    } else {
      let status = 0;
      for (const script of [
        "scripts/test-interacciones.php",
        "scripts/test-interacciones-http.php",
        "scripts/test-recordatorios.php",
      ]) {
        const t = spawnSync(php, [script], {
          stdio: "inherit",
          env: { ...process.env, KT_DB_HOST: "127.0.0.1", KT_DB_PORT: String(port), KT_DB_NAME: "kt", KT_DB_USER: "kt", KT_DB_PASS: "kt", KT_TMP: tmp },
        });
        status = status || (t.status ?? 1);
      }
      cleanup(status);
    }
  }
}
