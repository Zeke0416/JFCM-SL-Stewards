# JFCM SL Stewards — inspected baseline

Inspection date: 2026-11-06 (Asia/Manila). Scope: local source orientation and development setup, not a full financial/security audit or runtime certification.

## Project map

React and TypeScript finance application built with Vite and Tailwind. Uses Supabase, React Router, Recharts, ExcelJS, SheetJS, and Zod as declared dependencies.

`src/main.tsx` is the browser entry. `src/App.tsx` composes AuthProvider, ThemeProvider, HashRouter, and session-protected routes. `src/contexts/AuthContext.tsx` retrieves the Supabase session and subscribes to auth changes. `src/lib/supabase.ts` creates the shared client from Vite environment configuration.

- `src/pages/`: dashboard, transactions, reconciliation, mission readiness, cooperative ledger, exports, tithers, missionary reporting, financial setup, administration, login.
- `src/components/`: layout, transaction creation/review/detail/history, duplicate scanning, diagnosis, dashboard widgets.
- `src/types/database.types.ts`: application data types; these are not proof of the live database schema or policies.
- `src/utils/exportLogsToExcel.ts`: spreadsheet export helper.

## Before development

- The root README remains the React/Vite starter template.
- `package.json` declares dev, build, lint, and preview scripts, but no test script. Build/lint and runtime checks were not run during this setup task.
- No local Supabase migration directory was found in the inspected repository. Obtain a reviewed schema/policy baseline before changing backend behavior.
- ProtectedRoute checks session presence. Backend authorization and church isolation require separate verification.
- TransactionModal performs an audit insert and transaction update as separate requests. Atomicity and handling of audit-write failure need review before modifying this flow.
- Reconciliation contains substantial parsing and matching logic, including cents-based comparisons and component matching. Use anonymized workbook fixtures before changing it.
- Graphify emitted no symbols for `postcss.config.js`, `src/main.tsx`, `src/vite-env.ts`, and `vite.config.ts`; consult these files directly when needed. CSS is outside this code graph.

## Knowledge tools

Open `graphify-out/obsidian/` as its own vault in Obsidian. Use the generated index and canvas to navigate code relationships; keep these handwritten notes outside generated output.

From this repository root:

```powershell
graphify query "Reconciliation"
graphify extract . --code-only --no-cluster --max-workers 2
graphify cluster-only . --no-label
graphify export obsidian
graphify export html
```

These commands index code locally; docs and images are excluded from semantic extraction. No external LLM extraction tokens are used. Generated output lives in the working tree and may appear in `git status`; choose deliberately which artifacts to commit. No automatic Git hooks are installed.


## Stewards interface redesign — 2026-11-09

Implemented the approved institutional green direction using the existing React/Tailwind/Lucide/Recharts stack. Added Source Sans 3 and Source Serif 4 with system fallbacks; shared neutral surfaces, larger supporting labels, readable table typography, consistent dark surfaces, and reduced-motion support across routes and transaction dialogs. No dependencies or backend schema changes.

Login now has a split composition, a finite ledger-line drawing and entrance sequence, a compact mobile layout, visible field labels, password visibility control, accessible saved-account buttons, and inline status/error feedback. Existing authentication and lockout handling remain in place.

The workspace has a deep green navigation rail, instant theme switching, active-page semantics, a working skip link, and keyboard focus containment for navigation/command/sign-out overlays. Removed simulated theme progress, ambient console decoration, and unsupported Online/Live Sync/Fully Audited claims.

Dashboard now uses a structured financial summary with stationary currency figures, finite entrance/chart reveals, visible reminder lists, recent activity, budget progress, and a Recharts comparison with keyboard controls and a data table. The missionary reminder now targets the existing missionary-report route. Transactions use compact filtered totals instead of decorative animated sparklines and keyboard-sortable table headings. Reconciliation exposes import, account comparison, and record-review stages without changing matching or money logic. Supporting routes and dialogs share the updated visual vocabulary; their underlying workflows are retained.

Validation: production build passes with a large-bundle advisory. Local browser smoke checks use synthetic sessions/records and intercepted backend requests; no live financial data or credentials are copied into fixtures. Desktop/mobile checks cover all application routes; primary checks cover login, password visibility, reduced motion, dashboard totals, chart controls/table, theme switching, and mobile navigation. See tests/README.md. Lint comparison against HEAD initially showed 71 baseline warnings versus 69 current warnings, with no new warning signatures; final validation is reported in the chat.

Limits: live sign-in, server permissions, writes, exports, and uploaded Excel reconciliation were not integration-tested. Generated graph output still describes the prior source revision; refresh it before relying on it for subsequent structural questions. Remote fonts require network access; system fallbacks remain available. Preview screenshots use synthetic data only and are kept outside project notes.


## Full interface revision — 2026-11-09

Supersedes the first redesign's predominantly green institutional treatment. The requested direction is a technical graphite/silver workspace with restrained cyan/bronze accents, a custom navigation spine and peso-specific finance glyphs. Interface typography uses IBM Plex Sans, Manrope and IBM Plex Mono, with system fallbacks. No application dependencies added.

System inventory and implementation:

- All 11 routes were included in source and browser review. Original native dropdowns were replaced by the shared Select control: keyboard navigation, searchable long lists, selected/disabled states, viewport-aware popups and native required-field validation. Input and textarea styling covers normal, focused, disabled and invalid states. Itemized member suggestions use an accessible free-text combobox.
- Shared DialogLayer is used throughout page overlays and standalone dialogs. It provides portal placement, modal semantics, stacking, keyboard focus containment, focus restoration, Escape dismissal where appropriate and document scroll locking. Forced-password and busy states retain their restrictions. Browser alert/confirm calls were replaced with application notifications and cancel-first confirmation dialogs.
- Login and dashboard now contain continuous CSS/SVG orbital ledger scenes with a peso centerpiece. A persistent motion toggle pauses the loops; reduced-motion mode renders static scenes. Actual financial figures remain stationary. Full-screen theme transitions were restored, with input blocking and focus restoration. Session loading also has a branded full-screen state.
- Transactions now use grouped ledger rows, evidence/reference states, custom peso/ledger glyphs, compact audit detail, mobile record cards, 12-row pagination and explicit ordering. Type sorting now correctly compares the second transaction rather than comparing the first transaction to itself. Browser checks cover this regression. The duplicate scanner's matching logic is unchanged; its presentation is an expandable compact comparison panel.
- Transaction creation/editing has a summary rail and grouped record/account/purpose fields. Detail and review dialogs were rebuilt as financial-document layouts with separate accountability information. Existing amount masking, itemization, duplicate warning, review-before-save, conversion prompts and save/audit calls are retained.
- Reconciliation retains its import/compare/review stages and matching logic. Export configuration/preview, cooperative balances/passbook, member directory, financial setup tabs, administration tabs and readiness panels use the shared hierarchy and controls. Ministry-report tables become labelled service/project cards on phones.

Validation: production build passes (large main-bundle advisory remains). Lint exits successfully with 63 warnings versus 69 before this revision. Dependency-free local browser checks use intercepted synthetic backend responses and assert zero backend writes. They cover every route at desktop/mobile widths in both themes, tablet dashboard layouts, continuous/pause/reduced motion, the full-screen theme overlay, dropdown search/selection, member autocomplete, transaction entry/review/detail, pagination, type sorting, and cancellation of a destructive confirmation. Preview-only names replace source defaults before reporting screenshots are captured. No records or environment values are included in these notes.

Limits: no live authentication, financial saves, database permissions, workbook exports or real Excel matching were integration-tested; no deployment was performed. Graph output predates these source changes and remains a navigation aid only. External font requests may fall back to system fonts. See tests/README.md for the local verification harness.

## Church stewardship refinement — 2026-11-09

Supersedes decorative peso imagery and the summary rail described above. The official church logo is now the centerpiece of the existing continuous orbital motion on login, dashboard and full-screen loading/theme states. Its original PNG is preserved; CSS applies a silver treatment. Currency remains beside financial amounts and in chart context, rather than being used as branding. Wording emphasizes honesty, integrity and accountability before God and the church.

Removed duplicate workspace-role and account-initial displays. Sidebar groups have icons and divider rules; desktop collapse and mobile navigation remain available. Dashboard typography and card spacing are more compact. Budget progress returns to three columns on desktop, two on intermediate widths and one on phones.

Transaction entry now places Record details, Account & reference, and People & purpose in three left-hand sections, with amounts/itemization in a separate right-hand column. A fixed action footer remains reachable; small screens and long itemized entries can scroll. Existing validation, review and financial save behavior is retained.

Fixed a hardcoded body text utility that overrode dark-mode inheritance. Shared surfaces/text/action tokens now govern legacy utility colors, and light-mode orbital lines have their own contrast treatment. Added finite page reveals, moving tab indicators, button hover/press states and busy indicators; ongoing ambient motion still supports pause and reduced motion. No financial amounts animate.

Validation uses synthetic records only: all routes at desktop/mobile sizes in both themes, three-column budgets, church-logo motion, dark login contrast, a no-scroll standard entry at 1366x768 with visible footer, dropdowns, itemization, review, detail, theme overlay contrast, pagination and type ordering. Production build passes with the existing bundle-size advisory. Lint succeeds with 63 warnings. No live sign-in, saves, exports or backend permission checks were performed; no deployment. User screenshots and their financial/member content were not copied into fixtures or these notes.

Follow-up refinements: the three transaction detail groups now share one outlined card with internal dividers. Remaining emerald focus/icon/type accents inside transaction entry use slate-blue styling. Desktop sidebar collapse keeps the same icon and group geometry throughout, clips labels within the moving rail, fades labels out before shrinking and delays their reveal during expansion. This avoids display:none layout jumps and text/icon collisions. Mobile navigation retains its separate drawer behavior; reduced-motion mode disables these transitions.

## Compact transaction workspace and reference dialogs — 2026-11-09

Collapsed desktop navigation now closes group-heading/purpose heights and margins as well as labels; icons keep their horizontal position while their groups move into one continuous list. Expanded groups remain separated. Replaced the transaction category-warning banner with an expandable review queue that preserves each affected entry and its edit action; duplicate summary is compact until opened. Type tabs, search, period and audit toggle share one desktop toolbar and wrap on mobile.

Rebuilt the category guide as an account directory with short examples, a search field and animated type selection. Audit history now uses responsive event rows with actor/time metadata and recorded details; existing fetch, change comparisons and Excel export logic are retained. Export preview totals have equal padded rounded cells. Removed remaining emerald accents in these affected views, corrected malformed icon color utilities and dark primary-button contrast, and aligned chart colors to the slate-blue palette.

Restored zero-to-total animation for dashboard and transaction summary amounts using the existing AnimatedNumber component, with a one-second eased sequence, cancellation on replacement/unmount, exact final cents, standard PHP currency formatting and immediate final values for reduced motion. Financial calculations and persisted amounts are unchanged. Dialog openings, record-filter changes, segmented selection and button feedback have explicit CSS animations rather than relying on unavailable utility animation classes.

Validation uses synthetic backend interception only; no user screenshots or their records are copied into tests. Browser coverage adds collapsed-group gap checks, compact toolbar height, the review queue, audit/guide desktop and mobile, visible amount-icon contrast and counter completion. Build passes with the existing bundle-size advisory. Lint succeeds with 63 warnings. Live financial saves, authentication and workbook exports remain outside this UI verification; no deployment.

## Consistency sweep and switching motion — 2026-11-09

Transaction entry, Administration and Financial Setup now use one equal-width switch control with a visible sliding selection panel. Transaction type changes remount only the form presentation, while existing state handlers retain their behavior. Tab panels have a short finite transition; rapid changes replace the old panel and reduced-motion disables these effects. Browser checks measure the indicator while it is moving rather than merely checking that an animation class exists.

Church Tithers now has consistent directory/review surfaces, aligned counts, uniform member rows, visible keyboard-accessible remove controls and restrained follow-up markers. Search/add inputs share the common input treatment. Status and matching logic are retained; follow-up wording does not imply that an unmatched record proves a missing contribution.

Monthly ministry worship services now use a responsive labelled grid instead of mixed-height table controls. Message/preacher fields, objective, scripture and attendance share spacing and aligned top edges. Objective height matches the stacked message/preacher controls, attendance fields sit side by side, and phone layouts stack cleanly. Internal placeholder date codes display as service weeks; persisted values are unchanged. Project fields use consistent table padding and heights. Missing approved-budget values in Administration display as Not set rather than NaN.

Source review covered all route files and dialog implementations. Remaining emerald presentation utilities were aligned to the established blue palette, hardcoded grayscale dark surfaces use shared surface/border tokens, and primary-action contrast remains consistent. Financial calculations, member matching, authorization and persistence workflows are unchanged.

Verification: production build passes with the existing bundle advisory; lint succeeds with 63 warnings. Synthetic browser checks cover all 11 routes at desktop/mobile widths in both themes, primary dialogs, new transaction/admin switching motion and ministry input alignment. No user screenshot records or credentials are stored in fixtures/notes. Live writes, authentication, exports and destructive operations remain untested; no deployment.

## Theme-bound cards and transaction row details — 2026-11-09

Dashboard orbital motion now uses a separate light treatment: pale surfaces, dark readable ticket labels, stronger blue orbital lines and a silver church-logo medallion. Dark mode retains the existing graphite presentation; loop timing and motion preferences are unchanged.

Administration card backgrounds and Export Center configuration surfaces now use their shared tokens without conflicting structural background utilities. Legacy primary actions in both routes explicitly use the action/hover tokens, including their dark variants, instead of depending on a previously generated brand utility.

Clicking a transaction row's non-interactive cells opens the existing Details dialog. Buttons, links and other controls are excluded, so Edit/Delete retain their own actions; the title button remains the keyboard-accessible Details control. Missing payee names display the actual full transaction ID instead of a generic label, and the detail reference is also untruncated. Long IDs wrap within desktop/mobile layouts. Financial data and write workflows are unchanged.

Checks use synthetic records, including an unnamed transaction with a synthetic UUID. Browser assertions cover clicking the date cell, full ID display, separate Edit behavior, a light dashboard motion surface, Administration surface tokens and exact Administration/Export primary colors. Build passes with the existing bundle advisory; lint succeeds with 63 warnings. Live authentication, saves and workbook exports are not exercised; no deployment.

## Transaction column content — 2026-11-09

Transaction table/card identity now shows the ComBud account name and account number underneath. Remarks move to the existing Account column; Evidence is renamed Receipt, including mobile labels. The Transaction heading sorts account names and Account sorts remarks, matching their displayed content. Row Details and action buttons retain their behavior; full IDs remain in audit/detail metadata. Only presentation and corresponding sort keys changed. Build passes; lint succeeds with 63 existing warnings. Browser fixtures assert the new content mapping and heading without saving data.

## Financial Setup presentation and entry-type colors — 2026-11-09

Financial Setup's three panels now use a dedicated shared-token surface instead of legacy background utilities. Financial years use a compact table with clear year, budget, status and action hierarchy; phones render labelled rows. Category targets use a compact type/search toolbar, animated Income/Expense selection, account-code badges and consistently sized right-aligned amount fields. Target rows also become labelled cards on phones. Missing base budgets display as Not set, and entering edit mode tolerates a missing value without inventing a saved amount. Reset controls have aligned fields, a restrained red boundary and themed disabled styling; confirmation requirements and handlers are unchanged.

Transaction type selection now uses blue for receipt and amber for disbursement, matching the ledger's semantic distinction. Inactive labels retain their corresponding accent, and the moving selected panel changes color with the type; reduced-motion still suppresses movement.

Validation uses synthetic records only, covering Financial Setup Years/Budget/Reset in both themes, desktop/mobile target and reset layouts, base-budget edit/cancel, category-type filtering, disabled reset without confirmation, blue save controls and the amber disbursement indicator. Build passes with the existing bundle advisory; lint succeeds with 63 warnings. No financial save, reset, live authentication or export is submitted; no deployment.

## Saved ledgers, church identity and user photos — 2026-11-09

Reconciliation now saves one original Excel workbook per church and financial year in reconciliation_workbooks. Original bytes are base64 encoded for an atomic row replacement together with filename, size, uploader UUID and server upload timestamp. Maximum original file size is 10 MiB. Returning to the page restores the saved workbook automatically; changing months in the same year reuses it, while changing years loads that year's source. Upload newer ledger replaces only that source copy; it does not import, change or delete transactions. The current preview is retained if a save cannot be confirmed; retry-loading resolves a possible lost response. Database-rejected writes preserve the prior stored copy. Previously ephemeral uploads must be uploaded once using the new control.

The new table's SELECT/INSERT/UPDATE policies require active personnel in the same church, and writes verify that the financial year belongs to that church. The database stamps uploader/time and grants no client DELETE permission. Uploader UUIDs remain as audit metadata without blocking subsequent profile removal. The idempotent migration was applied to the configured Stewards project using the authenticated CLI; Koinonia was not changed. PostgreSQL permission checks used synthetic source content inside a rolled-back transaction; no verification ledger remains.

Administration Personnel now lets admins add, replace or remove a photo for each user. JPEG/PNG/WebP inputs up to 5 MiB are center-cropped/resized to a 256px JPEG before saving. The bounded, nullable profiles.avatar_data_url field is protected by the existing church-scoped admin UPDATE policy and JPEG/size constraints; no policy was broadened. This migration is also applied. Database checks confirm admin update/removal, non-admin denial and invalid-format/size rejection, with all test updates rolled back. Original photos, credentials and member records are never written into project notes or fixtures.

The full church name supplied by the user appears on sign-in and the workspace footer. The sign-in logo/name is a static brand block; its old #login-form link was incorrectly interpreted as an application route. Transaction account names are plain text, the duplicate eye action is removed, and the whole row supports pointer activation plus Enter/Space while Edit/Delete remain separate. Gradients are limited to filled blue primary actions; neutral, destructive and sorting controls retain their flat styling.

Validation: standalone workbook tests preserve original xlsx/xls bytes, cents, duplicate rows and month sheets; focused mocked browser checks cover saved-ledger reload/replacement/year isolation/failures and photo resize/reload/replacement/removal/admin controls. Full visual smoke checks cover all routes in both themes and viewport layouts. Production build passes with the existing large-bundle advisory; lint succeeds with 63 warnings. No real ledger or photo has been populated by these tests, and no financial transaction was changed. Database schema changes are live; frontend changes remain in this checkout/local preview, with no frontend deployment.

## Avatar reuse and dashboard motion/graph refinement — 2026-11-09

Added a shared UserAvatar view with a neutral fallback for missing or unreadable images. The saved encoder photo is now included in Transactions' existing bulk profile lookup and in Reconciliation's profile enrichment, so Transaction Details can show the same photo under Entered by without extra per-row requests. The signed-in user appears once in the sidebar footer with photo, name and role. A local profile-photo update event refreshes the signed-in photo immediately after an admin changes/removes it; another user's photo does not replace the current account. The footer image stays horizontally anchored while labels fade during desktop collapse.

Dashboard Review-card positioning now reserves clear horizontal space beyond the church-logo medallion. Its compact width and wider scene preserve clearance without increasing the summary-card height significantly. Browser checks sample animation endpoints and the midpoint at 320, 390, 768, 1024 and 1440px, requiring at least 14px between the Review card and the logo bounds and keeping the card inside its panel. Login's motion composition is unchanged.

The income/expense chart now uses monotone cubic curves, separate gradient fills and gradient line treatments. Monotone interpolation passes through the monthly values without adding extra local extrema. Continuous light sweeps and a restrained dashed-line flow add motion to the styling, not the financial coordinates. A shared motion-context hook connects the chart to the existing pause setting; reduced-motion preferences disable both the ambient chart animation and entry drawing. Exact figures remain available in the table/tooltips.

Validation: full synthetic browser checks pass across routes/themes, with additional geometry, curved-path/gradient and pause/reduced-motion assertions. Focused persistence/photo checks confirm immediate sidebar updates, encoder-photo reuse and Details' Entered by photo. Production build passes with the existing bundle advisory; lint succeeds with 63 warnings. No new database change or frontend deployment was performed for this refinement; verification uses synthetic data only. Generated graph output remains older than current source.

## Chart axis labels and visible income-line motion — 2026-11-09

The chart's vertical axis now uses compact, single-token numeric labels without repeated currency prefixes, with a consistent axis width. Currency context remains in the subtitle, exact-value table and tooltip. Income now has a travelling light-trace layer over its unchanged smooth line, making continuous movement more visible. The decorative overlay is excluded from tooltip/legend data and is removed when paused or reduced motion is requested. Stroke gradients use chart-space coordinates so flat series remain drawable.

Validation covers moving stroke offsets, single-line currency-free axis text, no duplicate tooltip amounts, and pause/reduced-motion removal of the tracer. Build passes with the existing bundle advisory; lint succeeds with 63 warnings. No financial values, database records or deployment changed.

## Stewardship guide and personnel sign-in visibility (2026-11-09)
- Dashboard stewardship illustration is a keyboard-accessible button opening the shared focus-managed dialog with Record, Review and Report guidance; existing looping artwork is preserved.
- Personnel shows admin-only last login in Asia/Manila with refresh, loading, unavailable and no-record states. Additive admin_personnel_last_logins RPC reads auth timestamps, checks active admin and scopes profiles to the caller church; no authentication data is writable through this function. Migration applied to the verified Stewards project.
- Production build and lint pass (existing warnings remain). Rollback-only database checks verify scope, timestamp source, and non-admin/anonymous denial without returning personal records. Frontend deployment remains separate.
