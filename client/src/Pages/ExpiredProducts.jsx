import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Grid,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Inventory as InventoryIcon,
  MoneyOff as MoneyOffIcon
} from '@mui/icons-material';
import DataTable from '../Components/DataTable';
import dayjs from 'dayjs';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') ? import.meta.env.VITE_API_URL : window.location.origin);

const ExpiredProducts = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [openDisposeDialog, setOpenDisposeDialog] = useState(false);
  const [disposeIds, setDisposeIds] = useState([]);
  const [currency, setCurrency] = useState('Rs.');

  const getToken = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return null;
    }
    return token;
  };

  const fetchSettings = async () => {
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.currency) {
          setCurrency(data.currency);
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch products');

      setProducts(Array.isArray(data) ? data : []);
      setSelected([]);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchSettings();
  }, []);

  // Filter in-stock expired products
  const expiredProducts = products.filter(p => {
    if (!p.expiryDate || p.stock <= 0) return false;
    const expDate = dayjs(p.expiryDate);
    const today = dayjs().startOf('day');
    return expDate.isBefore(today);
  });

  // Calculate statistics
  const totalExpiredItems = expiredProducts.length;
  const totalExpiredStock = expiredProducts.reduce((sum, p) => sum + p.stock, 0);
  const totalValueLost = expiredProducts.reduce((sum, p) => sum + (p.stock * p.price), 0);

  const handleDisposeStock = async (product) => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/products/${product.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: product.name,
          barcode: product.barcode,
          price: product.price,
          stock: 0, // Set stock to 0 to dispose
          unit: product.unit,
          expiryDate: product.expiryDate,
          categoryId: product.categoryId
        })
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to dispose product stock');

      setSuccessMsg(`Disposed stock of ${product.name} successfully.`);
      fetchProducts();
    } catch (err) {
      setError(err.message || 'Failed to dispose stock');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDispose = async (ids) => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const token = getToken();
      if (!token) return;

      const promises = ids.map(id => {
        const product = products.find(p => p.id === id);
        if (!product) return Promise.resolve();
        return fetch(`${API_URL}/api/products/${product.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: product.name,
            barcode: product.barcode,
            price: product.price,
            stock: 0,
            unit: product.unit,
            expiryDate: product.expiryDate,
            categoryId: product.categoryId
          })
        });
      });

      await Promise.all(promises);
      setSuccessMsg('Bulk disposed selected expired products successfully.');
      fetchProducts();
      setOpenDisposeDialog(false);
      setSelected([]);
    } catch (err) {
      setError('Something went wrong during bulk disposal');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { id: 'name', label: 'Product Name', sortable: true, cellSx: { fontWeight: 600, color: '#0f172a' } },
    { id: 'barcode', label: 'Barcode', sortable: true, render: (row) => <Typography sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>{row.barcode}</Typography> },
    {
      id: 'price',
      label: 'Unit Price',
      sortable: true,
      render: (row) => `${currency} ${parseFloat(row.price).toFixed(2)}`
    },
    { id: 'stock', label: 'Expired Qty', sortable: true, render: (row) => `${row.stock} ${row.unit || 'pcs'}` },
    {
      id: 'totalLost',
      label: 'Value Lost',
      sortable: true,
      render: (row) => `${currency} ${(parseFloat(row.price) * parseFloat(row.stock)).toFixed(2)}`
    },
    {
      id: 'expiryDate',
      label: 'Expiry Date',
      sortable: true,
      render: (row) => <Typography sx={{ color: '#ef4444', fontWeight: 600 }}>{dayjs(row.expiryDate).format('DD/MM/YYYY')}</Typography>
    },
    {
      id: 'daysAgo',
      label: 'Status',
      sortable: false,
      render: (row) => {
        const days = dayjs().startOf('day').diff(dayjs(row.expiryDate).startOf('day'), 'day');
        return (
          <Typography variant="caption" sx={{ px: 1, py: 0.5, bgcolor: '#fef2f2', color: '#b91c1c', borderRadius: 1, fontWeight: 600 }}>
            Expired {days} {days === 1 ? 'day' : 'days'} ago
          </Typography>
        );
      }
    },
    {
      id: 'actions',
      label: 'Actions',
      sortable: false,
      render: (row) => (
        <Button
          size="small"
          color="error"
          variant="outlined"
          onClick={(e) => { e.stopPropagation(); handleDisposeStock(row); }}
          sx={{ borderRadius: 1.5, textTransform: 'none', py: 0.5 }}
        >
          Dispose
        </Button>
      )
    }
  ];

  const bulkActions = [
    {
      label: 'Dispose Selected',
      icon: <DeleteIcon sx={{ fontSize: 18 }} />,
      action: (selectedIds) => { setDisposeIds(selectedIds); setOpenDisposeDialog(true); },
      color: 'error'
    }
  ];

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', display: 'flex', flexDirection: 'column', gap: 3, fontFamily: '"Inter", sans-serif' }}>
      
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
          Expired Products
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Summary Stat Cards */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ border: '1px solid #fee2e2', bgcolor: '#fff', borderRadius: 1 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: '20px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#fef2f2', borderRadius: 1.5, display: 'flex', color: '#ef4444' }}>
                <WarningIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Expired Items In-Stock
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#0f172a' }}>
                  {totalExpiredItems}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 1 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: '20px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 1.5, display: 'flex', color: '#64748b' }}>
                <InventoryIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Total Expired Stock
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#0f172a' }}>
                  {totalExpiredStock}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card sx={{ border: '1px solid #fee2e2', bgcolor: '#fff', borderRadius: 1 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: '20px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#fff5f5', borderRadius: 1.5, display: 'flex', color: '#dc2626' }}>
                <MoneyOffIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Total Value Lost
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#dc2626' }}>
                  {currency} {totalValueLost.toFixed(2)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Table */}
      <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          data={expiredProducts}
          loading={loading}
          selected={selected}
          onSelectedChange={setSelected}
          bulkActions={bulkActions}
          searchPlaceholder="Search expired products..."
          storageKey="expired_table"
        />
      </Card>

      {/* Dispose Confirmation Dialog */}
      <Dialog
        open={openDisposeDialog}
        onClose={() => setOpenDisposeDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1, color: '#b91c1c' }}>
          Confirm Disposal
        </DialogTitle>
        <Divider sx={{ mx: 3 }} />
        <DialogContent sx={{ py: 3 }}>
          <Typography variant="body2" sx={{ color: '#475569' }}>
            Are you sure you want to dispose of the stock (reset stock to 0) for {disposeIds.length} selected product(s)? This action will remove them from inventory.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setOpenDisposeDialog(false)}
            color="inherit"
            variant="outlined"
            sx={{ borderRadius: 1.5 }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => handleBulkDispose(disposeIds)}
            color="error"
            variant="contained"
            disabled={loading}
            sx={{ borderRadius: 1.5, boxShadow: 'none', '&:hover': { boxShadow: 'none' } }}
          >
            {loading ? 'Disposing...' : 'Dispose Stock'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Global Success Notifications */}
      <Snackbar
        open={!!successMsg}
        autoHideDuration={4000}
        onClose={() => setSuccessMsg('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSuccessMsg('')} severity="success" variant="filled" sx={{ width: '100%', borderRadius: 2 }}>
          {successMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ExpiredProducts;
