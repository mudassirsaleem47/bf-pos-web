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
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AccountBalanceWallet as WalletIcon,
  Payments as PaymentsIcon,
  Category as CategoryIcon
} from '@mui/icons-material';
import DataTable from '../Components/DataTable';
import dayjs from 'dayjs';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') ? import.meta.env.VITE_API_URL : window.location.origin);

const EXPENSE_CATEGORIES = [
  'Rent / Warehouse',
  'Utilities (Electricity, Water)',
  'Employee Salary',
  'Inventory Purchases',
  'Logistics / Shipping',
  'Marketing / Promotion',
  'Hardware / Office Supplies',
  'Miscellaneous'
];

const Expenses = () => {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
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
    title: '',
    category: '',
    amount: '',
    date: dayjs().format('YYYY-MM-DD'),
    description: ''
  });

  // Delete Dialog States
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deleteIds, setDeleteIds] = useState([]);

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

  const fetchExpenses = async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/expenses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch expenses');

      setExpenses(Array.isArray(data) ? data : []);
      setSelected([]);
    } catch (err) {
      setError(err.message || 'Failed to fetch expense records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchSettings();
  }, []);

  const handleOpenAdd = () => {
    setFormData({
      title: '',
      category: '',
      amount: '',
      date: dayjs().format('YYYY-MM-DD'),
      description: ''
    });
    setIsEdit(false);
    setEditId(null);
    setError('');
    setOpenDialog(true);
  };

  const handleOpenEdit = (expense) => {
    setFormData({
      title: expense.title,
      category: expense.category,
      amount: String(expense.amount),
      date: expense.date ? expense.date.slice(0, 10) : dayjs().format('YYYY-MM-DD'),
      description: expense.description || ''
    });
    setIsEdit(true);
    setEditId(expense.id);
    setError('');
    setOpenDialog(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim() || !formData.category || !formData.amount) {
      setError('All fields except description are required');
      return;
    }

    const token = getToken();
    if (!token) return;

    setLoading(true);
    try {
      const url = isEdit ? `${API_URL}/api/expenses/${editId}` : `${API_URL}/api/expenses`;
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          category: formData.category,
          amount: parseFloat(formData.amount) || 0,
          date: formData.date,
          description: formData.description.trim()
        })
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to record expense');

      setSuccessMsg(isEdit ? 'Expense record updated successfully!' : 'Expense recorded successfully!');
      fetchExpenses();
      setOpenDialog(false);
    } catch (err) {
      setError(err.message || 'Failed to submit expense details');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async (ids) => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/expenses`, {
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
      if (!response.ok) throw new Error(data.message || 'Failed to delete expense(s)');

      setSuccessMsg('Expense record(s) deleted!');
      fetchExpenses();
      setOpenDeleteDialog(false);
      setSelected([]);
    } catch (err) {
      setError(err.message || 'Failed to delete expense(s)');
    } finally {
      setLoading(false);
    }
  };

  // Stats calculation
  const totalExpenses = expenses.reduce((sum, ex) => sum + (ex.amount || 0), 0);
  const thisMonthExpenses = expenses
    .filter(ex => dayjs(ex.date).isAfter(dayjs().startOf('month')))
    .reduce((sum, ex) => sum + (ex.amount || 0), 0);
  
  const topCategoryExpense = () => {
    if (expenses.length === 0) return 'None';
    const catTotals = {};
    expenses.forEach(ex => {
      catTotals[ex.category] = (catTotals[ex.category] || 0) + ex.amount;
    });
    let topCat = 'None';
    let maxAmt = 0;
    Object.keys(catTotals).forEach(cat => {
      if (catTotals[cat] > maxAmt) {
        maxAmt = catTotals[cat];
        topCat = cat;
      }
    });
    return topCat;
  };

  const columns = [
    { id: 'title', label: 'Expense Title', sortable: true, cellSx: { fontWeight: 600, color: '#0f172a' } },
    {
      id: 'category',
      label: 'Category',
      sortable: true,
      render: (row) => (
        <Chip
          label={row.category}
          size="small"
          sx={{
            fontSize: '0.72rem',
            fontWeight: 600,
            bgcolor: '#f1f5f9',
            color: '#475569',
            borderRadius: 1
          }}
        />
      )
    },
    {
      id: 'amount',
      label: 'Amount',
      sortable: true,
      render: (row) => (
        <Typography sx={{ fontWeight: 700, color: '#dc2626' }}>
          {currency} {parseFloat(row.amount).toFixed(2)}
        </Typography>
      )
    },
    {
      id: 'date',
      label: 'Billing Date',
      sortable: true,
      render: (row) => dayjs(row.date).format('DD/MM/YYYY')
    },
    { id: 'description', label: 'Remarks / Notes', sortable: false },
    {
      id: 'actions',
      label: 'Actions',
      sortable: false,
      render: (row) => (
        <IconButton
          onClick={(e) => { e.stopPropagation(); handleOpenEdit(row); }}
          size="small"
          sx={{ color: '#64748b', '&:hover': { color: '#2563eb' } }}
        >
          <EditIcon sx={{ fontSize: 18 }} />
        </IconButton>
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
          Store Expenses Log
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenAdd}
          sx={{ borderRadius: 2 }}
        >
          Record Expense
        </Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Summary Cards */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={4}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: '20px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#fef2f2', borderRadius: 1.5, display: 'flex', color: '#ef4444' }}>
                <WalletIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Total Expenses Recorded
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#0f172a' }}>
                  {currency} {totalExpenses.toFixed(2)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: '20px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#fff5f5', borderRadius: 1.5, display: 'flex', color: '#dc2626' }}>
                <PaymentsIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  This Month's Spending
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#dc2626' }}>
                  {currency} {thisMonthExpenses.toFixed(2)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: '20px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#faf5ff', borderRadius: 1.5, display: 'flex', color: '#8b5cf6' }}>
                <CategoryIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Primary Cost Driver
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 0.75, color: '#0f172a', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 200 }}>
                  {topCategoryExpense()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Expenses Table */}
      <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          data={expenses}
          loading={loading}
          selected={selected}
          onSelectedChange={setSelected}
          bulkActions={bulkActions}
          searchPlaceholder="Search expense transactions..."
          storageKey="expenses_table"
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
          {isEdit ? 'Edit Expense Record' : 'Record New Expense'}
        </DialogTitle>
        <Divider sx={{ mx: 3 }} />
        <form onSubmit={handleFormSubmit}>
          <DialogContent sx={{ py: 3 }}>
            <Stack spacing={3}>
              <TextField
                label="Expense Title"
                variant="standard"
                required
                fullWidth
                size="small"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />

              <FormControl variant="standard" required fullWidth size="small">
                <InputLabel>Expense Category</InputLabel>
                <Select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label={`Amount (${currency})`}
                variant="standard"
                required
                fullWidth
                type="number"
                inputProps={{ min: 0, step: 'any' }}
                size="small"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />

              <TextField
                label="Billing Date"
                variant="standard"
                required
                fullWidth
                type="date"
                size="small"
                InputLabelProps={{ shrink: true }}
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />

              <TextField
                label="Remarks / Notes"
                variant="standard"
                fullWidth
                size="small"
                multiline
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
              {isEdit ? 'Save Changes' : 'Record Expense'}
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
            Are you sure you want to delete {deleteIds.length} selected expense records? This action cannot be undone.
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
            Delete Record(s)
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

export default Expenses;
