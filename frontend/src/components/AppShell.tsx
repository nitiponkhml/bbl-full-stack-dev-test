import BookmarkIcon from '@mui/icons-material/Bookmark';
import LogoutIcon from '@mui/icons-material/Logout';
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tab,
  Tabs,
  Toolbar,
  Typography,
} from '@mui/material';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router';
import { getAuth0Config } from '../auth/config';
import { logout } from '../auth/logout';
import { getUserInfo } from '../auth/userInfo';

const NAV_ITEMS = [
  { label: 'Collections', path: '/collections' },
  { label: 'Bookmarks', path: '/bookmarks' },
];

export function AppShell(): ReactElement {
  const location = useLocation();
  const userInfo = getUserInfo();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const activeTab = NAV_ITEMS.some((item) => item.path === location.pathname)
    ? location.pathname
    : false;

  function handleSignOut() {
    setAnchorEl(null);
    logout(getAuth0Config());
  }

  const hasProfileInfo = Boolean(userInfo?.name || userInfo?.email);
  const avatarInitial = (userInfo?.name ?? userInfo?.email ?? '?')
    .charAt(0)
    .toUpperCase();

  return (
    <>
      <AppBar
        position="static"
        color="default"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <BookmarkIcon color="primary" />
          <Typography
            variant="h6"
            component="div"
            sx={{ mr: 2, whiteSpace: 'nowrap' }}
          >
            BBL Bookmarks
          </Typography>
          <Tabs value={activeTab} sx={{ flexGrow: 1, minHeight: 0 }}>
            {NAV_ITEMS.map((item) => (
              <Tab
                key={item.path}
                label={item.label}
                value={item.path}
                component={RouterLink}
                to={item.path}
              />
            ))}
          </Tabs>
          <IconButton
            aria-label="account menu"
            onClick={(event) => setAnchorEl(event.currentTarget)}
          >
            <Avatar
              src={userInfo?.picture ?? undefined}
              sx={{ width: 32, height: 32 }}
            >
              {!userInfo?.picture && avatarInitial}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            {hasProfileInfo && (
              <Box sx={{ px: 2, py: 1 }}>
                {userInfo?.name && (
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {userInfo.name}
                  </Typography>
                )}
                {userInfo?.email && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block' }}
                  >
                    {userInfo.email}
                  </Typography>
                )}
              </Box>
            )}
            {hasProfileInfo && <Divider />}
            <MenuItem onClick={handleSignOut}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Outlet />
    </>
  );
}
