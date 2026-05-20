/**
 * CollapsableCard — DS V2 generic single-unit collapsible card.
 * Spec: app/design-system/primitives/layout/collapsable-card.html
 *
 * Distinct from Accordion: Accordion groups multiple sibling collapsibles,
 * CollapsableCard is a single standalone unit.
 *
 * Variants per spec:
 *   - defaultOpen: boolean (initial state when no persisted value found)
 *   - composition: 'header+body' | 'header+meta+body'
 *   - persist:     'none' | 'local' | 'url'   — 'url' deep-links via ?id=open|closed
 *
 * Slots: `header` (left of header row), `meta` (right of header row, only when
 * composition === 'header+meta+body'), `children` (body).
 *
 * Note: The existing domain-heavy `CollapsableCard` at
 * @common/widgets/CollapsableCard is not a generic primitive — keep that one
 * for highlights/resolve flows; use this for generic 1-row collapsibles
 * (replacing legacy MUI Accordion patterns).
 */
import * as React from 'react';
import { Box, Collapse } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

export type CollapsableCardComposition = 'header+body' | 'header+meta+body';
export type CollapsableCardPersist = 'none' | 'local' | 'url';

export interface CollapsableCardProps {
  /** Stable identifier — required for `persist: 'local' | 'url'`. */
  id?: string;
  defaultOpen?: boolean;
  composition?: CollapsableCardComposition;
  persist?: CollapsableCardPersist;
  /** Header content (left side). */
  header: React.ReactNode;
  /** Meta slot (right side). Rendered only when composition === 'header+meta+body'. */
  meta?: React.ReactNode;
  children: React.ReactNode;
  sx?: object;
  /** Fired when the open state changes (after persist sync). */
  onOpenChange?: (open: boolean) => void;
}

const STORAGE_PREFIX = 'ds:collapsable-card:';

function readPersisted(persist: CollapsableCardPersist, id: string | undefined, fallback: boolean): boolean {
  if (!id || persist === 'none') return fallback;
  if (typeof window === 'undefined') return fallback;
  if (persist === 'local') {
    const v = window.localStorage.getItem(STORAGE_PREFIX + id);
    if (v === 'open') return true;
    if (v === 'closed') return false;
    return fallback;
  }
  if (persist === 'url') {
    const params = new URLSearchParams(window.location.search);
    const v = params.get(id);
    if (v === 'open') return true;
    if (v === 'closed') return false;
    return fallback;
  }
  return fallback;
}

function writePersisted(persist: CollapsableCardPersist, id: string | undefined, open: boolean) {
  if (!id || persist === 'none') return;
  if (typeof window === 'undefined') return;
  const stateStr = open ? 'open' : 'closed';
  if (persist === 'local') {
    window.localStorage.setItem(STORAGE_PREFIX + id, stateStr);
    return;
  }
  if (persist === 'url') {
    const url = new URL(window.location.href);
    url.searchParams.set(id, stateStr);
    window.history.replaceState({}, '', url.toString());
  }
}

export function CollapsableCard({
  id,
  defaultOpen = true,
  composition = 'header+body',
  persist = 'none',
  header,
  meta,
  children,
  sx,
  onOpenChange,
}: CollapsableCardProps) {
  const [open, setOpen] = React.useState<boolean>(() => readPersisted(persist, id, defaultOpen));

  const toggle = React.useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      writePersisted(persist, id, next);
      onOpenChange?.(next);
      return next;
    });
  }, [persist, id, onOpenChange]);

  const showMeta = composition === 'header+meta+body';

  return (
    <Box
      sx={{
        border: '1px solid var(--ds-gray-200)',
        borderRadius: 'var(--ds-radius-md)',
        backgroundColor: 'var(--ds-background-100)',
        overflow: 'hidden',
        ...sx,
      }}
    >
      <Box
        component='button'
        type='button'
        aria-expanded={open}
        onClick={toggle}
        sx={{
          all: 'unset',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--ds-space-2)',
          width: '100%',
          padding: 'var(--ds-space-3) var(--ds-space-4)',
          cursor: 'pointer',
          fontSize: 'var(--ds-text-body)',
          fontWeight: 500,
          color: 'var(--ds-gray-900)',
          borderBottom: open ? '1px solid var(--ds-gray-200)' : 'none',
          '&:hover': { backgroundColor: 'var(--ds-gray-100)' },
          '&:focus-visible': { outline: '2px solid var(--ds-blue-500)', outlineOffset: '-2px' },
        }}
      >
        <KeyboardArrowDownIcon
          sx={{
            fontSize: 18,
            transition: 'transform 0.15s ease',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            color: 'var(--ds-gray-700)',
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>{header}</Box>
        {showMeta && meta && <Box sx={{ marginLeft: 'auto', flexShrink: 0 }}>{meta}</Box>}
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ padding: 'var(--ds-space-4)', color: 'var(--ds-gray-700)' }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

export default CollapsableCard;
