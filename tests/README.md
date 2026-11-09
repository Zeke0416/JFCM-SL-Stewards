# Stewards visual smoke check

`ui-smoke.mjs` uses Node's built-in WebSocket and fetch APIs to drive Chrome DevTools; it adds no application dependencies. Use a temporary Chrome profile, not your everyday browser session.

1. Start the app: `npm run dev -- --host 127.0.0.1 --port 5174`.
2. Start headless Chrome with `--headless=new --remote-debugging-port=9333 --user-data-dir=<temporary-profile-path>` (on Windows, launch helpers hidden).
3. Run `node tests/ui-smoke.mjs`.

Optional environment variables: `STEWARDS_BASE_URL` changes the local application URL; `STEWARDS_SCREENSHOTS` changes the screenshot output directory (default: `tests/screenshots`).

The test creates its own tab, supplies a synthetic session and backend records, intercepts remote API requests, and blocks realtime connections. It never signs in to a real account or writes financial data. It checks login controls, reduced motion, dashboard totals, chart controls and table, theme switching, mobile navigation, route overflow, continuous/pause/reduced motion, the full-screen theme transition, searchable dropdowns, member autocomplete, transaction entry/review/detail dialogs, pagination, type sorting, and cancelling a destructive confirmation. Every route is checked at desktop/mobile widths in both themes. It closes its tab after success or failure.

These checks do not certify backend authorization, real authentication, saves, exports, or Excel matching. Inspect those with suitable authorized integration fixtures before changing their behavior.


Set `STEWARDS_CAPTURE_MOTION=true` to additionally capture a sequence of login-animation PNG frames under the screenshot output directory. All test fields and backend responses are synthetic; reporting defaults are replaced with preview-only names before capture. The harness asserts that no backend writes occur.

The stewardship-refinement checks additionally cover dark login text contrast, the church-logo motion asset, removal of redundant profile/currency decoration, three-column desktop budgets, desktop navigation collapse, equal-width animated chart tabs, light-transition orbit contrast, and the 1366x768 transaction editor's two-column layout and visible action footer.
The compact-workspace checks also verify no gaps between collapsed navigation groups, a single-row desktop toolbar, a synthetic unassigned-entry review queue, responsive audit/guide dialogs, visible amount-icon contrast and a counter that settles on exact cents. Count-up respects reduced motion and cancels obsolete animation frames. Screenshots contain only synthetic records.

The consistency sweep adds in-flight indicator checks for transaction type and Administration tabs, Administration System/Categories screenshots, populated synthetic tither status lists and equal-top-edge assertions for ministry service inputs. Service layout coverage includes desktop and mobile; all normal routes remain checked in both themes. No save or destructive action is submitted.

Theme/row regressions additionally check light dashboard motion surfaces, exact dark primary-button colors in Administration/Export, shared Administration card backgrounds, date-cell click opening Details, a synthetic UUID replacing an unnamed transaction label, and Edit not opening Details.

Financial Setup coverage includes all three tabs in both themes, desktop/mobile budget and reset layouts, base-budget edit/cancel, expense filtering and disabled reset confirmation. Transaction entry additionally checks the amber selected disbursement panel; receipt retains blue.

## Saved-ledger and photo verification

- `node tests/saved-ledger.mjs` checks lossless .xlsx/.xls storage, month sheets, duplicate rows, exact cent values and file limits.
- `node tests/saved-ledger-browser.mjs` uses the same temporary Chrome endpoint. All service requests are intercepted. It checks original upload/reload, timestamp restoration, year isolation, replacement, failure recovery and admin photo resizing/reload/removal/permissions. Only mocked workbook/profile writes are allowed. Set `STEWARDS_SCREENSHOTS` to capture the restored-ledger and photo states; all content is synthetic.
- `tests/saved-ledger-rls.sql` and `tests/profile-photo-rls.sql` verify the live policies inside an explicit transaction ending in ROLLBACK. They select authorized identities internally, return only pass/fail results, and leave no test source/photo changes behind. They require the verified Stewards database and an administrative SQL session; never point them at another application's project.

The idempotent source migrations are in `supabase/migrations/`. They have been applied to the configured Stewards project. A new frontend deployment is still required to publish the local UI beyond the development preview. No source credentials or real member/financial fixtures belong in this repository.

Avatar reuse checks cover immediate sidebar photo updates/removal plus matching encoder and Entered by images in Transactions/Details. Dashboard motion checks sample a full animation span at five viewport widths and assert logo/card clearance and panel containment. Chart checks cover cubic paths, independent gradients, looping styling, pause and reduced-motion behavior; synthetic monthly totals retain their original overall sums while varying by month to exercise curved paths.

Chart regressions also verify single-token currency-free axis labels, changing income-trace dash offsets, tracer removal for pause/reduced motion, and exactly two financial tooltip entries when both real series are visible.
