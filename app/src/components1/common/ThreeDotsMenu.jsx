import React from 'react';
import PropTypes from 'prop-types';
import { Collapse, IconButton, ListItemIcon, Typography } from '@mui/material';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { MoreVert } from '@mui/icons-material';
import SafeIcon from './SafeIcon';
import { colors } from 'src/utils/colors';

function renderItemIcon(item) {
  // iconBlack opt-in renders the icon as a pure black silhouette regardless of source color
  const blackFilterStyle = item.iconBlack ? { filter: 'brightness(0) saturate(100%)', display: 'inline-flex' } : undefined;
  if (item.reactIcon) {
    return <ListItemIcon style={blackFilterStyle}>{item.reactIcon}</ListItemIcon>;
  }
  if (item.icon) {
    if (item.iconBlack) {
      return (
        <span style={blackFilterStyle}>
          <SafeIcon alt={item.label} src={item.icon} height='20' width='20' />
        </span>
      );
    }
    return <SafeIcon alt={item.label} src={item.icon} height='20' width='20' />;
  }
  return null;
}

function deriveAnchorOrigin(side, align) {
  if (side === 'top') {
    return { vertical: 'top', horizontal: align === 'end' ? 'right' : 'left' };
  }
  if (side === 'left') {
    return { vertical: align === 'end' ? 'bottom' : 'top', horizontal: 'left' };
  }
  if (side === 'right') {
    return { vertical: align === 'end' ? 'bottom' : 'top', horizontal: 'right' };
  }
  return { vertical: 'bottom', horizontal: align === 'end' ? 'right' : 'left' };
}

function deriveTransformOrigin(side, align) {
  if (side === 'top') {
    return { vertical: 'bottom', horizontal: align === 'end' ? 'right' : 'left' };
  }
  if (side === 'left') {
    return { vertical: align === 'end' ? 'bottom' : 'top', horizontal: 'right' };
  }
  if (side === 'right') {
    return { vertical: align === 'end' ? 'bottom' : 'top', horizontal: 'left' };
  }
  return { vertical: 'top', horizontal: align === 'end' ? 'right' : 'left' };
}

/**
 * @param {{
 *   id?: string,
 *   sx?: Record<string, any>,
 *   onMenuClick?: (item: any, data?: any) => void,
 *   menuItems?: any[],
 *   data?: any,
 *   lightIcon?: string,
 *   className?: string,
 *   menuWidth?: string | number,
 *   align?: 'start' | 'end',
 *   side?: 'bottom' | 'top' | 'left' | 'right',
 * }} props
 */
const ThreeDotsMenu = ({
  id,
  sx = {},
  onMenuClick,
  menuItems = [],
  data,
  lightIcon = '',
  className = '',
  menuWidth,
  align = 'end',
  side = 'bottom',
}) => {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [submenuOpen, setSubmenuOpen] = React.useState({});

  function handleMenuClick(e, item) {
    if (onMenuClick && data) {
      e.stopPropagation();
      onMenuClick(item, data);
    }
    handleClose(e);
  }

  const handleClick = (e) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleClose = (e) => {
    e.stopPropagation();
    setAnchorEl(null);
  };

  return menuItems?.length > 0 ? (
    <React.Fragment>
      <IconButton sx={{ ...sx }} id={id || 'three-dot-menu'} aria-label='more' aria-controls='long-menu' aria-haspopup='true' onClick={handleClick}>
        <MoreVert sx={{ color: lightIcon ? colors.text.secondaryDark : '' }} />
      </IconButton>
      <Menu
        id='actions-menu'
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={deriveAnchorOrigin(side, align)}
        transformOrigin={deriveTransformOrigin(side, align)}
        PaperProps={{ sx: { ...(menuWidth && { width: menuWidth, minWidth: menuWidth }) } }}
      >
        {menuItems &&
          menuItems.map((item, index) => {
            return item.subMenu?.length > 0 ? (
              <div>
                <MenuItem
                  disabled={item.disabled ?? false}
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSubmenuOpen({ ...submenuOpen, [item.label]: !submenuOpen[item.label] });
                  }}
                  sx={{ display: 'flex', alignItems: 'center' }}
                >
                  {renderItemIcon(item)}
                  <Typography sx={item.icon || item.reactIcon ? { marginLeft: 'var(--ds-space-2)' } : {}}>{item.label}</Typography>
                </MenuItem>
                <Collapse in={submenuOpen[item.label]} timeout='auto' unmountOnExit>
                  {item.subMenu?.map((subItem, subIndex) => (
                    <MenuItem
                      disabled={subItem.disabled ?? false}
                      key={subIndex}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuClick(e, subItem);
                      }}
                      sx={{ display: 'flex', alignItems: 'center' }}
                    >
                      {renderItemIcon(subItem)}
                      <Typography sx={subItem.icon || subItem.reactIcon ? { marginLeft: 'var(--ds-space-2)' } : {}}>{subItem.label}</Typography>
                    </MenuItem>
                  ))}
                </Collapse>
              </div>
            ) : (
              <MenuItem
                disabled={item.disabled ?? false}
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMenuClick(e, item);
                }}
                sx={{ display: 'flex', alignItems: 'center' }}
              >
                {renderItemIcon(item)}
                <Typography className={className} sx={item.icon || item.reactIcon ? { marginLeft: 'var(--ds-space-2)' } : {}}>
                  {item.label}
                </Typography>
                {item.releaseIcon ? (
                  <sup>
                    <SafeIcon alt={item.label} src={item.releaseIcon} height='20' width='20' />
                  </sup>
                ) : (
                  <></>
                )}
              </MenuItem>
            );
          })}
      </Menu>
    </React.Fragment>
  ) : (
    <></>
  );
};
ThreeDotsMenu.propTypes = {
  id: PropTypes.string,
  sx: PropTypes.object,
  onMenuClick: PropTypes.func,
  menuItems: PropTypes.array,
  data: PropTypes.any,
  lightIcon: PropTypes.string,
  className: PropTypes.string,
  menuWidth: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  align: PropTypes.oneOf(['start', 'end']),
  side: PropTypes.oneOf(['bottom', 'top', 'left', 'right']),
};

export default ThreeDotsMenu;
