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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  People as PeopleIcon,
  Star as StarIcon,
  LocalActivity as PromoIcon,
  AttachMoney as MoneyIcon,
  AccountBalanceWallet as WalletIcon
} from '@mui/icons-material';
import DataTable from '../Components/DataTable';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') ? import.meta.env.VITE_API_URL : window.location.origin);

const Customers = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [currency, setCurrency] = useState('Rs.');

  // Form Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    loyaltyPoints: '0',
    balance: '0'
  });

  // Delete Dialog States
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deleteIds, setDeleteIds] = useState([]);

  // Payment Dialog States
  const [openPaymentDialog, setOpenPaymentDialog] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentError, setPaymentError] = useState('');

  const handleOpenPayment = (customer) => {
    setPaymentCustomer(customer);
    setPaymentAmount(String(customer.balance || 0));
    setPaymentError('');
    setOpenPaymentDialog(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setPaymentError('');

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setPaymentError('Please enter a valid amount greater than 0.');
      return;
    }

    if (amt > paymentCustomer.balance) {
      setPaymentError(`Payment amount cannot exceed the owed balance of ${currency}${paymentCustomer.balance.toFixed(2)}.`);
      return;
    }

    const token = getToken();
    if (!token) return;

    setLoading(true);
    try {
      const newBalance = Math.max(0, paymentCustomer.balance - amt);
      const response = await fetch(`${API_URL}/api/customers/${paymentCustomer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          balance: newBalance
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update payment');
      }

      setSuccessMsg(`Payment of ${currency}${amt.toFixed(2)} received successfully!`);
      setOpenPaymentDialog(false);
      fetchCustomers();
    } catch (err) {
      setPaymentError(err.message || 'Failed to submit payment details');
    } finally {
      setLoading(false);
    }
  };

  const renderCustomerHistory = (customer) => {
    const sales = customer.sales || [];

    if (sales.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', pl: 4, py: 1 }}>
          No sales transactions found.
        </Typography>
      );
    }

    return (
      <Stack spacing={0.5} sx={{ pl: 2, py: 0.5 }}>
        {sales.map((sale) => {
          const saleDue = Math.max(0, sale.totalAmount - sale.paidAmount);
          const itemsStr = sale.items.map(item => `${item.name} (x${item.quantity})`).join(', ');
          return (
            <Box key={sale.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, color: '#475569', fontSize: '0.85rem' }}>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                style={{ color: 'rgba(37, 99, 235, 0.6)', flexShrink: 0 }} 
                aria-hidden="true"
              >
                <path d="m15 10 5 5-5 5"></path>
                <path d="M4 4v7a4 4 0 0 0 4 4h12"></path>
              </svg>
              
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b', minWidth: 90 }}>
                {sale.receiptNo}
              </Typography>
              
              <Typography variant="body2" sx={{ color: '#64748b', minWidth: 160 }}>
                {new Date(sale.createdAt).toLocaleString()}
              </Typography>
              
              <Typography variant="body2" sx={{ color: '#475569', flexGrow: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 400 }}>
                {itemsStr}
              </Typography>

              <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, minWidth: 220, textAlign: 'right', pr: 2 }}>
                Total: {currency}{sale.totalAmount.toFixed(2)} | Paid: {currency}{sale.paidAmount.toFixed(2)}
                {saleDue > 0 && (
                  <span style={{ color: '#ef4444', fontWeight: 700, marginLeft: '8px' }}>
                    (Due: {currency}{saleDue.toFixed(2)})
                  </span>
                )}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    );
  };

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
        if (data && data.currency) setCurrency(data.currency);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/customers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch customers');

      setCustomers(Array.isArray(data) ? data : []);
      setSelected([]);
    } catch (err) {
      setError(err.message || 'Something went wrong fetching customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchSettings();
  }, []);

  const handleOpenAdd = () => {
    setFormData({ name: '', phone: '', email: '', address: '', loyaltyPoints: '0', balance: '0' });
    setIsEdit(false);
    setEditId(null);
    setError('');
    setOpenDialog(true);
  };

  const handleOpenEdit = (customer) => {
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      loyaltyPoints: String(customer.loyaltyPoints || 0),
      balance: String(customer.balance || 0)
    });
    setIsEdit(true);
    setEditId(customer.id);
    setError('');
    setOpenDialog(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    const token = getToken();
    if (!token) return;

    setLoading(true);
    try {
      const url = isEdit ? `${API_URL}/api/customers/${editId}` : `${API_URL}/api/customers`;
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          address: formData.address.trim(),
          loyaltyPoints: parseInt(formData.loyaltyPoints) || 0,
          balance: parseFloat(formData.balance) || 0
        })
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to save customer');

      setSuccessMsg(isEdit ? 'Customer details updated successfully!' : 'Customer added successfully!');
      fetchCustomers();
      setOpenDialog(false);
    } catch (err) {
      setError(err.message || 'Failed to submit customer details');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async (ids) => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/customers`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids })
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to delete customer(s)');

      setSuccessMsg('Customer(s) deleted successfully!');
      fetchCustomers();
      setOpenDeleteDialog(false);
      setSelected([]);
    } catch (err) {
      setError(err.message || 'Failed to delete customer(s)');
    } finally {
      setLoading(false);
    }
  };

  // Stats calculation
  const totalCustomers = customers.length;
  const totalLoyaltyPoints = customers.reduce((sum, c) => sum + (c.loyaltyPoints || 0), 0);
  const totalCustomerSales = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
  const totalReceivable = customers.reduce((sum, c) => sum + (c.balance || 0), 0);
  const creditCustomersCount = customers.filter(c => (c.balance || 0) > 0).length;

  const columns = [
    { id: 'name', label: 'Customer Name', sortable: true, cellSx: { fontWeight: 600, color: '#0f172a' } },
    { id: 'phone', label: 'Phone Number', sortable: true },
    { id: 'email', label: 'Email', sortable: true },
    { id: 'address', label: 'Address', sortable: false },
    {
      id: 'loyaltyPoints',
      label: 'Loyalty Points',
      sortable: true,
      render: (row) => (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <StarIcon sx={{ color: '#eab308', fontSize: 16 }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.loyaltyPoints}</Typography>
        </Stack>
      )
    },
    {
      id: 'balance',
      label: 'Balance (Owed)',
      sortable: true,
      render: (row) => (
        <Typography 
          variant="body2" 
          sx={{ 
            fontWeight: 700, 
            color: (row.balance || 0) > 0 ? '#b91c1c' : '#16a34a' 
          }}
        >
          {currency} {(row.balance || 0).toFixed(2)}
        </Typography>
      )
    },
    {
      id: 'totalSpent',
      label: 'Total Purchased',
      sortable: true,
      render: (row) => `${currency} ${(row.totalSpent || 0).toFixed(2)}`
    },
    { id: 'visits', label: 'Visits', sortable: true },
    {
      id: 'actions',
      label: 'Actions',
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={0.5} alignItems="center" onClick={(e) => e.stopPropagation()}>
          {row.balance > 0 && (
            <IconButton
              onClick={() => handleOpenPayment(row)}
              size="small"
              sx={{ color: '#16a34a', '&:hover': { color: '#15803d', bgcolor: '#f0fdf4' } }}
              title="Receive Payment"
            >
              <MoneyIcon sx={{ fontSize: 18 }} />
            </IconButton>
          )}
          <IconButton
            onClick={() => handleOpenEdit(row)}
            size="small"
            sx={{ color: '#64748b', '&:hover': { color: '#2563eb' } }}
            title="Edit Customer"
          >
            <EditIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Stack>
      )
    }
  ];

  const bulkActions = [
    {
      label: 'Delete Selected',
      icon: <DeleteIcon sx={{ fontSize: 18 }} />,
      action: (selectedIds) => { setDeleteIds(selectedIds); setOpenDeleteDialog(true); },
      color: 'error'
    }
  ];

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', display: 'flex', flexDirection: 'column', gap: 3, fontFamily: '"Inter", sans-serif' }}>
      
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
          Customer Records
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenAdd}
          sx={{ borderRadius: 2 }}
        >
          Add Customer
        </Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Summary Cards */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: '20px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#eff6ff', borderRadius: 1.5, display: 'flex', color: '#2563eb' }}>
                <PeopleIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Total Customers
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#0f172a' }}>
                  {totalCustomers}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: '20px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#fef9c3', borderRadius: 1.5, display: 'flex', color: '#ca8a04' }}>
                <StarIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Loyalty Points Awarded
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#0f172a' }}>
                  {totalLoyaltyPoints}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: '20px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#ecfdf5', borderRadius: 1.5, display: 'flex', color: '#10b981' }}>
                <PromoIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Customer Valuation
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#10b981' }}>
                  {currency} {totalCustomerSales.toFixed(2)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: '20px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#fef2f2', borderRadius: 1.5, display: 'flex', color: '#ef4444' }}>
                <MoneyIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Total Receivable
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#ef4444' }}>
                  {currency} {totalReceivable.toFixed(2)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: '20px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#faf5ff', borderRadius: 1.5, display: 'flex', color: '#a855f7' }}>
                <WalletIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Debtors (Khata Holders)
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#a855f7' }}>
                  {creditCustomersCount}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Customers Table */}
      <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          data={customers}
          loading={loading}
          selected={selected}
          onSelectedChange={setSelected}
          bulkActions={bulkActions}
          searchPlaceholder="Search customers..."
          storageKey="customers_table"
          renderExpandedRow={renderCustomerHistory}
        />
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          {isEdit ? 'Edit Customer' : 'Add New Customer'}
        </DialogTitle>
        <Divider sx={{ mx: 3 }} />
        <form onSubmit={handleFormSubmit}>
          <DialogContent sx={{ py: 3 }}>
            <Stack spacing={3}>
              <TextField
                label="Customer Name"
                variant="standard"
                required
                fullWidth
                size="small"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <TextField
                label="Phone Number"
                variant="standard"
                fullWidth
                size="small"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
              <TextField
                label="Email Address"
                variant="standard"
                fullWidth
                type="email"
                size="small"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <TextField
                label="Home/Billing Address"
                variant="standard"
                fullWidth
                size="small"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
              <TextField
                label="Loyalty Program Points"
                variant="standard"
                fullWidth
                type="number"
                size="small"
                value={formData.loyaltyPoints}
                onChange={(e) => setFormData({ ...formData, loyaltyPoints: e.target.value })}
              />
              <TextField
                label="Balance Owed (Credit)"
                variant="standard"
                fullWidth
                type="number"
                size="small"
                value={formData.balance}
                onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setOpenDialog(false)}
              color="inherit"
              variant="outlined"
              sx={{ borderRadius: 1.5 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              sx={{ borderRadius: 1.5 }}
            >
              {isEdit ? 'Save Changes' : 'Add Customer'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={() => setOpenDeleteDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1, color: '#b91c1c' }}>
          Confirm Deletion
        </DialogTitle>
        <Divider sx={{ mx: 3 }} />
        <DialogContent sx={{ py: 3 }}>
          <Typography variant="body2" sx={{ color: '#475569' }}>
            Are you sure you want to delete {deleteIds.length} selected customer(s)? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setOpenDeleteDialog(false)}
            color="inherit"
            variant="outlined"
            sx={{ borderRadius: 1.5 }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => handleBulkDelete(deleteIds)}
            color="error"
            variant="contained"
            sx={{ borderRadius: 1.5, boxShadow: 'none', '&:hover': { boxShadow: 'none' } }}
          >
            Delete Customer(s)
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pay Owed Balance Dialog */}
      <Dialog
        open={openPaymentDialog}
        onClose={() => setOpenPaymentDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1, color: '#16a34a' }}>
          Receive Payment
        </DialogTitle>
        <Divider sx={{ mx: 3 }} />
        <form onSubmit={handlePaymentSubmit}>
          <DialogContent sx={{ py: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {paymentError && <Alert severity="error">{paymentError}</Alert>}
            {paymentCustomer && (
              <Box>
                <Typography variant="body2" sx={{ color: '#475569', mb: 1 }}>
                  Customer Name: <strong>{paymentCustomer.name}</strong>
                </Typography>
                <Typography variant="body2" sx={{ color: '#475569', mb: 2 }}>
                  Current Owed Balance: <strong>{currency}{paymentCustomer.balance.toFixed(2)}</strong>
                </Typography>
                <TextField
                  label="Amount to Pay"
                  type="number"
                  variant="standard"
                  required
                  fullWidth
                  size="small"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  slotProps={{
                    htmlInput: { min: 0.01, step: 0.01 }
                  }}
                />
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setOpenPaymentDialog(false)}
              color="inherit"
              variant="outlined"
              sx={{ borderRadius: 1.5 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="success"
              sx={{ borderRadius: 1.5 }}
            >
              Receive Payment
            </Button>
          </DialogActions>
        </form>
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

export default Customers;
