/**
 * TextField — DS V2 of legacy CustomTextField.
 * Spec: app/design-system/primitives/forms/text-field.html
 *
 * The input baseline. Most other form primitives compose from it.
 * Three sizes (matching Button), one tone for error — the right semantic is
 * "valid" / "invalid", not a colour palette.
 *
 * Variants per spec:
 *   size        = 'sm' | 'md' | 'lg'
 *   type        = 'text' | 'number' | 'email' | 'password' | 'url' | 'textarea'
 *   composition = 'input' | 'label+input' | 'label+input+help' | 'label+input+error'
 *                 | 'prefix+input' | 'input+suffix'
 *                 (auto from `label` / `help` / `error` / `prefix` / `suffix` props)
 *   state       = 'default' | 'focus' | 'error' | 'disabled' | 'readonly'
 *
 * Don't (per spec):
 *   - Don't use a boolean `error`. The string form forces the author to write
 *     the message; the boolean encourages "show some red" with no explanation.
 *   - Don't put placeholder text that duplicates the label. Placeholders
 *     disappear; labels persist.
 *   - Don't combine `readonly` and `disabled` — pick one.
 *
 * Migration:
 *   `import CustomTextField from '@components1/common/CustomTextField'`
 * → `import { TextField } from '@components1/ds/TextField'`
 *   `FormField` wrappers fold into the `label+input+help` composition.
 */
import * as React from 'react';
import { Box } from '@mui/material';

export type TextFieldSize = 'sm' | 'md' | 'lg';
export type TextFieldType = 'text' | 'number' | 'email' | 'password' | 'url' | 'textarea';

export interface TextFieldProps {
  value: string;
  onChange: (next: string) => void;
  label?: React.ReactNode;
  help?: React.ReactNode;
  /** Spec: string form is required; boolean is forbidden. Presence ⇒ error state. */
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  size?: TextFieldSize;
  type?: TextFieldType;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /** Hint for native input modes on mobile (use for IDs/phones instead of type='number'). */
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'url' | 'search';
  /** textarea row count when `type='textarea'`. */
  rows?: number;
  /** Forwarded to <input>. */
  name?: string;
  autoComplete?: string;
  onBlur?: React.FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  className?: string;
  id?: string;
}

const SIZE_TOKENS: Record<TextFieldSize, { height: string; fontSize: string; padX: string; labelGap: string }> = {
  sm: { height: '24px', fontSize: 'var(--ds-text-caption)', padX: '8px', labelGap: '4px' },
  md: { height: '32px', fontSize: 'var(--ds-text-body)', padX: '10px', labelGap: '6px' },
  lg: { height: '40px', fontSize: 'var(--ds-text-body)', padX: '12px', labelGap: '6px' },
};

export function TextField({
  value,
  onChange,
  label,
  help,
  error,
  prefix,
  suffix,
  size = 'md',
  type = 'text',
  placeholder,
  required,
  disabled,
  readOnly,
  inputMode,
  rows = 3,
  name,
  autoComplete,
  onBlur,
  onFocus,
  className,
  id,
}: TextFieldProps) {
  const tokens = SIZE_TOKENS[size];
  const reactId = React.useId();
  const inputId = id ?? reactId;
  const hasError = typeof error === 'string' && error.length > 0;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;

  // Spec Don't: readonly + disabled is forbidden. Take readonly as the more permissive winner.
  const effectiveDisabled = disabled && !readOnly;

  const inputBaseSx = {
    width: '100%',
    height: type === 'textarea' ? 'auto' : tokens.height,
    minHeight: type === 'textarea' ? '80px' : undefined,
    padding: type === 'textarea' ? `6px ${tokens.padX}` : `0 ${tokens.padX}`,
    fontFamily: 'var(--ds-font-sans)',
    fontSize: tokens.fontSize,
    lineHeight: 1.4,
    color: 'var(--ds-gray-800)',
    backgroundColor: effectiveDisabled ? 'var(--ds-background-200)' : 'var(--ds-background-100)',
    border: `1px solid ${hasError ? 'var(--ds-red-500)' : 'var(--ds-gray-300)'}`,
    borderRadius: prefix || suffix ? 0 : 'var(--ds-radius-sm)',
    outline: 'none',
    boxSizing: 'border-box' as const,
    resize: type === 'textarea' ? ('vertical' as const) : ('none' as const),
    '&:hover': effectiveDisabled ? undefined : { borderColor: hasError ? 'var(--ds-red-600)' : 'var(--ds-gray-400)' },
    '&:focus': {
      borderColor: hasError ? 'var(--ds-red-500)' : 'var(--ds-blue-500)',
      boxShadow: `0 0 0 3px ${hasError ? 'var(--ds-red-alpha-200)' : 'var(--ds-blue-alpha-200)'}`,
    },
    '&:disabled': { color: 'var(--ds-gray-500)', cursor: 'not-allowed' },
    '&[readonly]': { backgroundColor: 'var(--ds-background-200)', cursor: 'default' },
    '&::placeholder': { color: 'var(--ds-gray-500)' },
  };

  const inputEl =
    type === 'textarea' ? (
      <Box
        component='textarea'
        id={inputId}
        name={name}
        rows={rows}
        value={value}
        placeholder={placeholder}
        required={required}
        disabled={effectiveDisabled}
        readOnly={readOnly}
        autoComplete={autoComplete}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : help ? helpId : undefined}
        onChange={(e) => onChange(e.currentTarget.value)}
        onBlur={onBlur}
        onFocus={onFocus}
        sx={inputBaseSx}
      />
    ) : (
      <Box
        component='input'
        id={inputId}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        disabled={effectiveDisabled}
        readOnly={readOnly}
        inputMode={inputMode}
        autoComplete={autoComplete}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : help ? helpId : undefined}
        onChange={(e) => onChange(e.currentTarget.value)}
        onBlur={onBlur}
        onFocus={onFocus}
        sx={inputBaseSx}
      />
    );

  // Composition: prefix+input or input+suffix wraps the input in a flex shell.
  const inputBlock =
    prefix || suffix ? (
      <Box sx={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>
        {prefix && (
          <Box
            component='span'
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: `0 ${tokens.padX}`,
              border: '1px solid var(--ds-gray-300)',
              borderRight: 0,
              borderRadius: 'var(--ds-radius-sm) 0 0 var(--ds-radius-sm)',
              backgroundColor: 'var(--ds-background-200)',
              color: 'var(--ds-gray-600)',
              fontSize: tokens.fontSize,
              whiteSpace: 'nowrap',
            }}
          >
            {prefix}
          </Box>
        )}
        <Box
          sx={{
            flex: 1,
            '& > input, & > textarea': {
              borderRadius:
                prefix && suffix ? 0 : prefix ? '0 var(--ds-radius-sm) var(--ds-radius-sm) 0' : 'var(--ds-radius-sm) 0 0 var(--ds-radius-sm)',
            },
          }}
        >
          {inputEl}
        </Box>
        {suffix && (
          <Box
            component='span'
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: `0 ${tokens.padX}`,
              border: '1px solid var(--ds-gray-300)',
              borderLeft: 0,
              borderRadius: '0 var(--ds-radius-sm) var(--ds-radius-sm) 0',
              backgroundColor: 'var(--ds-background-200)',
              color: 'var(--ds-gray-600)',
              fontSize: tokens.fontSize,
              whiteSpace: 'nowrap',
            }}
          >
            {suffix}
          </Box>
        )}
      </Box>
    ) : (
      inputEl
    );

  // Composition: 'input' (no label, no help, no error)
  const showLabel = label !== undefined;
  const showHelp = !hasError && help !== undefined;

  return (
    <Box className={className} sx={{ display: 'flex', flexDirection: 'column', gap: tokens.labelGap, width: '100%' }}>
      {showLabel && (
        <Box
          component='label'
          htmlFor={inputId}
          sx={{
            fontSize: tokens.fontSize,
            color: 'var(--ds-gray-700)',
            fontWeight: 'var(--ds-font-weight-medium)',
          }}
        >
          {label}
          {required && (
            <Box component='span' aria-hidden='true' sx={{ color: 'var(--ds-red-500)', marginLeft: '2px' }}>
              *
            </Box>
          )}
        </Box>
      )}
      {inputBlock}
      {showHelp && (
        <Box component='span' id={helpId} sx={{ fontSize: 'var(--ds-text-caption)', color: 'var(--ds-gray-500)' }}>
          {help}
        </Box>
      )}
      {hasError && (
        <Box component='span' id={errorId} role='alert' sx={{ fontSize: 'var(--ds-text-caption)', color: 'var(--ds-red-600)' }}>
          {error}
        </Box>
      )}
    </Box>
  );
}

export default TextField;
