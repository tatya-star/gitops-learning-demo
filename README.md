# Relay Release Dashboard

A small GitOps learning demo: change the dashboard, push to `main`, and watch GitHub Actions publish an image that Argo CD deploys to local Kubernetes.

## Local preview

Requirements: Node.js 24.21.0 or a Vite-supported version, npm, Docker Desktop with Kubernetes enabled.

```powershell
npm ci
npm run dev
```

Open the local Vite URL shown in the terminal. Run the production build and lint checks with:

```powershell
npm run lint
$env:VITE_COMMIT_SHA = "local-preview"
npm run build
docker build -t gitops-learning-demo:local .
```

The dashboard's health-check and recovery buttons change simulated UI state only. Git changes, not dashboard buttons, drive deployments.

The displayed commit and image are build metadata, not live cluster observations. Argo CD is the authoritative view for deployment sync and health.

## Tests

Install the locked dependencies and Chromium, then run both test suites:

```powershell
npm ci
npx playwright install chromium
npm test
npm run test:e2e
```

On Linux, use `npx playwright install --with-deps chromium` to also install the browser's system libraries. No Kubernetes access is needed for either suite.

`npm test` runs the deployment-manifest tests. `npm run test:e2e` builds a known SHA-tagged fixture and starts its own strict preview at `http://127.0.0.1:4179`; keep that port free. Headless Chromium checks the dashboard at 1280px and 375px widths, including pointer/keyboard controls, simulation feedback, unchanged release identity, no button-triggered requests, and reset on reload. Failure screenshots and traces are saved in `test-results/`.

The browser build replaces local `dist/` with test fixtures. Run `npm run build` afterward to restore normal build output; fixture environment variables are scoped to the test server. CI runs both suites before publication and then rebuilds with the real commit SHA and GHCR image name before publishing or updating the manifest.

Before pushing the image, CI starts the actual NGINX candidate on localhost and runs the release-identity browser check against it. `RELEASE_CANDIDATE_URL` selects that container without rebuilding; `GITHUB_SHA` and `IMAGE_NAME` provide its expected identity. HTTP failures or a missing/mismatched version prevent publication. The temporary container is removed even when verification fails.

## First GitHub release

The empty public repository is [tatya-star/gitops-learning-demo](https://github.com/tatya-star/gitops-learning-demo). From the workspace root, initialize and push only the app folder:

```powershell
Set-Location gitops-learning-demo
git init -b main
git add .
git commit -m "feat: create GitOps learning dashboard"
git remote add origin https://github.com/tatya-star/gitops-learning-demo.git
git push -u origin main
```

Do not initialize Git at the parent BMad workspace. In repository Settings → Actions → General, enable Actions and allow read/write workflow permissions. The workflow itself requests only `contents: write` and `packages: write`.

The first push builds and publishes `ghcr.io/tatya-star/gitops-learning-demo:<commit-sha>`, then commits the image tag to `deploy/deployment.yaml`. In GitHub Packages, set the new GHCR package visibility to **public** before Argo CD's first sync. The workflow does not deploy to Kubernetes or store cluster credentials. Its generated manifest commit uses `GITHUB_TOKEN` and does not recursively start another push workflow.

## One-time local Argo CD setup

The following installs the standard non-HA Argo CD 3.5.4 bundle into the local cluster. Keep this setup local; it is not hardened for a shared or production cluster.

```powershell
if ('docker-desktop' -notin @(kubectl config get-contexts -o name)) {
	throw 'Enable Docker Desktop Kubernetes before continuing.'
}
kubectl --context docker-desktop cluster-info
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop Kubernetes is not reachable.' }

kubectl --context docker-desktop create namespace argocd
kubectl --context docker-desktop apply -n argocd --server-side --force-conflicts -f https://raw.githubusercontent.com/argoproj/argo-cd/v3.5.4/manifests/install.yaml
if ($LASTEXITCODE -ne 0) { throw 'Argo CD installation failed.' }

kubectl --context docker-desktop wait --for=condition=Established crd/applications.argoproj.io --timeout=120s
if ($LASTEXITCODE -ne 0) { throw 'The Argo CD Application CRD is not ready.' }

foreach ($resource in @('deployment/argocd-server', 'deployment/argocd-repo-server', 'deployment/argocd-redis', 'statefulset/argocd-application-controller')) {
	kubectl --context docker-desktop -n argocd rollout status $resource --timeout=180s
	if ($LASTEXITCODE -ne 0) { throw "Argo CD readiness failed: $resource" }
}
```

After Actions has published the first image and you have made the GHCR package public, apply the bootstrap Application:

```powershell
kubectl --context docker-desktop apply -f bootstrap/argocd-application.yaml
```

Argo CD creates `gitops-demo`, watches `deploy/`, and automatically syncs the dashboard.

## View the demo

Run these in separate PowerShell terminals and leave both commands running:

```powershell
kubectl --context docker-desktop port-forward -n argocd svc/argocd-server 8080:443
```

```powershell
kubectl --context docker-desktop port-forward -n gitops-demo svc/release-dashboard 8081:80
```

Open `https://localhost:8080` for Argo CD and `http://localhost:8081` for the dashboard. Argo CD uses a local self-signed certificate. Retrieve its initial admin password from the `argocd-initial-admin-secret`, then change the password after first sign-in.

Argo CD polls Git every 120 seconds with up to 60 seconds of jitter by default. Allow up to about three minutes for a change to appear, then confirm Argo CD reports **Synced** and **Healthy** and the dashboard shows the matching commit version. If Docker Desktop Kubernetes is reset, reinstall Argo CD and reapply the bootstrap Application.
