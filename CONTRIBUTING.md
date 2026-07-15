# Contributing

Humber ASV visualizer components are open source and contributions are welcome! Please read the following guidelines before submitting a pull request.

## Branches / CI

- `dev` — active development; push/PR runs lint + typecheck + jest (+ selenium job).
- `master` — stable integration.
- `public` — release branch; pushing a version bump publishes to npm and deploys typedoc to GitHub Pages.

## Development

This repo uses **Bun** for development and publishes to npm.

```sh
bun install         # install (engine packages resolve via link: to sibling repos)
bun run dev         # demo harness at http://localhost:3000
bun run typecheck   # tsc --noEmit
bun run lint        # eslint
bun run test        # jest unit tests (runs jest under Node — do not use `bun test`)
bun run test:e2e    # selenium-webdriver smoke tests against the demo server
bun run build       # emit ESM + d.ts to dist/
bun run docs        # typedoc → docs/
```

Do not add `dist/` or `docs/` to commits; they are built on CI and published to npm/GitHub Pages.

## Commit messages

Try to use the following prefixes for commit messages:

- feat
- fix
- docs
- style
- refactor
- test
- chore

For example:

```txt
fix: correct the telemetry connection URL in the demo harness
```
