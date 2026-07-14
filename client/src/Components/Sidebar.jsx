import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  AssignmentInd as SuppliersIcon,
  GridView as CategoriesIcon,
  Warehouse as WarehouseIcon,
  ShoppingCart as ShoppingCartIcon,
  PersonOutlined as CustomersIcon,
  Cached as TransactionIcon,
  Description as InvoiceIcon,
  AttachMoney as LoanIcon,
  Settings as SettingIcon,
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  ReceiptLong as SuppliersInvoiceIcon,
  Inventory as ProductsIcon,
  RemoveShoppingCart as ExpiredProductsIcon,
  Report as DeadStockIcon,
  BarChart as ReportsIcon,
  AccountBalanceWallet as ExpensesIcon
} from '@mui/icons-material';


const Sidebar = ({ isOpen, toggleSidebar, isMobile, isCollapsed }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  const sidebarItems = [
    { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
    { label: 'POS (Cashier)', path: '/pos', icon: ShoppingCartIcon },
    { label: 'Products', path: '/products', icon: ProductsIcon },
    { label: 'Brands', path: '/categories', icon: CategoriesIcon },
    { label: 'Suppliers', path: '/suppliers', icon: SuppliersIcon },
    { label: 'Finance', path: '/receivables-payables', icon: LoanIcon },
    { label: 'Customers', path: '/customers', icon: CustomersIcon },
    { label: 'Warehouse', path: '/warehouse', icon: WarehouseIcon },
    { label: 'Suppliers Invoice', path: '/suppliers-invoice', icon: SuppliersInvoiceIcon },
    { label: 'Expired Products', path: '/expired-products', icon: ExpiredProductsIcon },
    { label: 'Dead Stock', path: '/dead-stock', icon: DeadStockIcon },
    { label: 'Transaction', path: '/transaction', icon: TransactionIcon },
    { label: 'Invoice', path: '/invoice', icon: InvoiceIcon },
    { label: 'Expenses', path: '/expenses', icon: ExpensesIcon },
    { label: 'Staff', path: '/staff', icon: CustomersIcon },
    { label: 'Reports', path: '/reports', icon: ReportsIcon }, // Looks like anchor/stats in mockup
    { label: 'Setting', path: '/setting', icon: SettingIcon }
  ];

  const isActive = (path) => {
    if (path === '/dashboard' && (currentPath === '/' || currentPath === '/dashboard')) {
      return true;
    }
    return currentPath === path;
  };

  const sidebarContent = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#ffffff',
        borderRight: '1px solid #f0f0f0',
        userSelect: 'none',
      }}
    >
      {/* Mobile Close Button */}
      {isMobile && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 2, pb: 1 }}>
          <IconButton onClick={toggleSidebar} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      )}

      {/* Brand Logo Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          py: 1.5,
          px: isCollapsed ? 1 : 2.5,
          borderBottom: '1px solid #f1f5f9',
          mb: 1
        }}
      >
        <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Box
            component="img"
            src="/bglogo.png"
            alt="storeLogo"
            sx={{
              width: isCollapsed ? 32 : 120,
              height: isCollapsed ? 32 : 'auto',
              objectFit: 'contain',
              transition: 'all 0.2s ease-in-out',
              cursor: 'pointer'
            }}
          />
        </Link>
      </Box>


      {/* Navigation List */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          '&::-webkit-scrollbar': { width: '4px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { background: '#cbd5e1', borderRadius: '4px' }
        }}
      >
        <List disablePadding sx={{ display: 'flex', flexDirection: 'column' }}>
          {sidebarItems.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            const itemButton = (
              <ListItemButton
                component={Link}
                to={item.path}
                onClick={isMobile ? toggleSidebar : undefined}
                selected={active}
                sx={{
                  px: isCollapsed ? 1 : 2,
                  py: isCollapsed ? 1 : 0.75,
                  color: active ? '#2563eb' : '#4a5568',
                  backgroundColor: active ? '#f8fafc' : 'transparent',
                  borderLeft: active ? '3px solid #2563eb' : '3px solid transparent',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  transition: 'all 0.15s ease-in-out',
                  '&.Mui-selected': {
                    backgroundColor: '#f8fafc',
                    color: '#2563eb',
                    '& .MuiListItemIcon-root': { color: '#2563eb' },
                    '& .MuiSvgIcon-root': { color: '#2563eb' },
                    '&:hover': { backgroundColor: '#f1f5f9' }
                  },
                  '&:hover': {
                    backgroundColor: '#f8fafc',
                    color: '#0f172a',
                    '& .MuiListItemIcon-root': { color: '#0f172a' }
                  }
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: isCollapsed ? 'auto' : 32,
                    color: active ? '#2563eb' : '#5c6a79',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Icon sx={{ fontSize: 18 }} />
                </ListItemIcon>
                {!isCollapsed && (
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: '16px',
                      fontWeight: active ? 600 : 500,
                      fontFamily: '"Inter", sans-serif',
                      color: 'inherit'
                    }}
                  />
                )}
                {!isCollapsed && (
                  <ChevronRightIcon
                    sx={{
                      fontSize: 14,
                      color: active ? '#2563eb' : '#cbd5e1',
                      ml: 1
                    }}
                  />
                )}
              </ListItemButton>
            );

            return (
              <ListItem key={item.label} disablePadding>
                {isCollapsed ? (
                  <Tooltip title={item.label} placement="right" arrow>
                    {itemButton}
                  </Tooltip>
                ) : (
                  itemButton
                )}
              </ListItem>
            );
          })}
        </List>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={isOpen}
        onClose={toggleSidebar}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', lg: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: 240,
            borderRight: 'none'
          },
        }}
      >
        {sidebarContent}
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', lg: 'block' },
          width: isCollapsed ? 55 : 240,
          flexShrink: 0,
          transition: 'width 0.2s ease-in-out',
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: isCollapsed ? 55 : 240,
            position: 'sticky',
            height: '100vh',
            borderRight: 'none',
            transition: 'width 0.2s ease-in-out',
            overflowX: 'hidden'
          },
        }}
        open
      >
        {sidebarContent}
      </Drawer>
    </>
  );
};

export default Sidebar;
