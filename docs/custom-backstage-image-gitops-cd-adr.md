# Custom Backstage Image with GitOps CD via Argo CD

## Status
Accepted

## Context
The cluster ran a stock `ghcr.io/backstage/backstage:latest` image deployed by hand via `helm upgrade`, with production config (`app-config.production.yaml`), the `backstage.example` Ingress, and TLS wiring applied out-of-band via `kubectl apply`. None of this lived in git. Future work requires custom plugins and catalog entities, which means building and versioning our own image, and the cluster already runs Argo CD, making it the natural CD target rather than adopting a second tool.

## Decision
Push the existing scaffolded app to a git repo (`lukasb27/backstage-app`) and build its own `packages/backend/Dockerfile` image via GitHub Actions on every push to `main`, publishing to `ghcr.io` (chosen over Docker Hub to avoid its free-tier pull-rate limits and to reuse GitHub Actions' built-in token auth). The previously out-of-band Ingress/TLS and production app-config were folded into git (`backstage-values.yaml`'s `extraDeploy`, and `app-config.production.yaml` baked into the image) so the whole deployment is declarative. Argo CD's `Application` uses a multi-source spec: the upstream `backstage` Helm chart plus this repo's values file, with `automated: {prune: true, selfHeal: true}` sync. CI tags images by commit SHA and commits the tag bump back into `backstage-values.yaml` (excluded from re-triggering CI via `paths-ignore`), rather than running Argo CD Image Updater, keeping the tag-bump logic in one place (CI) instead of two systems.

## Consequences
Positive: a plain `git push` now flows unattended to a running pod, verified end-to-end (build → tag bump commit → auto-sync → live). Deployment state, ingress, and prod config are fully traceable and reproducible from git; no more configuration drift outside version control.

Negative / debt: the image is currently public on ghcr.io — acceptable for a homelab with no secrets baked in, but would need `imagePullSecrets` if that assumption changes. `selfHeal`/`prune` mean any manual `kubectl edit` against these resources is silently reverted or deleted on the next reconcile. The catalog still runs on in-memory SQLite, so restarting the pod loses catalog state — not addressed by this change. A GitHub PAT secret (`github-pr-token`) exists in-cluster but is intentionally left unwired.

## Revisit Trigger
Revisit if catalog data needs to survive restarts (switch to the chart's Postgres subchart), if the deployment needs to scale beyond one replica (requires a shared database first), or if the CI-driven tag-bump commits become noisy enough to warrant Argo CD Image Updater instead.
