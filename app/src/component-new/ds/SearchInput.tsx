/**
 * SearchInput — DS V2 of legacy CustomSearch.
 * Spec: app/design-system/primitives/forms/search-input.html
 *
 * Specialised TextField for inline filtering. Always shows a leading magnifier;
 * shows a clear button when there's a value. Debounced by default — never fire
 * onChange per keystroke for a search that touches the network.
 *
 * Variants per spec:
 *   size        = 'sm' | 'md'
 *   composition = 'icon+input' | 'icon+input+kbd' | 'icon+input+clear'
 *                 (auto from `value` presence + `kbd` prop)
 *   debounce    = 0 | 200 | 400  (ms)
 *   surface     = 'page' | 'toolbar' | 'command-bar'
 *
 * Don't (per spec):
 *   - Don't put a "Search" button beside it. The icon, the placeholder, and the
 *     input itself communicate "search" — a button is noise.
 *   - Don't combine SearchInput with FilterGroup chips on the same row without
 *     a divider — they read as the same control.
 *
 * Migration:
 *   `import CustomSearch from '@components1/common/CustomSearch'`
 * → `import { SearchInput } from '@components1/ds/SearchInput'`
 *   The legacy `showLeadingIcon` boolean drops — the icon is constitutive.
 */
import * as React from 'react';
import { Box, ButtonBase } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';

export type SearchInputSize = 'sm' | 'md';
export type SearchInputDebounce = 0 | 200 | 400;
export type SearchInputSurface = 'page' | 'toolbar' | 'command-bar';

export interface SearchInputProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Debounce delay in ms. 0 = fire on every keystroke (use only for in-memory filters). */
  debounce?: SearchInputDebounce;
  /** Optional shortcut hint rendered as a kbd badge (e.g. "⌘K"). Pair with a global handler. */
  kbd?: string;
  size?: SearchInputSize;
  surface?: SearchInputSurface;
  /** Width of the input shell. */
  width?: string | number;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

const SIZE_TOKENS: Record<SearchInputSize, { height: string; fontSize: string; iconSize: number; padX: string }> = {
  sm: { height: '24px', fontSize: 'var(--ds-text-caption)', iconSize: 12, padX: '8px' },
  md: { height: '32px', fontSize: 'var(--ds-text-body)', iconSize: 14, padX: '10px' },
};

const SURFACE_BG: Record<SearchInputSurface, string> = {
  page: 'var(--ds-background-100)',
  toolbar: 'var(--ds-background-200)',
  'command-bar': 'var(--ds-background-100)',
};

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  debounce = 200,
  kbd,
  size = 'md',
  surface = 'page',
  width = '280px',
  disabled,
  autoFocus,
  className,
  id,
  'aria-label': ariaLabel = 'Search',
}: SearchInputProps) {
  const tokens = SIZE_TOKENS[size];
  const [draft, setDraft] = React.useState(value);

  // Keep local draft in sync when the parent resets value (e.g. clear-all action).
  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  // Debounced flush of draft → onChange. debounce=0 fires synchronously.
  React.useEffect(() => {
    if (debounce === 0) {
      if (draft !== value) onChange(draft);
      return;
    }
    if (draft === value) return;
    const t = setTimeout(() => onChange(draft), debounce);
    return () => clearTimeout(t);
  }, [draft, debounce, value, onChange]);

  const handleClear = () => {
    setDraft('');
    onChange('');
  };

  // Composition selection (auto):
  //   has value → 'icon+input+clear'
  //   has kbd   → 'icon+input+kbd'
  //   else      → 'icon+input'
  const composition = draft ? 'icon+input+clear' : kbd ? 'icon+input+kbd' : 'icon+input';

  return (
    <Box
      id={id}
      className={className}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: `0 ${tokens.padX}`,
        border: '1px solid var(--ds-gray-300)',
        backgroundColor: disabled ? 'var(--ds-background-200)' : SURFACE_BG[surface],
        borderRadius: 'var(--ds-radius-sm)',
        height: tokens.height,
        width,
        transition: 'border-color var(--ds-motion-micro) var(--ds-motion-ease)',
        '&:focus-within': {
          borderColor: 'var(--ds-blue-500)',
          boxShadow: '0 0 0 3px var(--ds-blue-alpha-200)',
        },
      }}
    >
      <SearchIcon aria-hidden='true' sx={{ fontSize: tokens.iconSize, color: 'var(--ds-gray-500)', flexShrink: 0 }} />
      <Box
        component='input'
        type='text'
        role='searchbox'
        aria-label={ariaLabel}
        disabled={disabled}
        autoFocus={autoFocus}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.currentTarget.value)}
        sx={{
          border: 0,
          outline: 'none',
          flex: 1,
          minWidth: 0,
          fontFamily: 'var(--ds-font-sans)',
          fontSize: tokens.fontSize,
          color: 'var(--ds-gray-800)',
          backgroundColor: 'transparent',
          padding: 0,
          '&::placeholder': { color: 'var(--ds-gray-500)' },
          '&:disabled': { color: 'var(--ds-gray-500)', cursor: 'not-allowed' },
        }}
      />
      {composition === 'icon+input+clear' && (
        <ButtonBase
          aria-label='Clear search'
          onClick={handleClear}
          disabled={disabled}
          sx={{
            width: '20px',
            height: '20px',
            borderRadius: 'var(--ds-radius-sm)',
            color: 'var(--ds-gray-500)',
            flexShrink: 0,
            '&:hover': { color: 'var(--ds-gray-700)', backgroundColor: 'var(--ds-gray-100)' },
            '&.Mui-focusVisible': { outline: '2px solid var(--ds-blue-500)', outlineOffset: '1px' },
          }}
        >
          <CloseIcon sx={{ fontSize: tokens.iconSize }} />
        </ButtonBase>
      )}
      {composition === 'icon+input+kbd' && (
        <Box
          component='kbd'
          aria-hidden='true'
          sx={{
            fontFamily: 'var(--ds-font-mono)',
            fontSize: 'var(--ds-text-caption)',
            color: 'var(--ds-gray-500)',
            padding: '1px 6px',
            border: '1px solid var(--ds-gray-200)',
            borderRadius: 'var(--ds-radius-sm)',
            backgroundColor: 'var(--ds-background-200)',
            flexShrink: 0,
          }}
        >
          {kbd}
        </Box>
      )}
    </Box>
  );
}

export default SearchInput;
