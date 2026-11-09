# Graph Report - jfcm-sl-stewards  (2026-11-06)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 302 nodes · 609 edges · 23 communities (15 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9cafcf2a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19

## God Nodes (most connected - your core abstractions)
1. `lucide-react` - 27 edges
2. `react` - 27 edges
3. `useAuth()` - 25 edges
4. `compilerOptions` - 18 edges
5. `supabase` - 17 edges
6. `Reconciliation()` - 16 edges
7. `AppRoutes()` - 15 edges
8. `compilerOptions` - 15 edges
9. `react-dom` - 14 edges
10. `Transactions()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `AppRoutes()` --calls--> `Dashboard()`  [EXTRACTED]
  src/App.tsx → src/pages/Dashboard.tsx
- `AppRoutes()` --calls--> `Reconciliation()`  [EXTRACTED]
  src/App.tsx → src/pages/Reconciliation.tsx
- `AppRoutes()` --calls--> `Transactions()`  [EXTRACTED]
  src/App.tsx → src/pages/Transactions.tsx
- `Transactions()` --calls--> `AnimatedNumber()`  [EXTRACTED]
  src/pages/Transactions.tsx → src/components/AnimatedNumber.tsx
- `Reconciliation()` --calls--> `TransactionDetailModal()`  [EXTRACTED]
  src/pages/Reconciliation.tsx → src/components/TransactionDetailModal.tsx

## Import Cycles
- None detected.

## Communities (23 total, 8 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (32): react, react-dom, App(), AppRoutes(), ProtectedRoute(), ForcePasswordChangeModal(), Props, Layout() (+24 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (30): runs-on, steps, environment, needs, runs-on, steps, VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_URL (+22 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (25): CategoryGuideModal(), CategoryGuideModalProps, EnrichedTransaction, TransactionDetailModal(), TransactionDetailModalProps, amountInCents(), buildDuplicateCandidate(), dateDistanceInDays() (+17 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (24): EnrichedTransaction, TransactionModal(), TransactionModalProps, ReviewData, TransactionReviewModal(), TransactionReviewModalProps, AuditLog, Church (+16 more)

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (23): BreakdownItem, COMBUD_EXPECTED_TYPE_BY_LABEL, COMBUD_EXPORT_CODE_BY_LABEL, COMBUD_HEADER_ALIASES, COMBUD_KNOWN_ALIAS_CODES, EnrichedTransaction, EventDateClue, ExcelRecord (+15 more)

### Community 5 - "Community 5"
Cohesion: 0.17
Nodes (13): lucide-react, AnimatedNumber(), ActionAlerts(), ActionAlertsProps, ReminderInfo, MetricsCards(), TargetMonitor(), TrendChart() (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (16): dependencies, clsx@^2.1.1, date-fns@^4.4.0, lucide-react@^1.42.0, react@^19.2.8, react-dom@^19.2.8, react-router-dom@^7.18.3, @supabase/supabase-js@^2.115.0 (+8 more)

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (15): devDependencies, autoprefixer@^10.5.5, oxlint@^1.79.0, postcss@^8.5.28, tailwindcss@^3.4.19, @types/file-saver@^2.0.7, @types/react-dom@^19.2.4, typescript@~6.0.2 (+7 more)

### Community 10 - "Community 10"
Cohesion: 0.22
Nodes (8): exceljs@^4.4.0, file-saver@^2.0.5, name, private, type, version, exceljs, file-saver

### Community 11 - "Community 11"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 12 - "Community 12"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 13 - "Community 13"
Cohesion: 0.40
Nodes (4): vite@^8.2.2, @vitejs/plugin-react@^6.1.0, vite, @vitejs/plugin-react

### Community 14 - "Community 14"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

## Knowledge Gaps
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `lucide-react` connect `Community 5` to `Community 0`, `Community 2`, `Community 3`, `Community 4`, `Community 8`, `Community 10`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1207843137254902 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Community 0` to `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 8`, `Community 10`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06881720430107527 - nodes in this community are weakly interconnected._
- **Why does `react-dom` connect `Community 0` to `Community 2`, `Community 3`, `Community 5`, `Community 8`, `Community 10`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12315270935960591 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.0873015873015873 - nodes in this community are weakly interconnected._