import * as NodeFS from "node:fs";

export function formatReleaseNotes(comparison, authoredNotes = "") {
  const subjects = comparison.commits
    .filter((commit) => commit.parents.length <= 1)
    .map((commit) => commit.commit.message.split(/\r?\n/, 1)[0].trim())
    .filter(Boolean);
  const changes =
    authoredNotes.trim() ||
    [...new Set(subjects)].map((subject) => `- ${subject}`).join("\n") ||
    "- Maintenance rebuild; no source changes since the previous release.";
  return `## What's changed\n\n${changes}\n${
    comparison.html_url ? `\n[Full changelog](${comparison.html_url})\n` : ""
  }`;
}

if (import.meta.main) {
  const comparison = JSON.parse(NodeFS.readFileSync(0, "utf8"));
  process.stdout.write(formatReleaseNotes(comparison, process.env.T3_RELEASE_NOTES));
}
