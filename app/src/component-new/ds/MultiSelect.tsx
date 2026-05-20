/**
 * MultiSelect — DS V2 of legacy CustomMultiDropdown.
 * Spec:        app/design-system/primitives/forms/multi-select.html
 * Variants:    size = 'sm' | 'md'
 *              overflow = 'chips' | 'chips+more' | 'count'
 *              selection = 'any' | 'min-1' | { max: number }
 *
 * Migration:   `import CustomMultiDropdown from '@common/CustomMultiDropdown'`
 *           →  `import { MultiSelect } from '@components1/ds/MultiSelect'`
 *
 *   V1 prop  →  V2 prop
 *   value    →  values   (always string[])
 *   handleCloseIcon → (folded into onChange — chip dismiss calls onChange with the new array)
 *   limitTags → overflow + (chips+more reveals overflowed chips in tooltip)
 *
 * Don't (per spec):
 *   - Don't render selected values without a per-chip dismiss affordance.
 *   - Don't use overflow="chips" when the upper bound on selections is unknown.
 */
import * as React from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  FormControl,
  ListSubheader,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CancelIcon from '@mui/icons-material/Cancel';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

export type MultiSelectSize = 'sm' | 'md';
export type MultiSelectOverflow = 'chips' | 'chips+more' | 'count';
export type MultiSelectSelection = 'any' | 'min-1' | { max: number };

export interface MultiSelectOption {
  value: string;
  label: string;
  id?: string;
}

export type MultiSelectOptionLike = string | MultiSelectOption;

export interface MultiSelectProps {
  /** Currently selected values (always an array of strings) */
  values: string[];
  /** Fired with the next array. Same callback handles chip dismiss. */
  onChange: (next: string[]) => void;
  /** Options accept either bare strings or `{value, label, id?}` objects */
  options: MultiSelectOptionLike[];
  /** Backwards-compat alias. When `placeholder` is unset, `label` is used as
   *  the placeholder text (and as the prefix in `overflow="count"` mode:
   *  `Account · 2`). The legacy floating-label rendering is gone — use a
   *  Typography above the field if you need a true visible label. */
  label?: string;
  /** Placeholder rendered inside the field when nothing is selected.
   *  Replaces the legacy floating-label pattern, which broke single-row
   *  toolbar layouts (label sat on top of the border at half-height). */
  placeholder?: string;
  helpText?: string;
  size?: MultiSelectSize;
  overflow?: MultiSelectOverflow;
  selection?: MultiSelectSelection;
  disabled?: boolean;
  loading?: boolean;
  searchable?: boolean;
  required?: boolean;
  id?: string;
  minWidth?: string;
  maxWidth?: string;
  /** Number of chips to render before applying overflow (default 3) */
  visibleChipCount?: number;
}

const isObj = (o: MultiSelectOptionLike): o is MultiSelectOption => typeof o === 'object' && o !== null;
const optValue = (o: MultiSelectOptionLike): string => (isObj(o) ? o.value : String(o));
const optLabel = (o: MultiSelectOptionLike): string => (isObj(o) ? o.label : String(o));

function findLabel(options: MultiSelectOptionLike[], value: string): string {
  const match = options.find((o) => optValue(o) === value);
  return match ? optLabel(match) : value;
}

function isAtMax(values: string[], selection: MultiSelectSelection): boolean {
  if (typeof selection === 'object' && 'max' in selection) {
    return values.length >= selection.max;
  }
  return false;
}

function canDeselect(values: string[], selection: MultiSelectSelection): boolean {
  if (selection === 'min-1') return values.length > 1;
  return true;
}

const SIZE_HEIGHT: Record<MultiSelectSize, string> = { sm: '28px', md: '36px' };

const chipSx = {
  height: '20px !important',
  fontSize: 'var(--ds-text-caption)',
  borderRadius: 'var(--ds-radius-sm)',
  backgroundColor: 'var(--ds-blue-100)',
  color: 'var(--ds-gray-700)',
  '& .MuiChip-deleteIcon': {
    width: 14,
    height: 14,
    color: 'var(--ds-gray-500)',
    '&:hover': { color: 'var(--ds-gray-700)' },
  },
};

export function MultiSelect({
  values,
  onChange,
  options,
  label,
  placeholder,
  helpText,
  size = 'md',
  overflow = 'chips+more',
  selection = 'any',
  disabled = false,
  loading = false,
  searchable = false,
  required = false,
  id,
  minWidth = '180px',
  maxWidth = '480px',
  visibleChipCount = 3,
}: MultiSelectProps) {
  // Effective placeholder text: explicit prop > label > generic "Select…".
  // Surfaced inside the field when nothing is selected — replaces the
  // legacy floating-label pattern, which broke single-row toolbar layouts.
  const placeholderText = placeholder ?? label ?? 'Select…';
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const searchRef = React.useRef<HTMLInputElement>(null);

  const filtered = searchable && query ? options.filter((o) => optLabel(o).toLowerCase().includes(query.toLowerCase())) : options;

  const handleChange = (event: SelectChangeEvent<string[]>) => {
    const next = event.target.value as string[];
    if (isAtMax(next, selection) && next.length > values.length) return; // block over-cap selections
    if (next.length < values.length && !canDeselect(values, selection)) return; // block under-min deselects
    onChange(next);
  };

  const removeChip = (val: string) => {
    if (!canDeselect(values, selection)) return;
    onChange(values.filter((v) => v !== val));
  };

  const clearAll = () => {
    if (selection === 'min-1' && options.length > 0) return;
    onChange([]);
  };

  const renderTrigger = () => {
    // No selection → render placeholder text in gray-500 so the field reads
    // as "empty / awaiting input" without the legacy floating-label pattern.
    if (values.length === 0) {
      return (
        <Typography component='span' sx={{ fontSize: 'var(--ds-text-body)', color: 'var(--ds-gray-500)' }}>
          {placeholderText}
        </Typography>
      );
    }

    if (overflow === 'count') {
      const labelPart = label ?? placeholder;
      return (
        <Typography component='span' sx={{ fontSize: 'var(--ds-text-body)', color: 'var(--ds-gray-700)' }}>
          {labelPart ? `${labelPart} · ${values.length}` : `${values.length} selected`}
        </Typography>
      );
    }

    const visible = values.slice(0, visibleChipCount);
    const hidden = values.slice(visibleChipCount);

    return (
      <Stack direction='row' spacing={0.5} alignItems='center' flexWrap='wrap' sx={{ width: '100%' }}>
        {visible.map((v) => (
          <Chip
            key={v}
            size='small'
            label={findLabel(options, v)}
            disabled={disabled || !canDeselect(values, selection)}
            onMouseDown={(e) => e.stopPropagation()}
            onDelete={() => removeChip(v)}
            deleteIcon={<CancelIcon onMouseDown={(e) => e.stopPropagation()} />}
            sx={chipSx}
          />
        ))}
        {hidden.length > 0 && overflow === 'chips+more' && (
          <Chip
            size='small'
            label={`+ ${hidden.length} more`}
            sx={{
              ...chipSx,
              backgroundColor: 'var(--ds-gray-100)',
              color: 'var(--ds-gray-600)',
            }}
          />
        )}
      </Stack>
    );
  };

  const formCtl = (
    <FormControl size={size === 'sm' ? 'small' : 'medium'} sx={{ minWidth, maxWidth, width: '100%' }} required={required}>
      <Select
        id={id}
        multiple
        displayEmpty
        value={values}
        onChange={handleChange}
        open={open}
        onOpen={() => {
          setOpen(true);
          setQuery('');
        }}
        onClose={() => {
          setOpen(false);
          setQuery('');
        }}
        disabled={disabled || options.length === 0}
        IconComponent={KeyboardArrowDownIcon}
        renderValue={renderTrigger}
        sx={{
          minHeight: SIZE_HEIGHT[size],
          fontSize: 'var(--ds-text-body)',
          backgroundColor: 'var(--ds-background-100)',
          '& .MuiOutlinedInput-notchedOutline': {
            borderRadius: 'var(--ds-radius-sm)',
            borderColor: 'var(--ds-gray-300)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--ds-gray-400)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--ds-blue-500)',
            borderWidth: '2px',
          },
          '& .MuiSelect-select': {
            padding: size === 'sm' ? '4px 32px 4px 8px' : '6px 32px 6px 12px',
            display: 'flex',
            alignItems: 'center',
          },
        }}
        endAdornment={
          <Box sx={{ position: 'absolute', right: 28, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {loading && <CircularProgress size={14} sx={{ color: 'var(--ds-blue-500)' }} />}
            {!loading && values.length > 0 && !disabled && canDeselect(values, selection) && (
              <CancelIcon
                onMouseDown={(e) => e.stopPropagation()}
                onClick={clearAll}
                sx={{ fontSize: 16, color: 'var(--ds-gray-500)', cursor: 'pointer', '&:hover': { color: 'var(--ds-gray-700)' } }}
              />
            )}
          </Box>
        }
        MenuProps={{
          autoFocus: false,
          disablePortal: true,
          PaperProps: {
            sx: {
              borderRadius: 'var(--ds-radius-md)',
              boxShadow: '0px 4px 20px 0px var(--ds-gray-alpha-200)',
              maxHeight: 320,
            },
          },
          TransitionProps: {
            onEntered: () => searchable && searchRef.current?.focus(),
          },
        }}
      >
        {searchable && (
          <ListSubheader sx={{ p: 'var(--ds-space-2)', backgroundColor: 'var(--ds-background-100)' }}>
            <TextField
              inputRef={searchRef}
              size='small'
              fullWidth
              placeholder='Search…'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: 'var(--ds-text-body)',
                  borderRadius: 'var(--ds-radius-sm)',
                },
              }}
            />
          </ListSubheader>
        )}
        {filtered.length === 0 ? (
          <MenuItem disabled sx={{ fontSize: 'var(--ds-text-small)', justifyContent: 'center', color: 'var(--ds-gray-500)' }}>
            {searchable && query ? 'No matches' : 'No options'}
          </MenuItem>
        ) : (
          filtered.map((o) => {
            const v = optValue(o);
            const lab = optLabel(o);
            const k = isObj(o) ? o.id || o.value : String(o);
            const isSelected = values.includes(v);
            const blocked = !isSelected && isAtMax(values, selection);
            return (
              <MenuItem
                key={k}
                value={v}
                disabled={blocked}
                sx={{
                  fontSize: 'var(--ds-text-body)',
                  color: 'var(--ds-gray-700)',
                  justifyContent: 'space-between',
                  '&.Mui-selected': { backgroundColor: 'var(--ds-blue-100)' },
                  '&.Mui-selected:hover': { backgroundColor: 'var(--ds-blue-200)' },
                }}
              >
                {lab}
                {isSelected && <CheckIcon sx={{ fontSize: 16, color: 'var(--ds-blue-500)' }} />}
              </MenuItem>
            );
          })
        )}
      </Select>
      {helpText && <Typography sx={{ mt: 0.5, fontSize: 'var(--ds-text-caption)', color: 'var(--ds-gray-600)' }}>{helpText}</Typography>}
    </FormControl>
  );

  return formCtl;
}

export default MultiSelect;
