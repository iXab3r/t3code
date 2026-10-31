import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import * as NodeUtil from "node:util";
import { _electron } from "playwright-core";

const { values } = NodeUtil.parseArgs({
  options: {
    executable: { type: "string" },
    "from-version": { type: "string" },
    "to-version": { type: "string" },
    sha256: { type: "string" },
  },
});
for (const name of ["executable", "from-version", "to-version", "sha256"]) {
  if (!values[name]) throw new Error(`Missing --${name}.`);
}
const profile = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "t3-update-check-"));
if (
  NodePath.dirname(profile) !== NodePath.resolve(NodeOS.tmpdir()) ||
  !NodePath.basename(profile).startsWith("t3-update-check-")
)
  throw new Error("Unexpected updater test profile path.");
const desktopManifest = NodeURL.fileURLToPath(
  new URL("../../apps/desktop/package.json", import.meta.url),
);
let application;
try {
  application = await _electron.launch({
    executablePath: values.executable,
    env: {
      ...process.env,
      APPDATA: profile,
      LOCALAPPDATA: profile,
      T3CODE_HOME: NodePath.join(profile, "t3"),
      T3CODE_DISABLE_AUTO_UPDATE: "true",
      T3CODE_TELEMETRY_ENABLED: "false",
    },
    timeout: 60_000,
  });
  const result = await application.evaluate(
    async ({ app }, input) => {
      const { createRequire } = await import("node:module");
      const { NsisUpdater } = createRequire(input.desktopManifest)("electron-updater");
      const updater = new NsisUpdater();
      updater.logger = null;
      updater.autoDownload = false;
      updater.autoInstallOnAppQuit = false;
      updater.allowPrerelease = true;
      updater.channel = "nightly";
      updater.disableDifferentialDownload = true;
      updater.on("error", () => {});
      const fromVersion = app.getVersion();
      if (fromVersion !== input.fromVersion)
        throw new Error(`Expected ${input.fromVersion}, opened ${fromVersion}.`);
      const update = await updater.checkForUpdates();
      if (update?.updateInfo.version !== input.toVersion)
        throw new Error(
          `Expected update ${input.toVersion}, received ${update?.updateInfo.version}.`,
        );
      const files = await updater.downloadUpdate();
      return { fromVersion, toVersion: update.updateInfo.version, files };
    },
    { desktopManifest, fromVersion: values["from-version"], toVersion: values["to-version"] },
  );
  if (result.files.length !== 1) throw new Error("Expected one downloaded NSIS installer.");
  const hash = NodeCrypto.createHash("sha256");
  for await (const chunk of NodeFS.createReadStream(result.files[0])) hash.update(chunk);
  const digest = hash.digest("hex");
  if (digest !== values.sha256)
    throw new Error("Downloaded installer does not match the release checksum.");
  console.log(
    JSON.stringify({
      fromVersion: result.fromVersion,
      toVersion: result.toVersion,
      sha256: digest,
      downloaded: true,
      installed: false,
    }),
  );
} finally {
  await application?.close();
  await NodeFSP.rm(profile, { recursive: true, force: true });
}
