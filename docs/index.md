# backstage-service

This is the Backstage control repo for the homelab — the portal itself
(`packages/app`, `packages/backend`), the live catalog data
(`catalog-info.yaml`, `examples/org.yaml`), and the deployment config
(`backstage-values.yaml`, `app-config*.yaml`) that Argo CD syncs from
`main`.

## Deploying

Pushing to `main` triggers `build-image.yml`, which builds and pushes a
SHA-tagged image to GHCR and commits the new tag back into
`backstage-values.yaml`. Argo CD's automated sync then rolls out the
change.

## Local development

```
yarn install
yarn dev
```
