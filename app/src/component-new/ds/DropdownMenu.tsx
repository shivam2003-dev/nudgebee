/**
 * DropdownMenu — DS V2 of legacy CustomDropdown + ThreeDotsMenu + ButtonMenu.
 * Spec:        app/design-system/primitives/action/dropdown-menu.html
 * Variants:    align = 'start' | 'end'
 *              side  = 'bottom' | 'top' | 'left' | 'right'
 *              size  = 'sm' | 'md'
 *              item.tone = 'default' | 'danger'
 *              composition: items | sections | +kbd | +icons (auto from item shape)
 *
 * Migration:   `import CustomDropdown from '@common/CustomDropdown'`
 *              `import ThreeDotsMenu from '@common/ThreeDotsMenu'`
 *              `import ButtonMenu from '@common/ButtonMenu'`
 *           →  `import { DropdownMenu } from '@components1/ds/DropdownMenu'`
 *
 *   Per spec, ThreeDotsMenu and ButtonMenu are NOT separate primitives — they're
 *   `<DropdownMenu trigger={<Button ... />}>` with different trigger Buttons:
 *     <DropdownMenu trigger={<IconButton><MoreVertIcon /></IconButton>} />   ← was ThreeDotsMenu
 *     <DropdownMenu trigger={<Button endIcon={<KeyboardArrowDownIcon />}>Label</Button>} />  ← was ButtonMenu
 *
 * Don't (per spec):
 *   - Don't put > 7 items in one menu without sections.
 *   - Don't put a multi-step action behind a menu item — open a Dialog instead.
 *   - Don't nest DropdownMenus more than one level deep.
 */
import * as React from 'react';
import { Box, Divider, Menu, MenuItem, Typography } from '@mui/material';

export type DropdownMenuAlign = 'start' | 'end';
export type DropdownMenuSide = 'bottom' | 'top' | 'left' | 'right';
export type DropdownMenuSize = 'sm' | 'md';
export type DropdownMenuItemTone = 'default' | 'danger';

export interface DropdownMenuItemAction {
  type?: 'item';
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Keyboard shortcut hint (right-aligned). e.g. "⌘D" */
  kbd?: string;
  tone?: DropdownMenuItemTone;
  disabled?: boolean;
  onSelect: () => void;
  id?: string;
}

export interface DropdownMenuSeparator {
  type: 'separator';
}

export interface DropdownMenuSection {
  type: 'section';
  label: string;
}

export type DropdownMenuItem = DropdownMenuItemAction | DropdownMenuSeparator | DropdownMenuSection;

export interface DropdownMenuProps {
  trigger: React.ReactElement;
  items: DropdownMenuItem[];
  align?: DropdownMenuAlign;
  side?: DropdownMenuSide;
  size?: DropdownMenuSize;
  /** Min-width of the menu panel */
  minWidth?: string | number;
  /** Called after any item.onSelect (or after dismissal) */
  onClose?: () => void;
}

const SIZE_TOKENS: Record<DropdownMenuSize, { fontSize: string; itemPadX: string; itemPadY: string }> = {
  sm: { fontSize: 'var(--ds-text-small)', itemPadX: 'var(--ds-space-3)', itemPadY: 'var(--ds-space-1)' },
  md: { fontSize: 'var(--ds-text-body)', itemPadX: 'var(--ds-space-3)', itemPadY: 'var(--ds-space-2)' },
};

const TONE_COLOR: Record<DropdownMenuItemTone, string> = {
  default: 'var(--ds-gray-700)',
  danger: 'var(--ds-red-600)',
};

function deriveAnchorOrigin(side: DropdownMenuSide, align: DropdownMenuAlign) {
  if (side === 'top') {
    return { vertical: 'top' as const, horizontal: align === 'end' ? ('right' as const) : ('left' as const) };
  }
  if (side === 'left') {
    return { vertical: align === 'end' ? ('bottom' as const) : ('top' as const), horizontal: 'left' as const };
  }
  if (side === 'right') {
    return { vertical: align === 'end' ? ('bottom' as const) : ('top' as const), horizontal: 'right' as const };
  }
  // 'bottom' (default)
  return { vertical: 'bottom' as const, horizontal: align === 'end' ? ('right' as const) : ('left' as const) };
}

function deriveTransformOrigin(side: DropdownMenuSide, align: DropdownMenuAlign) {
  if (side === 'top') {
    return { vertical: 'bottom' as const, horizontal: align === 'end' ? ('right' as const) : ('left' as const) };
  }
  if (side === 'left') {
    return { vertical: align === 'end' ? ('bottom' as const) : ('top' as const), horizontal: 'right' as const };
  }
  if (side === 'right') {
    return { vertical: align === 'end' ? ('bottom' as const) : ('top' as const), horizontal: 'left' as const };
  }
  return { vertical: 'top' as const, horizontal: align === 'end' ? ('right' as const) : ('left' as const) };
}

export function DropdownMenu({ trigger, items, align = 'start', side = 'bottom', size = 'md', minWidth = 200, onClose }: DropdownMenuProps) {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);
  const tokens = SIZE_TOKENS[size];

  const close = () => {
    setAnchorEl(null);
    onClose?.();
  };

  const handleSelect = (item: DropdownMenuItemAction) => {
    if (item.disabled) return;
    item.onSelect();
    close();
  };

  // Inject onClick into the trigger element to open the menu
  const enhancedTrigger = React.cloneElement(trigger, {
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      // Preserve any existing onClick on the trigger
      const existingOnClick = (trigger.props as { onClick?: (e: React.MouseEvent<HTMLElement>) => void }).onClick;
      existingOnClick?.(e);
      setAnchorEl(e.currentTarget);
    },
    'aria-haspopup': 'menu',
    'aria-expanded': open,
  });

  return (
    <>
      {enhancedTrigger}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={close}
        anchorOrigin={deriveAnchorOrigin(side, align)}
        transformOrigin={deriveTransformOrigin(side, align)}
        slotProps={{
          paper: {
            sx: {
              minWidth,
              borderRadius: 'var(--ds-radius-md)',
              boxShadow: '0px 4px 20px 0px var(--ds-gray-alpha-200)',
              border: '1px solid var(--ds-gray-200)',
              overflow: 'hidden',
            },
          },
        }}
      >
        {items.map((item, i) => {
          if (item.type === 'separator') {
            return <Divider key={`sep-${i}`} sx={{ my: 0.5, borderColor: 'var(--ds-gray-200)' }} />;
          }
          if (item.type === 'section') {
            return (
              <Typography
                key={`section-${i}-${item.label}`}
                sx={{
                  px: tokens.itemPadX,
                  pt: 'var(--ds-space-2)',
                  pb: 'var(--ds-space-1)',
                  fontSize: 'var(--ds-text-caption)',
                  color: 'var(--ds-gray-500)',
                  fontWeight: 'var(--ds-font-weight-medium)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {item.label}
              </Typography>
            );
          }
          // item is DropdownMenuItemAction
          const tone = item.tone ?? 'default';
          return (
            <MenuItem
              key={item.id ?? `item-${i}`}
              disabled={item.disabled}
              onClick={() => handleSelect(item)}
              sx={{
                px: tokens.itemPadX,
                py: tokens.itemPadY,
                fontSize: tokens.fontSize,
                color: TONE_COLOR[tone],
                gap: 'var(--ds-space-2)',
                display: 'flex',
                alignItems: 'center',
                '&:hover': { backgroundColor: tone === 'danger' ? 'var(--ds-red-100)' : 'var(--ds-gray-100)' },
              }}
            >
              {item.icon && (
                <Box component='span' sx={{ display: 'inline-flex', alignItems: 'center', color: 'inherit', flexShrink: 0 }}>
                  {item.icon}
                </Box>
              )}
              <Box component='span' sx={{ flex: 1 }}>
                {item.label}
              </Box>
              {item.kbd && (
                <Box
                  component='kbd'
                  sx={{
                    fontFamily: 'var(--ds-font-mono)',
                    fontSize: 'var(--ds-text-caption)',
                    color: 'var(--ds-gray-500)',
                    backgroundColor: 'var(--ds-gray-100)',
                    border: '1px solid var(--ds-gray-200)',
                    borderRadius: 'var(--ds-radius-sm)',
                    padding: '1px 6px',
                  }}
                >
                  {item.kbd}
                </Box>
              )}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}

export default DropdownMenu;
