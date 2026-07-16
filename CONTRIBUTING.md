# Contributing

Humber ASV is open source and contributions are welcome!
Please read the following guidelines before submitting a pull request.

## License

By contributing, you agree that your contributions will be licensed under our [MIT License](LICENSE).

## Code of Conduct

We want to make this community a welcoming and harassment-free experience for everyone. Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## How To Contribute

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:

   ```sh
   git clone [https://github.com/HumberASV/visualizer.git](https://github.com/HumberASV/visualizer.git)
   cd visualizer
   ```

3. **Create a branch** for your changes; use a descriptive name.
4. **Make your changes** and write/update tests as necessary
5. **Format and lint** your code
6. **Commit your changes** using the commit message guidelines below
7. **Push to your fork** and **open a Pull Request (PR)** against our `dev` branch

> [!WARNING]
> **DO NOT** push to `master` or  `public`

## Reporting Issues & Suggestions

- **Bugs:** Before opening a new issue, search the existing issues to see if it has already been reported. If not, please open a new issue using our Bug Report template, providing a clear description and steps to reproduce.
- **Feature Requests:** If you have an idea to improve the visualizer, open an issue labeled `enhancement` and describe your use case.

## Branches / CI

We employ a branching strategy for separating codebase with public deployments and development. Follow the below guide for information:

- `dev` — active development; e.g. push/PR runs lint + typecheck + jest (+ selenium job).
- `master` — stable integration.
- `public` — release branch; e.g. pushing a version bump publishes to npm and deploys typedoc to GitHub Pages.

## Development

This repo uses **Bun** for development and publishes to npm.

```sh
bun install         # install (engine packages resolve via link: to sibling repos)
bun run dev         # demo harness at http://localhost:3000
bun run typecheck   # tsc --noEmit
bun run lint        # eslint
bun run test        # jest unit tests (runs jest under Node — do not use `bun test`)
bun run test:e2e    # selenium-webdriver smoke tests against the demo server
bun run build       # emit ESM + d.ts to dist/
bun run docs        # typedoc → docs/
```

Do not add `dist/` or `docs/` to commits; they are built on CI and published to npm/GitHub Pages.

### Code Style

We use **ESLint** for static analysis and code quality checks for the following languages:

- **JavaScript / JSX**
- **TypeScript**
- **JSON / JSONC / JSON5**
- **CSS**
- **HTML**

> [!NOTE]
> If you use VS Code, we highly recommend installing the **ESLint** extension to catch errors and formatting issues directly in your editor.

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
