/* oxlint-disable t3code/no-global-process-runtime -- CI bootstrap runs before workspace dependencies are installed. */
import * as NodeChildProcess from "node:child_process";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import * as NodeUtil from "node:util";
import { verifyManifest, writeManifest } from "./manifest.mjs";

const root = NodeURL.fileURLToPath(new URL("../../", import.meta.url));
process.chdir(root);
const output = NodePath.join(root, "ci-out");
const input = NodePath.join(root, "ci-input");
const repository = "iXab3r/t3code";
const publicConfig = NodeUtil.parseEnv(await NodeFSP.readFile(".env.example", "utf8"));
for (const name of [
  "T3CODE_CLERK_PUBLISHABLE_KEY",
  "T3CODE_CLERK_JWT_TEMPLATE",
  "T3CODE_CLERK_CLI_OAUTH_CLIENT_ID",
  "T3CODE_RELAY_URL",
]) {
  process.env[name] ||= publicConfig[name];
  if (!process.env[name]) throw new Error(`Missing public build configuration: ${name}`);
}
process.env.T3CODE_DESKTOP_UPDATE_REPOSITORY = repository;
process.env.T3CODE_TELEMETRY_CHANNEL = "dev";
process.env.CSC_IDENTITY_AUTO_DISCOVERY = "false";

function run(command, args, options = {}) {
  const result = NodeChildProcess.spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} failed (${result.status ?? result.signal}).`);
}
function capture(command, args) {
  const result = NodeChildProcess.spawnSync(command, args, { encoding: "utf8" });
  if (result.error || result.status !== 0) throw result.error ?? new Error(result.stderr);
  return result.stdout.trim();
}
const node = (args, options) => run(process.execPath, args, options);
const vp = (args, options) => run(process.platform === "win32" ? "vp.exe" : "vp", args, options);
const tar =
  process.platform === "win32"
    ? NodePath.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe")
    : "tar";
const revision = capture("git", ["rev-parse", "HEAD"]);
const packageJson = JSON.parse(await NodeFSP.readFile(NodePath.join(root, "package.json"), "utf8"));
if (process.versions.node !== packageJson.engines.node)
  throw new Error(`Expected Node ${packageJson.engines.node}, got ${process.versions.node}.`);

function message(name, value) {
  const escaped = value
    .replaceAll("|", "||")
    .replaceAll("'", "|'")
    .replaceAll("\n", "|n")
    .replaceAll("\r", "|r")
    .replaceAll("[", "|[")
    .replaceAll("]", "|]");
  console.log(`##teamcity[${name} '${escaped}']`);
}
async function resetOutput() {
  if (NodePath.dirname(output) !== NodePath.resolve(root) || NodePath.basename(output) !== "ci-out")
    throw new Error("Unsafe output directory.");
  await NodeFSP.rm(output, { recursive: true, force: true });
  await NodeFSP.mkdir(output);
}
function install() {
  vp([
    "install",
    "--frozen-lockfile",
    "--filter=t3...",
    "--filter=@t3tools/web...",
    "--filter=@t3tools/desktop...",
    "--filter=@t3tools/scripts...",
  ]);
}

const phase = process.argv[2];
if (phase === "prepare") {
  if (process.platform !== "linux" || process.arch !== "x64")
    throw new Error("Prepare requires Linux x64 (use an amd64 container on Mac).");
  const counter = process.argv[3];
  if (!/^[1-9]\d*$/.test(counter ?? "")) throw new Error("Pass the TeamCity build counter.");
  const base = JSON.parse(await NodeFSP.readFile("apps/server/package.json", "utf8")).version.split(
    "-",
  )[0];
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const version = `${base}-nightly.${date}.${counter}`;
  await resetOutput();
  install();
  vp(["test", "run", "--config", "../vite.config.ts", "personal-release/manifest.test.mjs"], {
    cwd: NodePath.join(root, "scripts"),
  });
  node(["scripts/update-release-package-versions.ts", version]);
  vp(["run", "build:desktop"]);
  run(tar, [
    "-czf",
    NodePath.join(output, "js-bundle.tar.gz"),
    "apps/server/dist",
    "apps/desktop/dist-electron",
  ]);
  node(["apps/server/scripts/cli.ts", "build-exe", "--verbose"]);
  run("cargo", [
    "build",
    "--locked",
    "--release",
    "--target",
    "x86_64-unknown-linux-gnu",
    "--manifest-path",
    "native/resource-monitor/Cargo.toml",
  ]);
  const resourceDir = NodePath.join(output, "resource-monitor", "linux-x64");
  await NodeFSP.mkdir(resourceDir, { recursive: true });
  await NodeFSP.cp(
    "native/resource-monitor/target/x86_64-unknown-linux-gnu/release/t3-resource-monitor",
    NodePath.join(resourceDir, "t3-resource-monitor"),
  );
  node([
    "scripts/build-cli-archive.ts",
    "--platform",
    "linux",
    "--arch",
    "x64",
    "--version",
    version,
    "--resource-monitor-dir",
    NodePath.dirname(resourceDir),
    "--output-dir",
    output,
  ]);
  const runtime = `t3-${version}-linux-x64.tar.gz`;
  node([
    "scripts/smoke-cli-archive.ts",
    "--archive",
    NodePath.join(output, runtime),
    "--expect-version",
    version,
  ]);
  await writeManifest(output, { version, revision, repository });
  message("buildNumber", version);
  message("publishArtifacts", "ci-out/*.tar.gz => prepare");
  message("publishArtifacts", "ci-out/manifest.json => prepare");
} else if (phase === "windows") {
  if (process.platform !== "win32" || process.arch !== "x64")
    throw new Error("Windows packaging requires a Windows x64 agent.");
  const manifest = await verifyManifest(NodePath.join(input, "prepare"), revision);
  const { version } = manifest;
  const runtime = `t3-${version}-linux-x64.tar.gz`;
  if (!manifest.files["js-bundle.tar.gz"] || !manifest.files[runtime])
    throw new Error("Missing bundle or matching WSL runtime.");
  await resetOutput();
  install();
  node(["scripts/update-release-package-versions.ts", version]);
  run(tar, ["-xzf", NodePath.join(input, "prepare", "js-bundle.tar.gz"), "-C", root]);
  const tempParent = NodePath.resolve(NodeOS.tmpdir());
  const temp = await NodeFSP.mkdtemp(NodePath.join(tempParent, "t3-personal-package-"));
  process.env.TEMP = temp;
  process.env.TMP = temp;
  node([
    "scripts/build-desktop-artifact.ts",
    "--platform",
    "win",
    "--target",
    "nsis",
    "--arch",
    "x64",
    "--build-version",
    version,
    "--skip-build",
    "--keep-stage",
    "--wsl-runtime",
    NodePath.join(input, "prepare", runtime),
    "--output-dir",
    NodePath.join(output, "windows"),
  ]);
  const stages = (await NodeFSP.readdir(temp)).filter((name) =>
    name.startsWith("t3code-desktop-win-stage-"),
  );
  if (stages.length !== 1) throw new Error("Expected exactly one packaging stage.");
  const executable = NodePath.join(
    temp,
    stages[0],
    "app",
    "dist",
    "win-unpacked",
    "T3 Code (Nightly).exe",
  );
  const profile = NodePath.join(output, "smoke-profile");
  await NodeFSP.mkdir(profile);
  const feed = await NodeFSP.readFile(
    NodePath.join(NodePath.dirname(executable), "resources", "app-update.yml"),
    "utf8",
  );
  if (!/^owner:\s*iXab3r\s*$/m.test(feed) || !/^repo:\s*t3code\s*$/m.test(feed)) {
    throw new Error("Packaged updater points outside the personal fork.");
  }
  await NodeFSP.mkdir(NodePath.join(output, "launch-check"));
  await NodeFSP.writeFile(NodePath.join(output, "launch-check", "app-update.yml"), feed);
  try {
    node(
      [
        "scripts/smoke-desktop-app.ts",
        "--executable",
        executable,
        "--artifacts-dir",
        NodePath.join(output, "launch-check"),
      ],
      { env: { ...process.env, APPDATA: profile, LOCALAPPDATA: profile } },
    );
  } finally {
    message("publishArtifacts", "ci-out/launch-check/** => launch-check");
  }
  node(["apps/server/scripts/cli.ts", "build-exe", "--target", "win-x64"]);
  const resourceDir = NodePath.join(output, "resource-monitor", "win32-x64");
  await NodeFSP.mkdir(resourceDir, { recursive: true });
  await NodeFSP.cp(
    "native/resource-monitor/target/x86_64-pc-windows-msvc/release/t3-resource-monitor.exe",
    NodePath.join(resourceDir, "t3-resource-monitor.exe"),
  );
  node([
    "scripts/build-cli-archive.ts",
    "--platform",
    "win",
    "--arch",
    "x64",
    "--version",
    version,
    "--resource-monitor-dir",
    NodePath.dirname(resourceDir),
    "--output-dir",
    NodePath.join(output, "windows"),
  ]);
  node([
    "scripts/smoke-cli-archive.ts",
    "--archive",
    NodePath.join(output, "windows", `t3-${version}-win32-x64.zip`),
    "--expect-version",
    version,
  ]);
  await NodeFSP.cp(
    NodePath.join(input, "prepare", runtime),
    NodePath.join(output, "windows", runtime),
  );
  const builderDebug = NodePath.join(output, "windows", "builder-debug.yml");
  if ((await NodeFSP.readdir(NodePath.join(output, "windows"))).includes("builder-debug.yml")) {
    await NodeFSP.cp(builderDebug, NodePath.join(output, "launch-check", "builder-debug.yml"));
    await NodeFSP.rm(builderDebug);
  }
  message("publishArtifacts", "ci-out/launch-check/** => launch-check");
  await writeManifest(NodePath.join(output, "windows"), { version, revision, repository });
  message("buildNumber", version);
  message("publishArtifacts", "ci-out/windows/* => windows");
  if (
    NodePath.dirname(temp) !== tempParent ||
    !NodePath.basename(temp).startsWith("t3-personal-package-")
  )
    throw new Error("Unexpected packaging temporary directory.");
  await NodeFSP.rm(temp, { recursive: true, force: true });
} else if (phase === "stage-release") {
  const directory = NodePath.join(input, "windows");
  const manifest = await verifyManifest(directory, revision);
  const names = Object.keys(manifest.files);
  for (const extension of [".exe", ".blockmap", ".yml", "-linux-x64.tar.gz"]) {
    if (!names.some((name) => name.endsWith(extension)))
      throw new Error(`Missing release asset: ${extension}`);
  }
  await resetOutput();
  await NodeFSP.cp(directory, NodePath.join(output, "release"), { recursive: true });
  await NodeFSP.writeFile(
    NodePath.join(output, "release", "SHA256SUMS"),
    names
      .sort()
      .map((name) => `${manifest.files[name]}  ${name}\n`)
      .join(""),
  );
  message("buildNumber", manifest.version);
  message("publishArtifacts", "ci-out/release/* => release");
  console.log(
    `Validated v${manifest.version} at ${revision}. Release assets are staged; GitHub publication is not enabled.`,
  );
} else {
  throw new Error("Usage: run.mjs <prepare counter|windows|stage-release>");
}
