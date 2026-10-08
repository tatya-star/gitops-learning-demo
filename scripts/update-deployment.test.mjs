import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./update-deployment.mjs", import.meta.url));
const originalManifest = readFileSync(
  new URL("../deploy/deployment.yaml", import.meta.url),
  "utf8",
).replace(/image: [^\r\n]+/, "image: ghcr.io/demo/dashboard:old");

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function createRepository(context, manifest = originalManifest) {
  const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), "gitops-manifest-test-"));
  context.after(() => rmSync(temporaryDirectory, { recursive: true, force: true }));

  const remotePath = path.join(temporaryDirectory, "origin.git");
  const workingPath = path.join(temporaryDirectory, "working-copy");

  git(temporaryDirectory, "init", "--bare", remotePath);
  mkdirSync(workingPath);
  git(workingPath, "init", "-b", "main");
  git(workingPath, "config", "user.name", "Test User");
  git(workingPath, "config", "user.email", "test@example.invalid");
  mkdirSync(path.join(workingPath, "deploy"));
  writeFileSync(path.join(workingPath, "deploy", "deployment.yaml"), manifest);
  git(workingPath, "add", "deploy/deployment.yaml");
  git(workingPath, "commit", "-m", "initial desired state");
  git(workingPath, "remote", "add", "origin", remotePath);
  git(workingPath, "push", "-u", "origin", "main");

  return { remotePath, temporaryDirectory, workingPath };
}

test("a successful manifest push updates the remote desired state", (context) => {
  const { remotePath, temporaryDirectory, workingPath } = createRepository(context);
  const updatedImage = "ghcr.io/demo/dashboard:new";

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: workingPath,
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_REF_NAME: "main",
      GITHUB_SHA: "new-release-sha",
      IMAGE_REF: updatedImage,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    git(temporaryDirectory, "--git-dir", remotePath, "show", "main:deploy/deployment.yaml"),
    originalManifest.replace("ghcr.io/demo/dashboard:old", updatedImage).trim(),
  );
  assert.match(
    git(temporaryDirectory, "--git-dir", remotePath, "log", "-1", "--format=%s", "main"),
    /chore: deploy new-release-sha/,
  );
});

test("an already-current image succeeds without creating a commit", (context) => {
  const { workingPath } = createRepository(context);
  const originalRevision = git(workingPath, "rev-parse", "HEAD");
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: workingPath,
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_REF_NAME: "main",
      GITHUB_SHA: "new-release-sha",
      IMAGE_REF: "ghcr.io/demo/dashboard:old",
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /already current/);
  assert.equal(git(workingPath, "rev-parse", "HEAD"), originalRevision);
});

test("an empty image field does not consume the following property", (context) => {
  const manifest = originalManifest.replace("ghcr.io/demo/dashboard:old", "");
  const { remotePath, temporaryDirectory, workingPath } = createRepository(context, manifest);
  const updatedImage = "ghcr.io/demo/dashboard:new";
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: workingPath,
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_REF_NAME: "main",
      GITHUB_SHA: "new-release-sha",
      IMAGE_REF: updatedImage,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    git(temporaryDirectory, "--git-dir", remotePath, "show", "main:deploy/deployment.yaml"),
    originalManifest.replace("ghcr.io/demo/dashboard:old", updatedImage).trim(),
  );
});

test("a missing image field fails without changing local or remote state", (context) => {
  const manifest = originalManifest.replace(/^[ \t]*image:[^\r\n]*\r?\n/m, "");
  const { remotePath, temporaryDirectory, workingPath } = createRepository(context, manifest);
  const originalRevision = git(workingPath, "rev-parse", "HEAD");
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: workingPath,
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_REF_NAME: "main",
      GITHUB_SHA: "new-release-sha",
      IMAGE_REF: "ghcr.io/demo/dashboard:new",
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /No image field found/);
  assert.equal(git(workingPath, "rev-parse", "HEAD"), originalRevision);
  assert.equal(git(temporaryDirectory, "--git-dir", remotePath, "rev-parse", "main"), originalRevision);
  assert.equal(readFileSync(path.join(workingPath, "deploy", "deployment.yaml"), "utf8"), manifest);
});

test("a rejected manifest push leaves the remote desired state unchanged", (context) => {
  const { remotePath, temporaryDirectory, workingPath } = createRepository(context);
  const updatedImage = "ghcr.io/demo/dashboard:new";
  const hookPath = path.join(remotePath, "hooks", "pre-receive");
  writeFileSync(hookPath, "#!/bin/sh\necho 'intentional test rejection' >&2\nexit 1\n");
  chmodSync(hookPath, 0o755);

  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: workingPath,
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_REF_NAME: "main",
      GITHUB_SHA: "new-release-sha",
      IMAGE_REF: updatedImage,
    },
  });

  assert.notEqual(result.status, 0, "the rejected push must fail the release step");
  assert.match(result.stderr, /intentional test rejection/);
  assert.equal(
    git(temporaryDirectory, "--git-dir", remotePath, "show", "main:deploy/deployment.yaml"),
    originalManifest.trim(),
  );
  assert.match(
    readFileSync(path.join(workingPath, "deploy", "deployment.yaml"), "utf8"),
    new RegExp(updatedImage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
});