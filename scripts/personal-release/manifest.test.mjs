import * as NodeAssert from "node:assert/strict";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { it } from "vite-plus/test";
import { verifyManifest, writeManifest } from "./manifest.mjs";

it("release handoff rejects another revision and changed artifact bytes", async () => {
  const directory = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "t3-release-manifest-"));
  try {
    const identity = {
      repository: "iXab3r/t3code",
      revision: "a".repeat(40),
      version: "0.0.1-nightly.20261031.1",
    };
    await NodeFSP.writeFile(NodePath.join(directory, "bundle.tar.gz"), "original");
    await writeManifest(directory, identity);
    NodeAssert.equal(
      (await verifyManifest(directory, identity.revision)).version,
      identity.version,
    );
    await NodeAssert.rejects(
      verifyManifest(directory, "b".repeat(40)),
      /different source revision/,
    );
    await NodeAssert.rejects(
      verifyManifest(directory, identity.revision, "0.0.1-nightly.20261031.2"),
      /different release version/,
    );
    await NodeAssert.rejects(
      verifyManifest(directory, identity.revision, identity.version, ["-linux-arm64.tar.gz"]),
      /Missing release asset/,
    );
    await NodeFSP.writeFile(NodePath.join(directory, "bundle.tar.gz"), "changed");
    await NodeAssert.rejects(verifyManifest(directory, identity.revision), /checksum mismatch/);
  } finally {
    await NodeFSP.rm(directory, { recursive: true, force: true });
  }
});
