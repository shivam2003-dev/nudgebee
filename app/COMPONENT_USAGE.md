# Component Usage & Composition Guide

**Audience:** developers and AI agents building or redesigning pages with the `component-new/` library.
**What this doc is:** the **"when & how"** layer — which component to reach for in a given UI
situation, and how components compose into complete views.
**What this doc is _not_:** a per-component API reference. Props, variants and "Don't" rules live
in each file's JSDoc header (e.g. [`ds/ListingLayout.tsx`](src/component-new/ds/ListingLayout.tsx)
has a full "Anatomy" block) and in the per-primitive pages of the design-system viewer.

---

## 0. Why this doc exists, and how it's kept current

The design-system viewer and `manifest.json` already answer **"what components exist."** They do
not answer **"which ones do I use for a table view, and how do they fit together."** That gap is
what this doc fills.

**Recommended approach (decided):** a **hand-written guide** (this file). A fully _generated_ doc
was considered and rejected for now — composition recipes ("how to build a table view") encode
human judgement that can't be derived from code, and there is no doc-generator in the repo today.
The longer-term target is a **hybrid**: a generated component index (harvested from the JSDoc
headers) plus these hand-written recipes. Until a generator exists, this file is hand-maintained.

**Keeping it in sync:** this doc only documents _patterns and decisions_, which change rarely.
Per-component props are **not** copied here — always read the component file's JSDoc for those.
When a new recurring composition appears, add a recipe (§2). When two components overlap, add a
decision rule (§3).

---

## 1. Component index — by purpose

`ds/` = design-system primitive (`@components1/ds/*`). `common/` = domain composition
(`@common-new/*`) — an app-specific component built from primitives.

### Layout & page shell

| Component                         | Where   | Use when                                                                    |
| --------------------------------- | ------- | --------------------------------------------------------------------------- |
| `ListingLayout`                   | ds/     | The card shell for any table/listing screen — toolbar + body + footer slots |
| `WidgetCard` · `CustomBorderCard` | ds/     | A plain content card                                                        |
| `CollapsableCard`                 | ds/     | A single collapsible card (one unit — _not_ an accordion)                   |
| `Divider` · `List`                | ds/     | Rules and simple item lists                                                 |
| `BoxLayout2`                      | common/ | Legacy filter-bar + content shell — prefer `ListingLayout` for new work     |

### Tables & data display

| Component                                                                                    | Where   | Use when                                                                                                                      |
| -------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `Table` · `TableCell`                                                                        | ds/     | A **simple** table — plain columns, sorting, no grouped headers                                                               |
| `CustomTable2`                                                                               | common/ | A **complex** table — grouped headers, expandable rows, resizable/sticky columns, pivot, column selector, built-in pagination |
| `Pagination`                                                                                 | ds/     | Pager for a `ds/Table` (CustomTable2 paginates itself)                                                                        |
| `Stat` · `Trend` · `CostCallout` · `Comparison`                                              | ds/     | Metric / KPI / cost / before-after display                                                                                    |
| `Label` · `Chip` · `NBStatusBadge` · `StatusIndicator` · `SeverityIcon` · `IntegrationBadge` | ds/     | Tags, status pills, severity and integration markers                                                                          |

### Content & formatting

| Component                                             | Where | Use when                          |
| ----------------------------------------------------- | ----- | --------------------------------- |
| `Format` (Currency/Number/Memory/Datetime/Text)       | ds/   | Render a typed value consistently |
| `Markdown` · `DiffViewer` · `ConsoleOutput` · `Chart` | ds/   | Rich content blocks               |

### Forms & inputs

| Component                                                           | Where | Use when                               |
| ------------------------------------------------------------------- | ----- | -------------------------------------- |
| `TextField` · `SearchInput` · `Checkbox` · `Switch` · `ToggleGroup` | ds/   | Standard form controls                 |
| `Select` · `MultiSelect` · `Autocomplete`                           | ds/   | Value pickers (one / many / typeahead) |
| `DateRangePicker`                                                   | ds/   | Date and date-range input              |

### Navigation & filtering

| Component                        | Where | Use when                              |
| -------------------------------- | ----- | ------------------------------------- |
| `Tabs`                           | ds/   | In-page tab switching (state-only)    |
| `PageTabs`                       | ds/   | Route-aware top-of-page tabs          |
| `Stepper`                        | ds/   | Multi-step progress indicator         |
| `Link`                           | ds/   | Navigation link                       |
| `FilterGroup` · `FilterDropdown` | ds/   | Filter controls for a listing toolbar |
| `AutoRefresh`                    | ds/   | The auto-refresh interval control     |

### Actions, feedback, overlays

| Component                                                                      | Where | Use when                                      |
| ------------------------------------------------------------------------------ | ----- | --------------------------------------------- |
| `Button` · `DropdownMenu`                                                      | ds/   | Buttons and action menus                      |
| `Banner` · `Toast`                                                             | ds/   | Inline page banners / transient notifications |
| `EmptyState` · `Skeleton` · `ProgressBar` · `ProgressLinear` · `ErrorBoundary` | ds/   | Empty / loading / progress / error states     |
| `Modal` · `Dialog` · `Popover` · `Tooltip` · `Inspector`                       | ds/   | Overlays (see §3 for which is which)          |
| `DiffCard` · `SourceCitation` · `StreamingIndicator` · `ConfidenceIndicator`   | ds/   | AI / agentic surfaces                         |

---

## 2. Composition recipes

### 2.1 Recipe — Table / listing view ⭐ worked example

The standard table screen (recommendations, inventory, audit lists). Built from a **shell**
(`ListingLayout`) with primitives slotted in, plus a **table** in the body.

**Anatomy** (from [`ds/ListingLayout.tsx`](src/component-new/ds/ListingLayout.tsx) — read its JSDoc):

```
ListingLayout                     ← card chrome (WidgetCard inside)
├── ListingLayout.Toolbar         ← sticky header: title + filters (left) + actions (right)
│     ├── FilterDropdown / SearchInput / Chip   (left, filter widgets)
│     ├── ListingLayout.ToolbarSpacer           (pushes the rest right)
│     └── Button / AutoRefresh / DropdownMenu   (right, action cluster)
├── ListingLayout.Body            ← the table
│     └── Table  *or*  CustomTable2
└── ListingLayout.Footer          ← Pagination  (omit when CustomTable2 paginates itself)
```

**Code skeleton:**

```tsx
import { ListingLayout } from '@components1/ds/ListingLayout';
import { Button } from '@components1/ds/Button';
import { AutoRefresh } from '@components1/ds/AutoRefresh';
import FilterDropdownButton from '@components1/ds/FilterDropdown';
import CustomTable2 from '@common-new/tables/CustomTable2';

<ListingLayout id="recommendations">
  <ListingLayout.Toolbar
    title="Recommendations"
    actions={<><AutoRefresh ... /><Button>Export</Button></>}
  >
    <FilterDropdownButton ... />
    <FilterDropdownButton ... />
  </ListingLayout.Toolbar>

  <ListingLayout.Body padding={0}>
    <CustomTable2 headers={...} tableData={...} loading={...} />
  </ListingLayout.Body>
</ListingLayout>
```

**Pick the table — `Table` vs `CustomTable2`:**

- **Simple table** → `ds/Table` in `Body` + `ds/Pagination` in `ListingLayout.Footer`.
- **Complex table** (grouped/`upperHeaders`, expandable rows, resizable or sticky columns, pivot,
  column selector) → `CustomTable2`. It brings its **own** pagination, empty-state and tabs, so
  put it in `Body` and **omit `ListingLayout.Footer`**. See [§3](#3-decision-rules).

**Don'ts** (from `ListingLayout`'s JSDoc):

- Don't put page-level `Stat` summary cards inside `ListingLayout` — they are siblings _above_ it.
- Don't paginate inside `Body` when using `ds/Table` — pagination is a `Footer` primitive.
- Don't grow `ListingLayout`'s prop API — compose primitives into the slots instead.

### 2.2 Other recipes — to be filled in

Same shape as §2.1 (anatomy → components → skeleton → don'ts). Add each as the pattern is first
built in a real redesign:

| Recipe                   | Likely components                                                            |
| ------------------------ | ---------------------------------------------------------------------------- |
| Dashboard summary row    | `Stat` / `CostCallout` / `Trend` as siblings above a `ListingLayout`         |
| Detail / inspector panel | `Inspector` + `Stat` + `Label` + `Table`                                     |
| Filter bar               | `FilterGroup` / `FilterDropdown` + `SearchInput` + `DateRangePicker`         |
| Form layout              | `WidgetCard` + `TextField` / `Select` / `Switch` + `Button`                  |
| Empty & loading states   | `Skeleton` (loading) · `EmptyState` (no data) · `ErrorBoundary` (error)      |
| Tabbed page              | `PageTabs` (route-aware) wrapping per-tab content                            |
| AI / agentic surface     | `DiffCard` + `SourceCitation` + `StreamingIndicator` + `ConfidenceIndicator` |

---

## 3. Decision rules — overlapping components

When two components could fit, this is which to pick.

| Situation                                                                                          | Use                                 | Not                                                                                 |
| -------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| Simple table — plain columns, sorting                                                              | `ds/Table`                          | `CustomTable2` (overkill)                                                           |
| Complex table — grouped headers, expandable rows, resizable/sticky columns, pivot, column selector | `CustomTable2`                      | `ds/Table` (lacks these — covers ~30% of the surface)                               |
| One collapsible unit                                                                               | `CollapsableCard`                   | `Accordion` ("Don't use Accordion for < 3 rows")                                    |
| 3+ sibling collapsibles                                                                            | `Accordion`                         | stacking `CollapsableCard`s                                                         |
| In-page tab switch (state only)                                                                    | `ds/Tabs`                           | `PageTabs`                                                                          |
| Tabs that drive the URL / route                                                                    | `ds/PageTabs`                       | `ds/Tabs`                                                                           |
| Transient confirmation message                                                                     | `Toast`                             | `Banner`                                                                            |
| Persistent inline page-level message                                                               | `Banner`                            | `Toast`                                                                             |
| Small overlay anchored to an element                                                               | `Popover` (rich) · `Tooltip` (text) | `Modal`                                                                             |
| Centered blocking task                                                                             | `Modal` / `Dialog`                  | `Inspector`                                                                         |
| Side-drawer detail view                                                                            | `Inspector`                         | `Modal`                                                                             |
| Pick one value                                                                                     | `Select`                            | `DropdownMenu` (that's an _action_ menu, not a value picker)                        |
| Trigger an action from a menu                                                                      | `DropdownMenu`                      | `Select`                                                                            |
| Content-shaped loading placeholder                                                                 | `Skeleton`                          | `ProgressLinear`                                                                    |
| Determinate progress (a measured %)                                                                | `ProgressLinear` / `ProgressBar`    | `Skeleton`                                                                          |
| New DS-clean button                                                                                | `ds/Button`                         | `common/NewCustomButton` (legacy, app-styled — co-exists, don't introduce new uses) |

---

## 4. Maintenance

- This doc tracks **patterns**, not props — never copy a prop table here; link the component file.
- Add a recipe to §2 the first time a multi-component view is built in a redesign PR.
- Add a row to §3 whenever a redesign surfaces a "which one do I use?" question.
- Each `ds/*` file should keep an "Anatomy" / "Don't" JSDoc block (like `ListingLayout`) — that
  block is the per-component source of truth this guide points at.

---

_End of guide._
