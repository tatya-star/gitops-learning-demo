import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const imageRef = process.env.IMAGE_REF;
const branch = process.env.GITHUB_REF_NAME;
const manifestPath = "deploy/deployment.yaml";

function runGit(args, allowedStatuses = [0], stdio = "inherit") {
  const result = spawnSync("git", args, { stdio });
  if (result.error) throw result.error;
  if (!allowedStatuses.includes(result.status)) {
    throw new Error(`git ${args.join(" ")} failed with exit code ${result.status}`);
  }
  return result.status;
}

try {
  if (!imageRef || !branch) {
    throw new Error("IMAGE_REF and GITHUB_REF_NAME are required.");
  }

  const manifest = readFileSync(manifestPath, "utf8");
  const imagePattern = /^([ \t]*image:)[^\r\n]*$/m;
  if (!imagePattern.test(manifest)) {
    throw new Error(`No image field found in ${manifestPath}.`);
  }
  const updatedManifest = manifest.replace(
    imagePattern,
    (_, prefix) => `${prefix} ${imageRef}`,
  );

  writeFileSync(manifestPath, updatedManifest);
  const diffStatus = runGit(["diff", "--quiet", "--", manifestPath], [0, 1], "ignore");
  if (diffStatus === 0) {
    console.log("Deployment image is already current.");
  } else {
    runGit(["config", "user.name", "github-actions[bot]"]);
    runGit([
      "config",
      "user.email",
      "41898282+github-actions[bot]@users.noreply.github.com",
    ]);
    runGit(["add", manifestPath]);
    runGit(["commit", "-m", `chore: deploy ${process.env.GITHUB_SHA}`]);
    runGit(["push", "origin", `HEAD:${branch}`]);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}