import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  IconButton,
  Badge,
  TextField,
  InputAdornment,
  LinearProgress,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Avatar,
  Menu,
  MenuItem
} from '@mui/material';
import {
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  Info as InfoIcon,
  Menu as MenuIcon,
  Warning as ProductIcon,
  Error as ErrorIcon,
  ReceiptLong as LoanIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon
} from '@mui/icons-material';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') ? import.meta.env.VITE_API_URL : window.location.origin);

const DashboardHeader = ({ onMenuClick, onCollapseToggle, isCollapsed }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [profileAnchorEl, setProfileAnchorEl] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error(err);
      }
    }
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`${API_URL}/api/dashboard/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 450);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const handleOpenNotifications = (event) => {
    setAnchorEl(event.currentTarget);
    fetchNotifications();
  };

  const handleCloseNotifications = () => {
    setAnchorEl(null);
  };

  const handleOpenProfileMenu = (event) => {
    setProfileAnchorEl(event.currentTarget);
  };

  const handleCloseProfileMenu = () => {
    setProfileAnchorEl(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const open = Boolean(anchorEl);
  const id = open ? 'notifications-popover' : undefined;
  const openProfileMenu = Boolean(profileAnchorEl);

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        color: '#1e293b'
      }}
    >
      {loading && (
        <LinearProgress
          sx={{
            height: 3,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1101,
            bgcolor: '#eff6ff',
            '& .MuiLinearProgress-bar': {
              backgroundColor: '#2563eb'
            }
          }}
        />
      )}
      <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, md: 3 }, py: 1, minHeight: '5.5' }}>

        {/* Left Container: Mobile menu and Search Bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton
            onClick={() => {
              if (window.innerWidth < 1200) {
                onMenuClick();
              } else {
                onCollapseToggle();
              }
            }}
            sx={{
              color: '#475569',
              p: 1,
              '&:hover': { backgroundColor: '#f1f5f9' }
            }}
          >
            <MenuIcon sx={{ fontSize: 20 }} />
          </IconButton>

          {/* Simple Search bar with active width transition */}
          <TextField
            size="small"
            placeholder="Search products..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                navigate(`/products?search=${encodeURIComponent(e.target.value.trim())}`);
              }
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }
            }}
            sx={{
              width: 200,
              transition: 'width 0.15s ease-in-out',
              '&:focus-within': {
                width: 300,
              },
              '& .MuiOutlinedInput-root': {
                height: 36,
                borderRadius: 2,
                fontSize: '0.825rem',
                fontFamily: '"Inter", sans-serif',
                backgroundColor: '#f1f5f9',
              }
            }}
          />
        </Box>

        {/* Right Actions: Buttons */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {/* Notification Button */}
          <IconButton
            onClick={handleOpenNotifications}
            sx={{
              color: '#475569',
              p: 1,
              '&:hover': { backgroundColor: '#f1f5f9', color: '#0f172a' }
            }}
          >
            <Badge badgeContent={notifications.length} color="error" overlap="circular">
              <NotificationsIcon sx={{ fontSize: 20 }} />
            </Badge>
          </IconButton>

          <Popover
            id={id}
            open={open}
            anchorEl={anchorEl}
            onClose={handleCloseNotifications}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            slotProps={{
              paper: {
                sx: {
                  width: 340,
                  maxHeight: 420,
                  borderRadius: 2,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                  border: '1px solid #e2e8f0',
                  mt: 1
                }
              }
            }}
          >
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                Notifications ({notifications.length})
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                Click to open/edit
              </Typography>
            </Box>
            <List sx={{ p: 0, maxHeight: 350, overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <Box sx={{ py: 4, px: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No new alerts or notifications.
                  </Typography>
                </Box>
              ) : (
                notifications.map((n, idx) => {
                  const prodId = n.productId || (n.id ? n.id.replace('low-stock-', '').replace('expiry-', '') : null);
                  const isProductAlert = n.type === 'low-stock' || n.type === 'expiry';

                  return (
                    <React.Fragment key={n.id}>
                      {idx > 0 && <Divider />}
                      <ListItem
                        button
                        onClick={() => {
                          handleCloseNotifications();
                          if (isProductAlert && prodId) {
                            navigate(`/products/edit/${prodId}`);
                          } else if (n.type === 'loan') {
                            navigate('/receivables-payables');
                          }
                        }}
                        sx={{
                          alignItems: 'flex-start',
                          py: 1.5,
                          px: 2,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          '&:hover': {
                            bgcolor: '#f8fafc',
                            '& .MuiTypography-root': { color: '#2563eb' }
                          }
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>
                          {n.type === 'low-stock' && <ProductIcon sx={{ color: '#f59e0b', fontSize: 18 }} />}
                          {n.type === 'expiry' && <ErrorIcon sx={{ color: n.severity === 'error' ? '#ef4444' : '#f59e0b', fontSize: 18 }} />}
                          {n.type === 'loan' && <LoanIcon sx={{ color: '#ef4444', fontSize: 18 }} />}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.825rem' }}>
                                {n.title}
                              </Typography>
                              {isProductAlert && (
                                <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 600, fontSize: '0.7rem' }}>
                                  Edit ↗
                                </Typography>
                              )}
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.4, fontSize: '0.72rem' }}>
                              {n.message}
                            </Typography>
                          }
                        />
                      </ListItem>
                    </React.Fragment>
                  );
                })
              )}
            </List>
          </Popover>

          {/* Avatar with dropdown */}
          <IconButton
            onClick={handleOpenProfileMenu}
            sx={{ p: 0.5, '&:hover': { backgroundColor: '#f1f5f9' } }}
          >
            <Avatar
              sx={{
                width: 32,
                height: 32,
                fontSize: '0.875rem',
                fontWeight: 600,
                bgcolor: '#2563eb',
                color: '#ffffff'
              }}
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={profileAnchorEl}
            open={openProfileMenu}
            onClose={handleCloseProfileMenu}
            onClick={handleCloseProfileMenu}
            slotProps={{
              paper: {
                elevation: 0,
                sx: {
                  overflow: 'visible',
                  filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.08))',
                  mt: 1.5,
                  borderRadius: 2,
                  border: '1px solid #e2e8f0',
                  minWidth: 180,
                  '& .MuiAvatar-root': {
                    width: 32,
                    height: 32,
                    ml: -0.5,
                    mr: 1,
                  },
                  '&::before': {
                    content: '""',
                    display: 'block',
                    position: 'absolute',
                    top: 0,
                    right: 14,
                    width: 10,
                    height: 10,
                    bgcolor: 'background.paper',
                    transform: 'translateY(-50%) rotate(45deg)',
                    zIndex: 0,
                  },
                },
              }
            }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                {user?.name || 'BF Makeup User'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                {user?.email || 'user@BF Makeup.com'}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => navigate('/setting')} sx={{ fontSize: '0.85rem', color: '#334155' }}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" sx={{ color: '#64748b' }} />
              </ListItemIcon>
              Store Settings
            </MenuItem>
            <MenuItem onClick={handleLogout} sx={{ fontSize: '0.85rem', color: '#b91c1c' }}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" sx={{ color: '#b91c1c' }} />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>

        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default DashboardHeader;
