# Rounza

A thoughtful home for your job search, from the first application to the final round.

**Current scope: milestone 1 — project foundation.** The app has a holding page,
a shared UI foundation, and automated quality checks. The interactive demo,
accounts, job tracking, credential vault, and AI features are later milestones.

## Run locally

Use Node.js 22 (22.14 or newer) and npm. `.nvmrc` selects the Node 22 line;
Node 24 is also accepted by the package engine range.

```sh
git clone https://github.com/DavidAsrorxonov/rounza.git
cd rounza
nvm install
nvm use
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). If you do not use nvm, install a
supported Node version and skip the two nvm commands.

**No service accounts or API keys are required for this milestone.**
`.env.example` documents the planned Supabase and OpenAI variables; they are not
consumed yet. When needed, copy it to `.env.local` and configure your own values.
Local environment files are ignored by Git. Anything prefixed `NEXT_PUBLIC_`
is visible to browsers, so that prefix must never be used for a secret.

## Commands

| Command           | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `npm run dev`     | Start the development server                         |
| `npm run build`   | Create a production build                            |
| `npm start`       | Serve that production build                          |
| `npm run check`   | Check formatting, ESLint, and TypeScript             |
| `npm run format`  | Apply Prettier formatting                            |
| `npm test`        | Run Playwright against the existing production build |
| `npm run test:ui` | Open Playwright's interactive test runner            |
| `npm run verify`  | Check, build, and run browser tests                  |

Install the test browser once before the first verification:

```sh
npx playwright install chromium
npm run verify
```

On Linux, use `npx playwright install --with-deps chromium` to install system
dependencies too. Tests start and stop their own production server on port 3100;
keep that port available. `npm test` and `npm run test:ui` require a fresh
`npm run build`. Smoke tests cover desktop/mobile startup, keyboard navigation,
and the 404 return path. They do not claim coverage of future product features.

## Stack and structure

Next.js App Router, React, strict TypeScript, Tailwind CSS 4, and shadcn/ui.
Dependencies are locked in `package-lock.json`; use `npm ci` for reproducible installs.
ESLint, Prettier, and Playwright provide the initial quality tooling.

```text
src/
  app/              Routes, root layout, metadata, and global styles
  components/ui/    Local shadcn/ui component source
  lib/              Shared utilities
tests/e2e/          Production browser smoke tests
docs/              Architecture decisions and implementation roadmap
.github/           CI workflow and pull request template
```

The `@/*` import alias maps to `src/*`. `components.json` configures shadcn/ui;
add primitives as they are needed with `npx shadcn@latest add <component>`.
The initial Button uses the New York/Radix component style. CSS variables in
`src/app/globals.css` hold the initial palette. Fonts use the system stack so
builds and page loads do not depend on a third-party font service.

## Development workflow

GitHub Actions runs installation, formatting, linting, type checking, a production
build, and Chromium smoke tests on pushes to `main` and pull requests to `main`.
It needs no application secrets. Failed browser runs retain reports for seven days.

The empty repository is bootstrapped on `main` for milestone 1. Use a focused
branch and pull request for each subsequent milestone, keeping `main` buildable.
Run `npm run verify` before publishing a change.

See [the roadmap](docs/roadmap.md) for scope and
[the architecture notes](docs/architecture.md) for boundaries. Vercel deployment
and a custom domain are reserved for the release milestone.
