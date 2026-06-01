import React from 'react';
import SyncIcon from '@mui/icons-material/Sync';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { Box, ButtonBase, Divider } from '@mui/material';
import { DropdownMenu } from '@components1/ds/DropdownMenu';

interface RefreshSubmitButtonProps {
  loading: boolean;
  interval: number;
  onSubmit: () => void;
  setInterval: (interval: number) => void;
  disabled?: boolean;
}

const timerOptions: Array<{ label: string; value: number }> = [
  { label: 'Off', value: 0 },
  { label: 'Live', value: 5 },
  { label: '10s', value: 10 },
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '45s', value: 45 },
  { label: '60s', value: 60 },
];

const PRIMARY_BG = 'var(--ds-brand-500)';
const PRIMARY_BG_HOVER = 'var(--ds-brand-400)';
const PRIMARY_TEXT = '#FFFFFF';

export const RefreshSubmitButton: React.FC<RefreshSubmitButtonProps> = ({ loading = false, interval, onSubmit, setInterval, disabled = false }) => {
  const isDisabled = loading || disabled;
  const activeOption = timerOptions.find((opt) => opt.value === interval) || timerOptions[0];

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'stretch',
        height: 32,
        borderRadius: 'var(--ds-radius-md)',
        overflow: 'hidden',
        backgroundColor: PRIMARY_BG,
        opacity: isDisabled ? 0.6 : 1,
        boxShadow: 'var(--ds-shadow-xs)',
      }}
    >
      <ButtonBase
        onClick={() => onSubmit()}
        disabled={isDisabled}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--ds-space-1)',
          px: 'var(--ds-space-3)',
          color: PRIMARY_TEXT,
          fontSize: 'var(--ds-text-small)',
          fontWeight: 'var(--ds-font-weight-medium)',
          fontFamily: 'var(--ds-font-display)',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          transition: 'background-color 150ms ease',
          '&:hover': {
            backgroundColor: isDisabled ? PRIMARY_BG : PRIMARY_BG_HOVER,
          },
        }}
      >
        <SyncIcon
          sx={{
            fontSize: '16px',
            color: PRIMARY_TEXT,
            animation: loading ? 'rsb-spin 2s linear infinite' : undefined,
            '@keyframes rsb-spin': {
              '0%': { transform: 'rotate(360deg)' },
              '100%': { transform: 'rotate(0deg)' },
            },
          }}
        />
        Run Query
      </ButtonBase>

      <Divider flexItem orientation='vertical' sx={{ borderColor: 'rgba(255,255,255,0.25)', m: 0, alignSelf: 'stretch' }} />

      <DropdownMenu
        trigger={
          <ButtonBase
            aria-label='Auto Refresh interval'
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--ds-space-1)',
              px: 'var(--ds-space-2)',
              color: PRIMARY_TEXT,
              fontSize: 'var(--ds-text-small)',
              fontWeight: 'var(--ds-font-weight-medium)',
              fontFamily: 'var(--ds-font-display)',
              cursor: 'pointer',
              transition: 'background-color 150ms ease',
              '&:hover': {
                backgroundColor: PRIMARY_BG_HOVER,
              },
            }}
          >
            {activeOption.label}
            <KeyboardArrowDownIcon sx={{ fontSize: '14px', color: PRIMARY_TEXT }} />
          </ButtonBase>
        }
        items={timerOptions.map((opt) => ({
          id: String(opt.value),
          label: opt.label,
          selected: opt.value === interval,
          onSelect: () => setInterval(opt.value),
        }))}
      />
    </Box>
  );
};
