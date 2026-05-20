/**
 * Select — DS V2 of legacy CustomSelectDropdown.
 * Spec:        app/design-system/primitives/forms/select.html
 * Variants:    size = 'sm' | 'md' | 'lg'
 *              option.composition = 'text' | 'icon+text' | 'text+subtext' (auto from option shape)
 *
 * Migration:   `import CustomSelectDropdown from '@common/CustomSelectDropdown'`
 *           →  `import { Select } from '@components1/ds/Select'`
 *
 * Don't (per spec):
 *   - Don't use Select with > ~12 options — switch to Autocomplete.
 *   - Don't use Select for binary choices — use ToggleGroup or Switch.
 *   - Don't put icons in only some options. Asymmetric icon columns are visual typos.
 */
import * as React from 'react';
import { Box, FormControl, InputLabel, MenuItem, Select as MuiSelect, Typography, type SelectChangeEvent } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

export type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectOption {
  value: string;
  label: string;
  subtext?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export type SelectOptionLike = string | SelectOption;

export interface SelectProps {
  value: string | null;
  onChange: (next: string) => void;
  options: SelectOptionLike[];
  label?: string;
  helpText?: string;
  size?: SelectSize;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  minWidth?: string;
  maxWidth?: string;
}

const SIZE_HEIGHT: Record<SelectSize, string> = { sm: '28px', md: '36px', lg: '44px' };
const SIZE_FONT: Record<SelectSize, string> = {
  sm: 'var(--ds-text-small)',
  md: 'var(--ds-text-body)',
  lg: 'var(--ds-text-body-lg)',
};

const isObj = (o: SelectOptionLike): o is SelectOption => typeof o === 'object' && o !== null;
const optValue = (o: SelectOptionLike): string => (isObj(o) ? o.value : String(o));
const optLabel = (o: SelectOptionLike): string => (isObj(o) ? o.label : String(o));

export function Select({
  value,
  onChange,
  options,
  label,
  helpText,
  size = 'md',
  placeholder,
  error = false,
  disabled = false,
  required = false,
  id,
  minWidth = '180px',
  maxWidth = '480px',
}: SelectProps) {
  const handleChange = (event: SelectChangeEvent<string>) => {
    onChange(event.target.value);
  };

  return (
    <FormControl
      size={size === 'sm' ? 'small' : 'medium'}
      sx={{ minWidth, maxWidth, width: '100%' }}
      required={required}
      error={error}
      disabled={disabled}
    >
      {label && (
        <InputLabel id={id ? `${id}-label` : undefined} sx={{ fontSize: 'var(--ds-text-small)', color: 'var(--ds-gray-600)' }} shrink>
          {label}
        </InputLabel>
      )}
      <MuiSelect
        labelId={id ? `${id}-label` : undefined}
        id={id}
        value={value ?? ''}
        onChange={handleChange}
        displayEmpty={!!placeholder}
        notched
        label={label}
        IconComponent={KeyboardArrowDownIcon}
        renderValue={(v) => {
          if (!v && placeholder) {
            return (
              <Typography component='span' sx={{ color: 'var(--ds-gray-500)', fontSize: SIZE_FONT[size] }}>
                {placeholder}
              </Typography>
            );
          }
          const match = options.find((o) => optValue(o) === v);
          return match ? optLabel(match) : v;
        }}
        sx={{
          minHeight: SIZE_HEIGHT[size],
          fontSize: SIZE_FONT[size],
          backgroundColor: 'var(--ds-background-100)',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: error ? 'var(--ds-red-500)' : 'var(--ds-gray-300)',
            borderRadius: 'var(--ds-radius-sm)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: error ? 'var(--ds-red-500)' : 'var(--ds-gray-400)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: error ? 'var(--ds-red-500)' : 'var(--ds-blue-500)',
            borderWidth: '2px',
          },
          '& .MuiSelect-select': {
            padding: size === 'sm' ? '4px 32px 4px 8px' : size === 'lg' ? '10px 32px 10px 14px' : '6px 32px 6px 12px',
            display: 'flex',
            alignItems: 'center',
          },
        }}
        MenuProps={{
          PaperProps: {
            sx: {
              borderRadius: 'var(--ds-radius-md)',
              boxShadow: '0px 4px 20px 0px var(--ds-gray-alpha-200)',
              maxHeight: 320,
            },
          },
        }}
      >
        {options.map((o) => {
          const v = optValue(o);
          const lab = optLabel(o);
          const subtext = isObj(o) ? o.subtext : undefined;
          const icon = isObj(o) ? o.icon : undefined;
          const isDisabled = isObj(o) ? o.disabled : false;
          return (
            <MenuItem
              key={v}
              value={v}
              disabled={isDisabled}
              sx={{
                fontSize: SIZE_FONT[size],
                color: 'var(--ds-gray-700)',
                gap: 'var(--ds-space-2)',
                '&.Mui-selected': { backgroundColor: 'var(--ds-blue-100)' },
                '&.Mui-selected:hover': { backgroundColor: 'var(--ds-blue-200)' },
              }}
            >
              {icon && (
                <Box component='span' sx={{ display: 'inline-flex', alignItems: 'center', color: 'var(--ds-gray-600)' }}>
                  {icon}
                </Box>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <Box>{lab}</Box>
                {subtext && <Box sx={{ fontSize: 'var(--ds-text-caption)', color: 'var(--ds-gray-500)', mt: 0.25 }}>{subtext}</Box>}
              </Box>
            </MenuItem>
          );
        })}
      </MuiSelect>
      {helpText && (
        <Typography sx={{ mt: 0.5, fontSize: 'var(--ds-text-caption)', color: error ? 'var(--ds-red-600)' : 'var(--ds-gray-600)' }}>
          {helpText}
        </Typography>
      )}
    </FormControl>
  );
}

export default Select;
