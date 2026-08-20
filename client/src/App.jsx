import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import DashboardLayout from './Dashboard-layout';
import DashboardOverview from './Pages/DashboardOverview';
import PlaceholderPage from './Pages/PlaceholderPage';
import Suppliers from './Pages/Suppliers';
import Categories from './Pages/Categories';
import Warehouse from './Pages/Warehouse';
import SuppliersInvoice from './Pages/SuppliersInvoice';
import Login from './Pages/Login';
import Register from './Pages/Register';
import Products from './Pages/Products.jsx';
import AddProduct from './Pages/AddProduct.jsx';
import EditProduct from './Pages/EditProduct.jsx';
import POS from './Pages/POS.jsx';
import ExpiredProducts from './Pages/ExpiredProducts.jsx';
import DeadStock from './Pages/DeadStock.jsx';
import Setting from './Pages/Setting.jsx';
import Transaction from './Pages/Transaction.jsx';
import Customers from './Pages/Customers.jsx';
import Expenses from './Pages/Expenses.jsx';
import ReceivablesPayables from './Pages/ReceivablesPayables.jsx';
import Staff from './Pages/Staff.jsx';
import Reports from './Pages/Reports.jsx';
import PreOrders from './Pages/PreOrders.jsx';
import Shippings from './Pages/Shippings.jsx';
// Define a decent, flat theme with Inter font
const theme = createTheme({
  typography: {
    fontFamily: '"Inter", "system-ui", "-apple-system", sans-serif',
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  palette: {
    primary: {
      main: '#2563eb', // Clean Blue
      light: '#3b82f6',
      dark: '#1d4ed8',
    },
    background: {
      default: '#f8fafc', // Clean slate bg
      paper: '#ffffff',
    },
    text: {
      primary: '#1e293b',
      secondary: '#64748b',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '& fieldset': {
            borderColor: '#e2e8f0',
          },
        },
      },
    },
    MuiDialog: {
      defaultProps: {
        transitionDuration: { enter: 50, exit: 50 },
      },
    },
    MuiModal: {
      defaultProps: {
        disableScrollLock: true,
      },
    },
  },
});

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <Routes>
          {/* Auth routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Dashboard Layout & Child Routes */}
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardOverview />} />
            <Route path="products" element={<Products />} />
            <Route path="products/add" element={<AddProduct />} />
            <Route path="products/edit/:id" element={<EditProduct />} />
            <Route path="pos" element={<POS />} />
            <Route path="pre-orders" element={<PreOrders />} />
            <Route path="expired-products" element={<ExpiredProducts />} />
            <Route path="dead-stock" element={<DeadStock />} />
            <Route path="categories" element={<Categories />} />
            <Route path="warehouse" element={<Warehouse />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="suppliers-invoice" element={<SuppliersInvoice />} />
            <Route path="customers" element={<Customers />} />
            <Route path="shippings" element={<Shippings />} />
            <Route path="invoice" element={<Transaction />} />
            <Route path="transaction" element={<Transaction />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="receivables-payables" element={<ReceivablesPayables />} />
            <Route path="staff" element={<Staff />} />
            <Route path="reports" element={<Reports />} />
            <Route path="setting" element={<Setting />} />
            {/* Catch all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;