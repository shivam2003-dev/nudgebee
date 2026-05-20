/**
 * @deprecated Use `DropdownMenu` from '@components1/ds/DropdownMenu' with a
 * `<IconButton><MoreVertIcon/></IconButton>` trigger instead. Per spec ThreeDotsMenu
 * is NOT a separate primitive — it's a configuration of DropdownMenu.
 * Tracked for removal 2026-06-06 (30-day deprecation clock from V2 ship 2026-05-07).
 */
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { Collapse, IconButton, ListItemIcon, Typography } from '@mui/material';

let _threeDotsMenuWarned = false;
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { MoreVert } from '@mui/icons-material';
import SafeIcon from './SafeIcon';
import { colors } from 'src/utils/colors';

function renderItemIcon(item) {
  if (item.reactIcon) {
    return <ListItemIcon>{item.reactIcon}</ListItemIcon>;
  }
  if (item.icon) {
    return <SafeIcon alt={item.label} src={item.icon} height='20' width='20' />;
  }
  return null;
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
 * }} props
 */

const ThreeDotsMenu = ({ id, sx = {}, onMenuClick, menuItems = [], data, lightIcon = '', className = '', menuWidth }) => {
  useEffect(() => {
    if (_threeDotsMenuWarned) return;
    _threeDotsMenuWarned = true;
    // eslint-disable-next-line no-console
    console.warn(
      '[deprecated] ThreeDotsMenu is deprecated. Use `import { DropdownMenu } from "@components1/ds/DropdownMenu"` with a MoreVert IconButton trigger instead. ' +
        'Tracked for removal 2026-06-06.'
    );
  }, []);
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
        PaperProps={{ sx: { ...(menuWidth && { width: menuWidth, minWidth: menuWidth }) } }}
      >
        {menuItems &&
          menuItems.map((item, index) => {
            return item.subMenu?.length > 0 ? (
              <div key={item.id || item.label || index}>
                <MenuItem
                  disabled={item.disabled ?? false}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSubmenuOpen({ ...submenuOpen, [item.label]: !submenuOpen[item.label] });
                  }}
                  sx={{ display: 'flex', alignItems: 'center' }}
                >
                  {renderItemIcon(item)}
                  <Typography sx={item.icon || item.reactIcon ? { marginLeft: '10px' } : {}}>{item.label}</Typography>
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
                      <Typography sx={subItem.icon || subItem.reactIcon ? { marginLeft: '10px' } : {}}>{subItem.label}</Typography>
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
                <Typography className={className} sx={item.icon || item.reactIcon ? { marginLeft: '10px' } : {}}>
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
};

export default ThreeDotsMenu;
