# Rounza

A thoughtful home for your job search, from the first application to the final round.

**Current scope: milestones 1–6 — hiring journeys, an encrypted portal vault, and a public demo.**
Sign in with Google to save applications, update their details/status, search and
filter your records, and use list or board views. Your overview shows current
counts, next actions, and recently updated applications. Each opportunity supports
custom interview/assessment rounds, rescheduling history, preparation tasks and
contacts. Reusable employer portal accounts are encrypted in the browser and
unlocked with a separate vault passphrase or recovery key. The fictional demo
remains independent. Resume and AI features follow in later milestones.

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

Open [the demo](http://localhost:3000/demo) from the landing page. Start with
Northstar for the fullest example: five hiring rounds, preparation tasks,
notes, a fictional contact, sample portal credentials, and a precomputed AI
analysis. Try rescheduling its portfolio review, completing a task, changing
its status, or adding your own fictional application. The reset button in the
header restores all ten examples after confirmation.

Changes are saved to `sessionStorage` in the current tab, survive reloads, and
are never sent to a server. A fresh independent tab starts its own workspace;
browser duplication/session restoration can copy or restore a tab's data.
Malformed saved data is replaced with a fresh sample. If session storage is
unavailable, the demo stays usable in memory and explains that reloads lose edits.
Use fictional information only: this is not a private account or a secure vault.

**The public demo needs no service accounts or API keys.** Private accounts need a
Supabase project and Google provider configuration. Follow the
[accounts setup guide](docs/accounts-setup.md), which covers environment values,
migrations, both OAuth callbacks, and a real sign-in checklist. Existing setups
must apply all pending migrations with `db push` before starting this version.
See the [tracking guide](docs/application-tracking.md) and
[hiring journeys guide](docs/hiring-journeys.md), and
[employer vault guide](docs/employer-vault.md) for behavior and verification.

Local environment files are ignored by Git. Never commit secrets or place them
in a variable prefixed `NEXT_PUBLIC_`.

## Commands

| Command             | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Start the development server                         |
| `npm run build`     | Create a production build                            |
| `npm start`         | Serve that production build                          |
| `npm run check`     | Check formatting, ESLint, and TypeScript             |
| `npm run format`    | Apply Prettier formatting                            |
| `npm test`          | Run Playwright against the existing production build |
| `npm run test:ui`   | Open Playwright's interactive test runner            |
| `npm run test:unit` | Test configuration, dates, and vault cryptography    |
| `npm run test:db`   | Apply migrations and test database isolation         |
| `npm run verify`    | Check, test, build, and run browser tests            |

Install the test browser once before the first verification:

```sh
npx playwright install chromium
npm run verify
```

On Linux, use `npx playwright install --with-deps chromium` to install system
dependencies too. Tests start and stop production servers on ports 3100 and 3102 and a local auth
fixture on 54329; keep those ports available. `npm test` and `npm run test:ui` require a fresh
`npm run build`. Smoke tests cover desktop/mobile startup, keyboard navigation,
and the 404 return path. Demo tests cover task persistence, list/board filtering,
rescheduling history, closed-journey reminders, notes, tab isolation, reset,
invalid/unavailable storage, and the explicitly simulated AI/credential examples.

## Stack and structure

Next.js App Router, React, strict TypeScript, Tailwind CSS 4, and shadcn/ui.
Dependencies are locked in `package-lock.json`; use `npm ci` for reproducible installs.
ESLint, Prettier, and Playwright provide the initial quality tooling.

```text
src/
  app/              Routes, root layout, metadata, and global styles
  components/ui/    Local shadcn/ui component source
  features/demo/    Fictional data, validated tab state, and interactive screens
  features/applications/  Private records, forms, validation, and server operations
  features/journey/  Rounds, tasks, contacts, schedule history, and next actions
  features/vault/    Browser encryption, portal accounts, and encrypted server operations
  lib/auth/         Verified account reads and server auth actions
  lib/supabase/     Server client, configuration, and database types
supabase/            Versioned schema and row-level access policies
tests/e2e/          Production browser and auth flow tests
tests/database/     Postgres ownership and migration tests
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
build, unit tests, native Postgres isolation tests, and Chromium browser tests on pushes to `main` and pull requests to `main`.
It needs no application secrets. Failed browser runs retain reports for seven days.

The empty repository is bootstrapped on `main` for milestone 1. Use a focused
branch and pull request for each subsequent milestone, keeping `main` buildable.
Run `npm run verify` before publishing a change.

In a restricted desktop sandbox that cannot register filesystem watchers, use
`WATCHPACK_POLLING=true npm run dev`. If the sandbox prevents Chromium from
launching, run the browser suite in GitHub Actions or a normal local terminal.

See [the roadmap](docs/roadmap.md) for scope and
[the architecture notes](docs/architecture.md) for boundaries. Vercel deployment
and a custom domain are reserved for the release milestone.
