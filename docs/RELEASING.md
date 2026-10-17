# Releasing @solvfast/ui

The owner publishes, with their own token. Nothing in this repository pushes, tags or publishes on its own.
`npm publish` runs `prepublishOnly` = `scripts/prepublish-check.mjs`, then a full build, then the tests. The check refuses
unless:
- the working tree is clean;
- `HEAD` is tagged `v<version>`;
- LICENSE states a decided licence;
- no tracked file holds a credential.

The package workflow is the one `@solvfast/design-system` 0.3.0 used: GitHub Packages, organisation `solvfast`,
private, a classic token in `NODE_AUTH_TOKEN`.

## 0.1.0 — status

| | Item | State |
|---|---|---|
| ✅ | Name and registry | `@solvfast/ui` → `https://npm.pkg.github.com` (`publishConfig`, so `npm publish` cannot reach public npm). The scope equals the GitHub owner `solvfast`, as GitHub Packages requires; `repository` = `solvfast/solvfast-ui` links the package to the repo |
| ✅ | Version | `0.1.0` in `package.json`; CHANGELOG `[0.1.0]` |
| ✅ | Authentication | `.npmrc` (committed, no secret) maps `@solvfast` to GitHub Packages and reads the token from `${NODE_AUTH_TOKEN}`. npm never packs `.npmrc` |
| ✅ | Contents | `dist/`, README, LICENSE, THIRD-PARTY-NOTICES, CHANGELOG, VENDORED and the user docs. The package audit (in every `npm run build`) fails on: repository-only folders (`showcase`, `playground`, `tests`, `e2e`, `tools`, `upstream`, `scripts`); an `.npmrc`; a credential; an absolute local path |
| ✅ | Rights and notices | Owner confirmation (2026-10-17): Solvfast owns the code derived from the Design System, Sear and PMO, glass engine included. Third-party notices (THIRD-PARTY-NOTICES.md): shadcn/ui, Tailwind CSS preflight, tailwindcss-animate (all MIT). In the repository only (not the package), Frappe's `todo.json` copy has Frappe's MIT licence beside it |
| ⛔ | **Licence** | **Not decided — the one blocker.** See step 1 |
| ⏸ | Frappe layer on a real site | Deferred until the first real-project integration (simulated-request tests passed) |

## 1. Decide the licence (owner) — then one commit

Who may use the package?

**A. Only Solvfast and those it authorises** (fits a private package):
- `LICENSE`:
  ```
  Copyright (c) 2026 Solvfast. All rights reserved.

  This software is proprietary to Solvfast. It may be used, copied or modified only by Solvfast
  and by those Solvfast authorises.

  Parts of this package come from third-party software and remain under their own licences;
  see THIRD-PARTY-NOTICES.md.
  ```
- `package.json`: `"license": "UNLICENSED"`.

**B. Anyone (open source)**, e.g. MIT:
- `LICENSE`: the MIT text with `Copyright (c) 2026 Solvfast`.
- `package.json`: `"license": "MIT"`.

Either way:
- keep THIRD-PARTY-NOTICES.md;
- replace the "Licence" section of README.md;
- add a CHANGELOG line under `[0.1.0]`;
- then commit:
```sh
git add LICENSE package.json README.md CHANGELOG.md && git commit -m "Licence for 0.1.0"
```

## 2. Prepare and check — local, no GitHub access needed

```sh
cd /home/frappe/solvfast-ui
npm ci                                   # dependencies, exactly as locked
npm run typecheck && npm run build && npm test
npm pack --dry-run                       # the file list that will be published
npm run showcase:build                   # optional: the component showcase still builds
git status                               # must be clean
git tag v0.1.0                           # on the licence commit
node scripts/prepublish-check.mjs        # must print "✔ ready to publish @solvfast/ui@0.1.0"
```

## 3. Push and publish — needs GitHub access (owner)

One-time checks on github.com:
- Your token: Settings → Developer settings → Personal access tokens → **Tokens (classic)**, with
  **`write:packages`**, as for the Design System 0.3.0 publish. GitHub Packages' npm registry does not accept
  fine-grained tokens. If `solvfast` uses SSO: *Configure SSO → Authorize*.
- Organisation `solvfast` → Settings → Packages: members may publish **private** packages.

```sh
cd /home/frappe/solvfast-ui
git remote add origin https://github.com/solvfast/solvfast-ui.git
git push -u origin main
git push origin v0.1.0
export NODE_AUTH_TOKEN=<classic token with write:packages>   # in this shell only; never in a file in the repo
npm publish                                                   # runs the guard, the build and the tests first
```

The repository's `.npmrc` takes precedence over `~/.npmrc` for `npm.pkg.github.com`, so the token must be exported in
the shell that publishes. A version number can be published only once; fixes ship as `0.1.1`.

After the first publish, on github.com → `solvfast` → Packages → `ui` → **Package settings**:
- **Visibility: Private.** Never make it public unless the licence (step 1) is open source.
- **Access:**
  - keep *Inherit access from source repository* on, so anyone who can read `solvfast/solvfast-ui` can install it;
  - add other people or teams under *Manage access*;
  - add each repository whose GitHub Actions installs the package under *Manage Actions access*.

Check the published package from a scratch folder that has the `.npmrc` from step 4 and a `read:packages` token:
```sh
npm view @solvfast/ui@0.1.0 version dist.tarball      # 0.1.0, a URL on npm.pkg.github.com
```

## 4. Install in another project (every developer)

1. A classic token with **`read:packages`**. Your account needs read access to the package; with the defaults above,
   read access to `solvfast/solvfast-ui` is enough. If the organisation uses SSO, authorise the token for it.
2. In your shell profile or CI secrets, never in the project:
   ```sh
   export NODE_AUTH_TOKEN=<your read:packages token>
   ```
3. In the project, `.npmrc` next to `package.json`. Commit it: it holds no secret.
   ```ini
   @solvfast:registry=https://npm.pkg.github.com
   //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
   ```
4. Install:
   ```sh
   npm install @solvfast/ui@0.1.0          # or yarn add / pnpm add
   ```
5. Use it. Full guide: [CONSUMING.md](CONSUMING.md). With Tailwind 3:
   - `tailwind.config.js`: `presets: [sfPreset]` (`import sfPreset from "@solvfast/ui/tailwind-preset"`), and add
     `"./node_modules/@solvfast/ui/dist/**/*.js"` to `content`;
   - `src/index.css`: the three `@import "tailwindcss/…"` lines, then `@import "@solvfast/ui/theme.css";`;
   - `main.tsx`: `import "./index.css"; import "@solvfast/ui/glass.css";`;
   - render `<ThemeProvider><div className="sf-app">…<Button>Save</Button>…</div></ThemeProvider>`, with imports from
     `"@solvfast/ui"`.

   Without Tailwind: `import "@solvfast/ui/full.css"` instead (CONSUMING.md, path B).

`401`/`403` while installing: the token is not exported in that shell, lacks `read:packages`, isn't SSO-authorised,
or your account has no access to the package.
