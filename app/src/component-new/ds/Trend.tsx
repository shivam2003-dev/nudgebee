/**
 * Trend — DS V2 of legacy TrendArrowPercentage.
 * Spec: app/design-system/primitives/data-display/trend.html
 *
 * Prop API preserved from TrendArrowPercentage:
 *   - value: number (the percentage value)
 *   - sign: 1 | -1 (multiplier — flip semantic direction without changing display sign)
 *   - width: string (container width when not compact)
 *   - size: 'default' | 'sm' (compact mode)
 *
 * Convention: positive (value*sign > 0) renders DOWN arrow + green (improvement),
 * negative renders UP arrow + red (regression). Callers control polarity via `sign`.
 */
import * as React from 'react';
import { Typography, Box } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import { formatNumber } from '@lib/formatter';

export interface TrendProps {
  value: number;
  sign?: 1 | -1;
  width?: string;
  size?: 'default' | 'sm';
}

export function Trend({ value, sign = 1, width = '50px', size = 'default' }: TrendProps) {
  const compact = size === 'sm';
  const isDown = value * sign > 0;
  const color = isDown ? 'var(--ds-green-500)' : 'var(--ds-red-500)';
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        width: compact ? 'auto' : width,
        marginRight: compact ? '0px' : '8px',
      }}
    >
      {isDown ? (
        <ArrowDropDownIcon sx={{ color, fontSize: compact ? 14 : undefined }} />
      ) : (
        <ArrowDropUpIcon sx={{ color, fontSize: compact ? 14 : undefined }} />
      )}
      <Typography
        sx={{
          color,
          fontSize: compact ? '10px' : 'var(--ds-text-small)',
          fontWeight: compact ? 400 : 500,
          opacity: compact ? 0.75 : 1,
        }}
      >
        {formatNumber(value)}%
      </Typography>
    </Box>
  );
}

export default Trend;
