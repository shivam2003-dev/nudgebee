/**
 * Table — DS V2 of legacy CustomTable2.
 * Spec:        app/design-system/primitives/navigation/table.html
 * Variants:    selection      = 'none' | 'single' | 'multi'
 *              headerAccent   = 'gray' | 'blue'   (header bottom-border tint)
 *              column.cellType = 'main' | 'main+subtext' | 'label' | 'chip' | 'num' | 'cost' | 'action'
 *
 * Migration:   `import CustomTable2 from '@common/tables/CustomTable2'`
 *           →  `import { Table } from '@components1/ds/Table'`
 *
 *   V1 cell renderers (custom JSX) collapse onto column.cellType variants.
 *   V1 `headers` + `tableData` arrays → V2 `columns[]` + `data[]`.
 *   Pagination stays separate per spec — wrap Table in <Pagination> sibling.
 *
 * Visuals (fixed; no density variant):
 *   - Header background = white; 1px bottom border (brand-500 by default,
 *     blue-200 when `headerAccent='blue'`) acts as the delimiter. Header text
 *     reads in brand-600 (the brand exactly) at semibold.
 *   - Outer container has top + bottom borders only; no left/right rules so
 *     the table breathes against the page surface.
 *   - Row dividers 1px gray-200; cells top-aligned for two-line content.
 *
 * Don't (per spec):
 *   - Don't render custom JSX inside cells when a cellType covers it.
 *   - Don't put > 1 action in the action column — use a 3-dot menu (RowMenu).
 *   - Don't introduce zebra striping. Whitespace + bottom border carry the rhythm.
 *   - Don't use Table for grouped/hierarchical data — that's TreeTable (TBD).
 *   - Don't paginate inside the Table — Pagination is a sibling primitive.
 *   - Don't use the `expandable` accordion for primary navigation. Reach for it
 *     only when the drill-down content is short, in-context, and complementary
 *     (charts, related lists, resolution history). For longer / standalone
 *     detail views, open Inspector via `onRowClick` instead.
 */
import * as React from 'react';
import {
  Box,
  Checkbox,
  Collapse,
  IconButton,
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Label, type LabelTone } from './Label';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

export type TableSelection = 'none' | 'single' | 'multi';
export type SortDirection = 'asc' | 'desc';
export type CellType = 'main' | 'main+subtext' | 'label' | 'chip' | 'num' | 'cost' | 'action';
export type CellAlign = 'start' | 'end' | 'center';
export type TableHeaderAccent = 'gray' | 'blue';

// Generic row type — caller defines their own. Using `unknown` keeps the API safe.
export type TableRow<T extends Record<string, unknown> = Record<string, unknown>> = T & { id: string | number };

export interface TableColumn<T extends TableRow = TableRow> {
  key: string;
  header?: React.ReactNode;
  cellType: CellType;
  /** Sub-text accessor for cellType='main+subtext' */
  subtext?: (row: T) => React.ReactNode;
  /** Tone resolver for cellType='label' */
  tone?: (row: T) => LabelTone;
  /** Override accessor — defaults to `row[key]` */
  accessor?: (row: T) => React.ReactNode;
  /** Custom render — only valid for cellType='action' (per spec) */
  render?: (row: T) => React.ReactNode;
  align?: CellAlign;
  width?: number | string;
  sortable?: boolean;
}

/**
 * Per-row expandable panel ("accordion"). Opt-in: pass `expandable` and the
 * Table renders a chevron at the end of each row that toggles a collapsing
 * panel beneath. Use it for row drill-down content (charts, related lists,
 * resolution history) — NOT for hierarchical / grouped data, which is
 * TreeTable's job.
 *
 * The Table imposes no structure inside the panel — render whatever you want
 * (Tabs, a sub-table, a Chart, etc.). Don't use this as a back-door for
 * grouped data: if every row is expanded by default, you want TreeTable.
 */
export interface TableExpandable<T extends TableRow = TableRow> {
  /** Render the panel content for an expanded row. */
  render: (row: T) => React.ReactNode;
  /** Per-row opt-out — return false to suppress the chevron for that row. */
  isExpandable?: (row: T) => boolean;
  /** Fires when a row's expanded state flips. */
  onToggle?: (row: T, expanded: boolean) => void;
  /** Controlled mode: provide the set of currently-expanded ids. */
  expandedIds?: Array<string | number>;
  /** Render the chevron at the start of the row instead of the end (default 'end'). */
  position?: 'start' | 'end';
}

export interface TableProps<T extends TableRow = TableRow> {
  data: T[];
  columns: TableColumn<T>[];
  selection?: TableSelection;
  /** Tint of the 1px header bottom-border. Defaults to 'gray' (renders brand-navy). */
  headerAccent?: TableHeaderAccent;
  /** Row IDs currently selected (controlled). */
  selectedIds?: Array<string | number>;
  onSelectionChange?: (next: Array<string | number>) => void;
  /** Active sort column + direction (controlled). */
  sortBy?: { key: string; direction: SortDirection };
  onSort?: (key: string, direction: SortDirection) => void;
  onRowClick?: (row: T) => void;
  /** Render skeleton rows instead of data */
  loading?: boolean;
  loadingRowCount?: number;
  /** Empty state config; rendered when `data` is empty and not loading */
  empty?: {
    title: string;
    description?: React.ReactNode;
    illustration?: React.ComponentProps<typeof EmptyState>['illustration'];
  };
  /** Per-row expandable panel. Opt-in. See TableExpandable. */
  expandable?: TableExpandable<T>;
}

const CELL_PADDING = '14px 16px';
const HEADER_PADDING = '12px 16px';
const HEADER_BORDER_COLOR: Record<TableHeaderAccent, string> = {
  gray: 'var(--ds-brand-300)',
  blue: 'var(--ds-blue-200)',
};

function alignToCss(align?: CellAlign): 'left' | 'right' | 'center' {
  if (align === 'end') return 'right';
  if (align === 'center') return 'center';
  return 'left';
}

function defaultAccessor<T extends TableRow>(row: T, key: string): React.ReactNode {
  return row[key] as React.ReactNode;
}

function renderCell<T extends TableRow>(row: T, col: TableColumn<T>): React.ReactNode {
  const v = col.accessor ? col.accessor(row) : defaultAccessor(row, col.key);

  switch (col.cellType) {
    case 'main':
      return (
        <Typography component='span' sx={{ fontSize: 'inherit', color: 'var(--ds-gray-700)' }}>
          {v}
        </Typography>
      );
    case 'main+subtext':
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Typography component='span' sx={{ fontSize: 'inherit', color: 'var(--ds-gray-700)', lineHeight: 1.3 }}>
            {v}
          </Typography>
          {col.subtext && (
            <Typography component='span' sx={{ fontSize: 'var(--ds-text-caption)', color: 'var(--ds-gray-500)', mt: 0.25 }}>
              {col.subtext(row)}
            </Typography>
          )}
        </Box>
      );
    case 'label': {
      const tone = col.tone ? col.tone(row) : 'neutral';
      return (
        <Label tone={tone} size='sm' dot>
          {v}
        </Label>
      );
    }
    case 'chip':
      // Chip primitive isn't shipped in this DS pass; fallback to text-only Label
      return (
        <Label tone='neutral' size='sm'>
          {v}
        </Label>
      );
    case 'num':
      return (
        <Typography component='span' sx={{ fontSize: 'inherit', color: 'var(--ds-gray-700)', fontVariantNumeric: 'tabular-nums' }}>
          {v}
        </Typography>
      );
    case 'cost':
      return (
        <Typography
          component='span'
          sx={{
            fontSize: 'inherit',
            color: 'var(--ds-gray-700)',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 'var(--ds-font-weight-medium)',
          }}
        >
          {v}
        </Typography>
      );
    case 'action':
      return col.render ? col.render(row) : null;
  }
}

export function Table<T extends TableRow = TableRow>({
  data,
  columns,
  selection = 'none',
  headerAccent = 'gray',
  selectedIds = [],
  onSelectionChange,
  sortBy,
  onSort,
  onRowClick,
  loading = false,
  loadingRowCount = 5,
  empty,
  expandable,
}: TableProps<T>) {
  const allSelected = selection === 'multi' && data.length > 0 && selectedIds.length === data.length;
  const someSelected = selection === 'multi' && selectedIds.length > 0 && selectedIds.length < data.length;

  // Local fallback when `expandable.expandedIds` isn't provided (uncontrolled).
  const [internalExpanded, setInternalExpanded] = React.useState<Array<string | number>>([]);
  const isControlledExpand = !!expandable?.expandedIds;
  const expandedIds = isControlledExpand ? expandable!.expandedIds! : internalExpanded;
  const expandPosition = expandable?.position ?? 'end';

  const toggleExpand = (row: T) => {
    const id = row.id;
    const next = expandedIds.includes(id) ? expandedIds.filter((x) => x !== id) : [...expandedIds, id];
    if (!isControlledExpand) setInternalExpanded(next);
    expandable?.onToggle?.(row, !expandedIds.includes(id));
  };

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) onSelectionChange([]);
    else onSelectionChange(data.map((r) => r.id));
  };

  const toggleRow = (id: string | number) => {
    if (!onSelectionChange) return;
    if (selection === 'single') {
      onSelectionChange(selectedIds.includes(id) ? [] : [id]);
      return;
    }
    onSelectionChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  const handleSort = (col: TableColumn<T>) => {
    if (!col.sortable || !onSort) return;
    const isActive = sortBy?.key === col.key;
    const nextDir: SortDirection = isActive && sortBy?.direction === 'asc' ? 'desc' : 'asc';
    onSort(col.key, nextDir);
  };

  const showEmpty = !loading && data.length === 0 && empty;
  const headerBottomBorder = `1px solid ${HEADER_BORDER_COLOR[headerAccent]}`;

  // colSpan for the expanded panel row — covers selection + columns + chevron.
  const totalColSpan = columns.length + (selection === 'multi' ? 1 : 0) + (expandable ? 1 : 0);

  const headCellSx = {
    backgroundColor: 'var(--ds-background-100)',
    borderBottom: headerBottomBorder,
    fontSize: 'var(--ds-text-caption)',
    fontWeight: 600,
    color: 'var(--ds-brand-600)',
    textTransform: 'none' as const,
    letterSpacing: 0,
    padding: HEADER_PADDING,
    verticalAlign: 'middle' as const,
  };

  return (
    <TableContainer
      sx={{
        // Top + bottom rules only; no L/R borders so the table breathes
        // against the page background.
        borderTop: '1px solid var(--ds-gray-200)',
        borderBottom: '1px solid var(--ds-gray-200)',
        backgroundColor: 'var(--ds-background-100)',
        overflow: 'auto',
      }}
    >
      <MuiTable>
        <TableHead>
          <TableRow>
            {selection === 'multi' && (
              <TableCell padding='checkbox' sx={headCellSx}>
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleAll}
                  size='small'
                  sx={{ color: 'var(--ds-gray-400)', '&.Mui-checked': { color: 'var(--ds-blue-500)' } }}
                />
              </TableCell>
            )}
            {expandable && expandPosition === 'start' && <TableCell sx={{ ...headCellSx, width: 40 }} aria-hidden='true' />}
            {columns.map((col) => {
              const isActive = sortBy?.key === col.key;
              return (
                <TableCell
                  key={col.key}
                  align={alignToCss(col.align)}
                  sx={{
                    ...headCellSx,
                    width: col.width,
                  }}
                >
                  {col.sortable && onSort ? (
                    <TableSortLabel active={isActive} direction={isActive ? sortBy?.direction : 'asc'} onClick={() => handleSort(col)}>
                      {col.header}
                    </TableSortLabel>
                  ) : (
                    col.header
                  )}
                </TableCell>
              );
            })}
            {expandable && expandPosition === 'end' && <TableCell sx={{ ...headCellSx, width: 40 }} aria-hidden='true' />}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading
            ? Array.from({ length: loadingRowCount }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  {selection === 'multi' && (
                    <TableCell padding='checkbox' sx={{ verticalAlign: 'top', padding: CELL_PADDING }}>
                      <Skeleton shape='rect' width={16} height={16} />
                    </TableCell>
                  )}
                  {expandable && expandPosition === 'start' && (
                    <TableCell sx={{ verticalAlign: 'top', padding: CELL_PADDING, borderBottom: '1px solid var(--ds-gray-200)' }} />
                  )}
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      align={alignToCss(col.align)}
                      sx={{ verticalAlign: 'top', padding: CELL_PADDING, borderBottom: '1px solid var(--ds-gray-200)' }}
                    >
                      <Skeleton shape='text' size='text' width='80%' />
                    </TableCell>
                  ))}
                  {expandable && expandPosition === 'end' && (
                    <TableCell sx={{ verticalAlign: 'top', padding: CELL_PADDING, borderBottom: '1px solid var(--ds-gray-200)' }} />
                  )}
                </TableRow>
              ))
            : data.map((row) => {
                const isSelected = selectedIds.includes(row.id);
                const rowIsExpandable = !!expandable && (expandable.isExpandable ? expandable.isExpandable(row) : true);
                const rowIsExpanded = rowIsExpandable && expandedIds.includes(row.id);

                const chevronCell = rowIsExpandable ? (
                  <TableCell
                    sx={{
                      verticalAlign: 'top',
                      padding: '8px',
                      width: 40,
                      borderBottom: '1px solid var(--ds-gray-200)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconButton
                      aria-label={rowIsExpanded ? 'Collapse row' : 'Expand row'}
                      aria-expanded={rowIsExpanded}
                      size='small'
                      onClick={() => toggleExpand(row)}
                      sx={{
                        color: 'var(--ds-gray-500)',
                        transition: 'transform 160ms ease, color 120ms ease',
                        transform: rowIsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        '&:hover': { color: 'var(--ds-gray-700)', backgroundColor: 'var(--ds-gray-100)' },
                      }}
                    >
                      <KeyboardArrowDownIcon fontSize='small' />
                    </IconButton>
                  </TableCell>
                ) : expandable ? (
                  // Keep the column count stable for non-expandable rows.
                  <TableCell sx={{ width: 40, borderBottom: '1px solid var(--ds-gray-200)' }} aria-hidden='true' />
                ) : null;

                return (
                  <React.Fragment key={row.id}>
                    <TableRow
                      hover
                      selected={isSelected}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      data-expanded={rowIsExpanded || undefined}
                      sx={{
                        cursor: onRowClick ? 'pointer' : 'default',
                        '&.Mui-selected': { backgroundColor: 'var(--ds-blue-100)' },
                        '&.Mui-selected:hover': { backgroundColor: 'var(--ds-blue-200)' },
                        '& > td': {
                          borderBottom: '1px solid var(--ds-gray-200)',
                          fontSize: 'var(--ds-text-small)',
                          padding: CELL_PADDING,
                          verticalAlign: 'top',
                        },
                        ...(rowIsExpanded && {
                          backgroundColor: 'var(--ds-gray-100)',
                          '& > td': {
                            borderBottom: 0,
                            fontSize: 'var(--ds-text-small)',
                            padding: CELL_PADDING,
                            verticalAlign: 'top',
                          },
                        }),
                      }}
                    >
                      {selection === 'multi' && (
                        <TableCell padding='checkbox' onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onChange={() => toggleRow(row.id)}
                            size='small'
                            sx={{ color: 'var(--ds-gray-400)', '&.Mui-checked': { color: 'var(--ds-blue-500)' } }}
                          />
                        </TableCell>
                      )}
                      {expandPosition === 'start' && chevronCell}
                      {columns.map((col) => (
                        <TableCell key={col.key} align={alignToCss(col.align)}>
                          {renderCell(row, col)}
                        </TableCell>
                      ))}
                      {expandPosition === 'end' && chevronCell}
                    </TableRow>
                    {rowIsExpandable && (
                      <TableRow data-panel-for={row.id}>
                        <TableCell
                          colSpan={totalColSpan}
                          sx={{
                            padding: 0,
                            borderBottom: rowIsExpanded ? '1px solid var(--ds-gray-200)' : 0,
                            backgroundColor: rowIsExpanded ? 'var(--ds-gray-100)' : 'transparent',
                          }}
                        >
                          <Collapse in={rowIsExpanded} timeout='auto' unmountOnExit>
                            <Box
                              sx={{ p: 'var(--ds-space-4)', backgroundColor: 'var(--ds-background-100)', borderTop: '1px solid var(--ds-gray-200)' }}
                            >
                              {expandable!.render(row)}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
        </TableBody>
      </MuiTable>
      {showEmpty && (
        <Box sx={{ p: 'var(--ds-space-5)' }}>
          <EmptyState size='inline' title={empty.title} description={empty.description} illustration={empty.illustration ?? 'no-results'} />
        </Box>
      )}
    </TableContainer>
  );
}

export default Table;
