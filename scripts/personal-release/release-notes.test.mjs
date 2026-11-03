import * as NodeAssert from "node:assert/strict";
import { it } from "vite-plus/test";
import { formatReleaseNotes } from "./release-notes.mjs";

it("release notes use authored changes or new non-merge commit subjects", () => {
  const comparison = {
    html_url: "https://github.com/iXab3r/t3code/compare/v1...v2",
    commits: [
      { parents: [{}], commit: { message: "Allow app-only updates\n\nDetails" } },
      { parents: [{}], commit: { message: "Move the provider choice beside Update\r\nDetails" } },
      { parents: [{}], commit: { message: "Allow app-only updates" } },
      { parents: [{}, {}], commit: { message: "Merge branch 'main'" } },
    ],
  };
  NodeAssert.equal(
    formatReleaseNotes(comparison),
    "## What's changed\n\n- Allow app-only updates\n- Move the provider choice beside Update\n\n[Full changelog](https://github.com/iXab3r/t3code/compare/v1...v2)\n",
  );
  NodeAssert.equal(
    formatReleaseNotes(comparison, "  - **Обновления:** провайдеры можно оставить на потом.\n"),
    "## What's changed\n\n- **Обновления:** провайдеры можно оставить на потом.\n\n[Full changelog](https://github.com/iXab3r/t3code/compare/v1...v2)\n",
  );
  NodeAssert.match(formatReleaseNotes({ commits: [] }, " \n"), /Maintenance rebuild/);
});
