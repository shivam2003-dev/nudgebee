/**
 * @deprecated Use <Button tone="ghost" composition="icon-only" icon={<ContentCopy/>} aria-label="Copy" /> from '@components1/ds/Button' instead.
 * Tracked for removal 2026-06-06 (30-day deprecation clock from V2 ship 2026-05-07).
 */
import { IconButton } from '@mui/material';
import React, { useState, useRef, useEffect } from 'react';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import CheckIcon from '@mui/icons-material/Check';
import CustomTooltip from './CustomTooltip';
import { colors } from 'src/utils/colors';

const CopyButton = ({ onClick, sx }) => {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleClick = (e) => {
    if (onClick) {
      onClick(e);
    }
    setIsCopied(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  return (
    <CustomTooltip title={isCopied ? 'Copied!' : 'Copy'}>
      <IconButton
        aria-label={isCopied ? 'Copied' : 'Copy to clipboard'}
        sx={{
          ...sx,
          borderRadius: '4px',
          border: `0.5px solid ${colors.border.secondary}`,
          height: '32px',
          width: '32px',
          background: '#FFF',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: onClick ? 'pointer' : 'default',
          '&:hover': {
            border: `0.5px solid ${colors.border.primary}`,
          },
        }}
        onClick={handleClick}
      >
        {isCopied ? <CheckIcon sx={{ fontSize: '1.25rem', color: colors.text.success }} /> : <FileCopyIcon sx={{ fontSize: '1.25rem' }} />}
      </IconButton>
    </CustomTooltip>
  );
};

export default CopyButton;
