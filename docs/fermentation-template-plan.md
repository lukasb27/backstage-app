# Backstage Software Template: FastAPI/Flask + Ephemeral-Env CI/CD

## Goal
A Backstage Software Template that scaffolds a new app pre-wired with the same
PR-based ephemeral-environment pipeline used by `fermentation-station-agent` +
`fermentation-station-argocd-control`, so new services get CI, Docker build,
and per-PR Argo CD environments for free instead of hand-copied each time.

## Findings from the reference repos (2026-08-09)

- `fermentation-station-agent` is **FastAPI**, not Flask (`pyproject.toml`).
  Confirm which framework the template should actually scaffold before writing
  the skeleton — porting the pipeline to Flask app code is a different task
  than copying this repo as-is.
- Ephemeral-env mechanism: `.github/workflows/actions.yml`'s
  `ephemeral-environment-setup` job renders `argocd-application.template.yaml`
  via `utils/argo_app_writer.py` (Jinja2) and pushes the result directly into
  `fermentation-station-argocd-control/apps/<branch>.yaml` using a PAT
  (`secrets.ARGO_CD_REPO_TOKEN`). `cleanup.yml` reverses this on PR close.
- **Likely bug (race condition):** `ephemeral-environment-setup` only has
  `needs: ci` — it does not wait on `docker.yml`'s image build, which is a
  separate workflow triggered independently by the same push. The Argo CD
  Application can be committed (and synced) before the image it references
  exists in Docker Hub.
- **Possible second bug (branch-name casing):** `argo_app_writer.py` lowercases
  the branch name for the image tag (`branch.lower()`), while `docker.yml`'s
  `docker/metadata-action` tag (`type=ref,event=branch`) may preserve branch
  case. If so, a mixed-case branch name produces two different tag strings —
  worth verifying, not yet confirmed.
- `fermentation-station-argocd-control` is minimal (just `apps/main.yaml` +
  README) — nothing in-repo shows what turns a new `apps/<branch>.yaml` file
  into a live Argo CD Application (an ApplicationSet or similar must exist
  cluster-side). Worth confirming before templating this pattern.

## Concepts (for reference — see chat log for full explanation)

A Backstage Template is a `kind: Template` catalog entity, registered via a
`locations` entry like any other entity. `spec.parameters` defines the
"Create" form; `spec.steps` runs server-side actions in order:

1. `fetch:template` — copies a skeleton dir, substituting `${{ parameters.x }}`
   into every file.
2. `publish:github` — creates a new repo and pushes the rendered skeleton.
   (`plugin-scaffolder-backend-module-github` is already registered in this
   Backstage instance's `packages/backend/src/index.ts`.)
3. `catalog:register` — registers the new repo's `catalog-info.yaml` so it's
   immediately reachable in the catalog.

## Open decisions

- [ ] Flask or FastAPI as the actual app skeleton?
- [ ] Fix the race condition in the reference pipeline first, or template the
      bug and fix it once, centrally, later? (Recommend: fix first.)
- [ ] How does `ARGO_CD_REPO_TOKEN` get into each newly generated repo?
      `lukasb27` looks like a personal GitHub account, so no org-wide shared
      secrets. Options: custom scaffolder action calling GitHub's API to
      create the repo secret automatically, vs. a documented manual step.
- [ ] Which values get parameterized vs. left fixed (app name, image name,
      target `argocd-control` repo, k8s namespace prefix, at minimum)?

## Implementation steps

1. Fix (or confirm not-a-bug) the race condition and the tag-casing question
   in `fermentation-station-agent` / `fermentation-station-argocd-control`
   directly — see the handoff prompt for a fresh Claude Code session.
2. Decide the open questions above.
3. Write the templatized skeleton: app code + `.github/workflows/*` +
   `k8s/*` + `utils/argo_app_writer.py`, with hardcoded values swapped for
   `${{ parameters.x }}`.
4. Write `template.yaml` (parameters form + `fetch:template` →
   `publish:github` → `catalog:register` steps).
5. Add a `locations` entry for the template in `app-config.yaml` and
   `app-config.production.yaml` (same mechanism as the `catalog-info.yaml`
   fix from this session).
6. Solve the secrets-provisioning gap (decision above).
7. Test end-to-end via the "Create" button against a throwaway repo, and
   watch a real PR go through the full ephemeral-env cycle before trusting it.

## Status
Not started — plan only, per explicit request not to implement yet.
