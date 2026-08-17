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
  Snackbar,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Inventory as InventoryIcon,
  TrendingDown as DiscountIcon,
  MoneyOff as MoneyOffIcon,
  LocalOffer as OfferIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import DataTable from '../Components/DataTable';
import dayjs from 'dayjs';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') ? import.meta.env.VITE_API_URL : window.location.origin);

const DeadStock = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [currency, setCurrency] = useState('Rs.');

  // Discount dialog states
  const [openDiscountDialog, setOpenDiscountDialog] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(20);
  const [targetProduct, setTargetProduct] = useState(null);

  // Dispose confirmation state
  const [openDisposeDialog, setOpenDisposeDialog] = useState(false);
  const [disposeIds, setDisposeIds] = useState([]);

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

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      if (!token) return;

      // Fetch products and sales in parallel
      const [prodRes, salesRes] = await Promise.all([
        fetch(`${API_URL}/api/products`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/sales`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (prodRes.status === 401 || salesRes.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const prodsData = await prodRes.json();
      const salesData = await salesRes.json();

      setProducts(Array.isArray(prodsData) ? prodsData : []);
      setSales(Array.isArray(salesData) ? salesData : []);
      setSelected([]);
    } catch (err) {
      setError(err.message || 'Something went wrong fetching data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, []);

  // Filter in-stock damaged products (marked as damaged OR unsold in last 30 days)
  const damagedProducts = products.filter(p => {
    if (p.isDamaged) return true;
    if (p.stock <= 0) return false;

    // Find all sales of this product in the last 30 days
    const limitDate = dayjs().subtract(30, 'day');
    const hasRecentSale = sales.some(sale => {
      const saleDate = dayjs(sale.createdAt);
      if (saleDate.isBefore(limitDate)) return false;
      return sale.items.some(item => item.productId === p.id);
    });

    return !hasRecentSale;
  });

  // Calculate statistics
  const totalDamagedItems = damagedProducts.length;
  const totalDamagedQty = damagedProducts.reduce((sum, p) => sum + (parseFloat(p.stock) || 0), 0);
  const totalCapitalLocked = damagedProducts.reduce((sum, p) => sum + ((parseFloat(p.stock) || 0) * (parseFloat(p.supplierPrice || p.price) || 0)), 0);

  const handleApplyDiscount = async () => {
    if (!targetProduct) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const token = getToken();
      if (!token) return;

      // Calculate discounted price
      const currentPrice = targetProduct.price;
      const factor = (100 - parseFloat(discountPercent)) / 100;
      const newPrice = parseFloat((currentPrice * factor).toFixed(2));

      const response = await fetch(`${API_URL}/api/products/${targetProduct.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: targetProduct.name,
          barcode: targetProduct.barcode,
          price: newPrice,
          stock: targetProduct.stock,
          unit: targetProduct.unit,
          expiryDate: targetProduct.expiryDate,
          categoryId: targetProduct.categoryId
        })
      });

      if (!response.ok) throw new Error('Failed to update product price');

      setSuccessMsg(`Applied ${discountPercent}% discount to ${targetProduct.name}. New Price: ${currency} ${newPrice}`);
      setOpenDiscountDialog(false);
      setTargetProduct(null);
      fetchData();
    } catch (err) {
      setError(err.message || 'Something went wrong discounting');
    } finally {
      setLoading(false);
    }
  };

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

      if (!response.ok) throw new Error('Failed to dispose product stock');

      setSuccessMsg(`Disposed stock of ${product.name} successfully.`);
      fetchData();
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
      setSuccessMsg('Bulk disposed selected dead stock products successfully.');
      fetchData();
      setOpenDisposeDialog(false);
      setSelected([]);
    } catch (err) {
      setError('Something went wrong during bulk disposal');
    } finally {
      setLoading(false);
    }
  };

  // Find last sale date for a product
  const getLastSaleDate = (productId) => {
    const productSales = sales
      .filter(sale => sale.items.some(item => item.productId === productId))
      .sort((a, b) => dayjs(b.createdAt).diff(dayjs(a.createdAt)));

    if (productSales.length === 0) return 'Never';
    return dayjs(productSales[0].createdAt).format('DD/MM/YYYY');
  };

  const columns = [
    {
      id: 'name',
      label: 'Product Name',
      sortable: true,
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>
            {row.name}
          </Typography>
          {row.isDamaged && (
            <Chip
              label="Damaged"
              size="small"
              sx={{ bgcolor: '#fef2f2', color: '#dc2626', fontWeight: 700, fontSize: '0.68rem', height: 20 }}
            />
          )}
        </Box>
      )
    },
    { id: 'barcode', label: 'Barcode', sortable: true, render: (row) => <Typography sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>{row.barcode}</Typography> },
    {
      id: 'price',
      label: 'Unit Price',
      sortable: true,
      render: (row) => `${currency} ${parseFloat(row.price).toFixed(2)}`
    },
    { id: 'stock', label: 'Stock Qty', sortable: true, render: (row) => `${row.stock} ${row.unit || 'pcs'}` },
    {
      id: 'capitalLocked',
      label: 'Value Locked',
      sortable: true,
      render: (row) => `${currency} ${(parseFloat(row.price) * parseFloat(row.stock)).toFixed(2)}`
    },
    {
      id: 'lastSale',
      label: 'Last Sale Date',
      sortable: false,
      render: (row) => {
        const lastSale = getLastSaleDate(row.id);
        return (
          <Typography variant="body2" sx={{ fontWeight: 500, color: lastSale === 'Never' ? '#64748b' : '#334155' }}>
            {lastSale}
          </Typography>
        );
      }
    },
    {
      id: 'daysAdded',
      label: 'Age In Inventory',
      sortable: false,
      render: (row) => {
        const days = dayjs().diff(dayjs(row.createdAt), 'day');
        return `${days} days ago`;
      }
    },
    {
      id: 'actions',
      label: 'Actions',
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            color="primary"
            variant="outlined"
            startIcon={<OfferIcon sx={{ fontSize: 12 }} />}
            onClick={(e) => {
              e.stopPropagation();
              setTargetProduct(row);
              setDiscountPercent(20);
              setOpenDiscountDialog(true);
            }}
            sx={{ borderRadius: 1.5, textTransform: 'none', py: 0.5, fontSize: '0.75rem' }}
          >
            Promo
          </Button>
          <Button
            size="small"
            color="error"
            variant="outlined"
            onClick={(e) => { e.stopPropagation(); handleDisposeStock(row); }}
            sx={{ borderRadius: 1.5, textTransform: 'none', py: 0.5, fontSize: '0.75rem' }}
          >
            Dispose
          </Button>
        </Stack>
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
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
            Damaged Products
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Track, manage, discount, or dispose damaged and defective stock items.
          </Typography>
        </Box>
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
                  Total Damaged Items
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#0f172a' }}>
                  {totalDamagedItems}
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
                  Total Damaged Stock Qty
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#0f172a' }}>
                  {totalDamagedQty}
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
                  Capital in Damaged Stock
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#dc2626' }}>
                  {currency} {totalCapitalLocked.toFixed(2)}
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
          data={damagedProducts}
          loading={loading}
          selected={selected}
          onSelectedChange={setSelected}
          bulkActions={bulkActions}
          searchPlaceholder="Search damaged products..."
        />
      </Card>

      {/* Discount Dialog */}
      <Dialog
        open={openDiscountDialog}
        onClose={() => setOpenDiscountDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Apply Promo Discount</DialogTitle>
        <Divider sx={{ mx: 3 }} />
        <DialogContent sx={{ py: 3 }}>
          {targetProduct && (
            <Stack spacing={2.5}>
              <Typography variant="body2" sx={{ color: '#475569' }}>
                Quickly apply a discount to the price of <strong>{targetProduct.name}</strong> to help clear it from stock.
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', bgcolor: '#f8fafc', p: 1.5, borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Current Price:</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{currency} {targetProduct.price.toFixed(2)}</Typography>
              </Box>
              
              <FormControl variant="standard" fullWidth>
                <InputLabel>Discount Percentage</InputLabel>
                <Select
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                >
                  <MenuItem value={10}>10% Off</MenuItem>
                  <MenuItem value={20}>20% Off</MenuItem>
                  <MenuItem value={30}>30% Off</MenuItem>
                  <MenuItem value={40}>40% Off</MenuItem>
                  <MenuItem value={50}>50% Off</MenuItem>
                  <MenuItem value={70}>70% Off</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenDiscountDialog(false)} color="inherit" variant="outlined" sx={{ borderRadius: 1.5 }}>
            Cancel
          </Button>
          <Button onClick={handleApplyDiscount} variant="contained" color="primary" sx={{ borderRadius: 1.5 }}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>

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

export default DeadStock;
