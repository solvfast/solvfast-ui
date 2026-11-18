# @solvfast/ui — Core, Frappe adapters, application

How the package is split, what belongs where, and how an application composes it. Written for engineers building on the
package and for whoever adds to it. (Run 1 I4, 0.8.0-dev.6.)

## 1. The three layers

| Layer | What it is | Where | May import |
|---|---|---|---|
| **Core** | Reusable UI, contracts and behaviour with no backend: primitives, fields, the app shell, the List View and its views, the record page parts, the Lifecycle contract. Framework-free data in, events out. | `@solvfast/ui` (`src/` outside `src/frappe`) | React, Radix, the theme; never React Query, Frappe, a router |
| **Frappe adapters** | Frappe APIs, permissions, workflows, the form engine, server-message handling — Core components driven by a Frappe site (or the in-package simulator). | `@solvfast/ui/frappe` (`src/frappe`), `@solvfast/ui/frappe/testing` | Core, `@tanstack/react-query` |
| **Optional entries** | One optional peer each, never pulled into Core: toasts (`sonner`), charts (`recharts`), forms (`react-hook-form`), the lifecycle diagram (`reactflow` + `@dagrejs/dagre`). | `@solvfast/ui/toast`, `/chart`, `/form`, `/lifecycle-diagram` | Core's theme / primitives / record look + their own peer |
| **Application** | Domain content and business rules: which fields go on which card, wording, routing, stores, mock data, which list columns an entity shows. | the app (e.g. the CRM) | everything above |

`scripts/check-boundaries.mjs` enforces the arrows on every build: Core never reaches the Frappe layer, React Query or
an optional peer; each optional entry reaches only its own peer; nothing outside `src/sayr` imports `./sayr` (out of
scope here).

## 2. Deciding where something goes

1. Does it need a server (a method call, permissions from a site, a workflow definition)? → **Frappe adapter**, wrapping a
   Core component that takes the data as props.
2. Is it the same for every app (a field, a list behaviour, a dialog, a state of a component)? → **Core**.
3. Does it name a domain thing (Deal, Ticket, "Sales User"), or decide wording, columns, routing? → **Application**.
4. Does it need a heavy library most apps do not? → an **optional entry** with an optional peer dependency.

Every addition needs evidence (a Frappe Desk behaviour, a consumer such as the CRM, or the owner's approval), an owner
layer, and a reusable purpose. Shipped-component defects, accessibility, translation and missing tests proceed on Desk
evidence alone; completion without a consumer needs approval (Run 1 decision 1).

## 3. Composing an application

```tsx
<ThemeProvider>                                     {/* Core: theme, language, direction (locale: he / fa / ps read RTL) */}
  <FrappeProvider client={client} boot={boot}>      {/* Frappe: session, translations, formats, boot.lang, server messages */}
    <AppShell brand={…} items={nav} currentPath={path} onNavigate={go}>   {/* Core: skip link, tab title, nav links */}
      <FrappeListView doctype="Deal" create={{}} />                      {/* Frappe list over Core ListView */}
      {/* or a record page composed from Core parts + Frappe adapters (docs/components/record.md §11.5) */}
    </AppShell>
  </FrappeProvider>
</ThemeProvider>
```

- The app keeps routing: Core components take `href` + `onNavigate`; nothing navigates by itself.
- The app keeps vocabulary: labels come in as props or `{ en, ar }`; the package's own chrome strings are en / ar
  (`messages`), and a Frappe site's own words go through `FrappeProvider translations` (`useFrappeTranslate`).
- The app keeps domain rules: `formEvents` (typed form events) replace Desk Client Scripts; the package never evaluates
  arbitrary script.

## 4. What each layer guarantees

| Concern | Core | Frappe adapter |
|---|---|---|
| Accessibility | named landmarks, focus returns to the opener of every dialog, keyboard paths for lists / grids / boards, `aria-required` / `aria-invalid` / descriptions on fields | the same components, wired to the site's rights |
| Language / direction | en / ar chrome, RTL mirroring, `isRtlLanguage` | Desk `__()` via the provider's dictionary; `boot.lang` applied once |
| Data safety | sanitizers rebuild HTML from an allowlist; editors never re-emit untouched content | Desk's save pipeline (validate → mandatory → savedocs → after_save), fields frozen while saving, newer-on-server banner |
| Permissions | none (props decide) | missing information denies (rule 9); the server re-checks everything |
| Real-site evidence | n/a | **simulator-tested only** until the real-site gate (I5) runs |

## 5. Readiness checklist for a new component (Skill readiness)

Before a component is offered to apps (and to an AI skill that composes them):

- [ ] Layer decided (§2) and the boundary check passes.
- [ ] Props are data and callbacks; no fetch, no router, no domain names in Core.
- [ ] en / ar strings in the catalogue (`src/theme/messages-ws/*`); RTL checked; dark and light checked.
- [ ] Keyboard path and accessible names; focus handling for anything that opens.
- [ ] Tests: behaviour + a negative control; Frappe parts on the simulator, marked "real site: pending".
- [ ] Documented in `docs/components/*.md` with its props, the evidence it follows, and what it does not do.
- [ ] Listed in `CHANGELOG.md`; any visible change named as an intended difference for the CRM parity run.
- [ ] If it edits a vendored file, recorded in `VENDORED.md` (re-vendoring overwrites).
- [ ] If it changes generated CSS, the change is in `styles/src/*` (the build regenerates `styles/theme.css`).

## 6. Pointers

- Record page: `docs/components/record.md` §11 (Core), the Frappe RecordPage adapter proposal
  `docs/specs/FRAPPE-RECORDPAGE-BOUNDARY.md` (awaiting the owner's review — no hooks yet).
- List View: `docs/components/list.md`, `docs/specs/LISTVIEW-API.md`.
- Lifecycle: `docs/components/record.md` §9 (contract, rail, Actions menu) and §9.6 (the diagram entry).
- Limits and what still needs a real site: `docs/LIMITATIONS.md`.
