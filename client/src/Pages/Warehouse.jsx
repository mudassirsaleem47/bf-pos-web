import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  Button,
  TextField,
  Alert,
  Stack,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Chip,
  Snackbar,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Warehouse as WarehouseIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import DataTable from '../Components/DataTable';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') ? import.meta.env.VITE_API_URL : window.location.origin);

const Warehouse = () => {
  const navigate = useNavigate();
  const [view, setView] = useState('list'); // 'list' | 'add' | 'edit'
  const [warehouses, setWarehouses] = useState([]);
  const [selected, setSelected] = useState([]);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deleteIds, setDeleteIds] = useState([]);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [viewWarehouse, setViewWarehouse] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    capacity: '',
    manager: '',
    phone: '',
  });

  const getToken = () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return null; }
    return token;
  };

  const fetchWarehouses = async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/warehouses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch warehouses');

      setWarehouses(data);
      setSelected([]);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'list') fetchWarehouses();
  }, [view]);

  const handleBulkDelete = async (selectedIds) => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/warehouses`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids: selectedIds })
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to delete warehouses');

      setSuccessMsg('Warehouse(s) deleted successfully!');
      fetchWarehouses();
      setOpenDeleteDialog(false);
      setDeleteIds([]);
    } catch (err) {
      setError(err.message || 'Something went wrong deleting');
      setOpenDeleteDialog(false);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (warehouse) => {
    setFormData({
      name: warehouse.name || '',
      location: warehouse.location || '',
      capacity: warehouse.capacity !== null ? String(warehouse.capacity) : '',
      manager: warehouse.manager || '',
      phone: warehouse.phone || '',
    });
    setEditId(warehouse.id);
    setView('edit');
    setError('');
    setSuccessMsg('');
  };

  const handleViewClick = (warehouse) => {
    setViewWarehouse(warehouse);
    setOpenViewDialog(true);
  };

  const resetForm = () => setFormData({ name: '', location: '', capacity: '', manager: '', phone: '' });

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!formData.name.trim()) {
      setError('Please enter a warehouse name');
      return;
    }

    const isEdit = view === 'edit';
    const url = isEdit ? `${API_URL}/api/warehouses/${editId}` : `${API_URL}/api/warehouses`;
    const method = isEdit ? 'PUT' : 'POST';

    setLoading(true);
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          location: formData.location.trim(),
          capacity: formData.capacity ? parseInt(formData.capacity) : null,
          manager: formData.manager.trim(),
          phone: formData.phone.trim(),
        })
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Failed to ${isEdit ? 'update' : 'add'} warehouse`);

      setSuccessMsg(isEdit ? 'Warehouse updated successfully!' : 'Warehouse added successfully!');
      resetForm();
      setEditId(null);
      setTimeout(() => { setView('list'); setSuccessMsg(''); }, 1500);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      id: 'name',
      label: 'Warehouse Name',
      sortable: true,
      cellSx: { fontWeight: 600, color: '#0f172a' },
      render: (row) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarehouseIcon sx={{ fontSize: 16, color: '#2563eb' }} />
          {row.name}
        </Box>
      )
    },
    { id: 'location', label: 'Location', sortable: true },
    { id: 'manager', label: 'Manager', sortable: true },
    { id: 'phone', label: 'Phone', sortable: false },
    {
      id: 'capacity',
      label: 'Capacity',
      sortable: true,
      render: (row) =>
        row.capacity != null ? (
          <Chip
            label={`${row.capacity.toLocaleString()} units`}
            size="small"
            sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 600, fontSize: '0.75rem', height: 22 }}
          />
        ) : '-'
    },
    {
      id: 'actions',
      label: 'Actions',
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <IconButton
            onClick={(e) => { e.stopPropagation(); handleViewClick(row); }}
            size="small"
            sx={{ color: '#64748b', '&:hover': { color: '#2563eb' } }}
          >
            <VisibilityIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <IconButton
            onClick={(e) => { e.stopPropagation(); handleEditClick(row); }}
            size="small"
            sx={{ color: '#64748b', '&:hover': { color: '#2563eb' } }}
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

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', display: 'flex', flexDirection: 'column', gap: 3, fontFamily: '"Inter", sans-serif' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
          {view === 'list' ? 'Warehouse' : (view === 'edit' ? 'Edit Warehouse' : 'Add Warehouse')}
        </Typography>
        {view === 'list' ? (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setView('add'); setError(''); setEditId(null); resetForm(); }}
            sx={{ borderRadius: 2 }}
          >
            Add Warehouse
          </Button>
        ) : (
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => { setView('list'); setError(''); setEditId(null); }}
            sx={{ borderRadius: 2 }}
          >
            Back to List
          </Button>
        )}
      </Box>
      {error && <Alert severity="error">{error}</Alert>}

      {/* Content */}
      {view === 'list' ? (
        <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <DataTable
            columns={columns}
            data={warehouses}
            loading={loading}
            selected={selected}
            onSelectedChange={setSelected}
            bulkActions={bulkActions}
            searchPlaceholder="Search warehouses..."
            storageKey="warehouses_table"
          />
        </Card>
      ) : (
        <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', p: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
              {view === 'edit' ? 'Edit Warehouse' : 'Add Warehouse'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {view === 'edit' ? 'Use this form to update warehouse details.' : 'Use this form to add a new warehouse.'}
            </Typography>
          </Box>

          <form onSubmit={handleFormSubmit}>
            <Stack spacing={3} sx={{ maxWidth: 600 }}>
              <TextField
                label="Warehouse Name"
                name="name"
                variant="standard"
                autoComplete="off"
                required
                fullWidth
                size="small"
                value={formData.name}
                onChange={handleChange}
              />

              <TextField
                label="Location / Address"
                name="location"
                variant="standard"
                autoComplete="off"
                fullWidth
                multiline
                rows={2}
                size="small"
                value={formData.location}
                onChange={handleChange}
              />

              <TextField
                label="Capacity (units)"
                name="capacity"
                variant="standard"
                autoComplete="off"
                type="number"
                inputProps={{ min: 0 }}
                fullWidth
                size="small"
                value={formData.capacity}
                onChange={handleChange}
              />

              <TextField
                label="Manager Name"
                name="manager"
                variant="standard"
                autoComplete="off"
                fullWidth
                size="small"
                value={formData.manager}
                onChange={handleChange}
              />

              <TextField
                label="Phone"
                name="phone"
                variant="standard"
                autoComplete="off"
                fullWidth
                size="small"
                value={formData.phone}
                onChange={handleChange}
              />

              <Box sx={{ pt: 2, display: 'flex', gap: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  sx={{ borderRadius: 2, px: 4 }}
                >
                  {loading
                    ? (view === 'edit' ? 'Saving...' : 'Adding...')
                    : (view === 'edit' ? 'Save Changes' : 'Add Warehouse')}
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  disabled={loading}
                  onClick={() => { setView('list'); setEditId(null); }}
                  sx={{ borderRadius: 2, px: 4 }}
                >
                  Cancel
                </Button>
              </Box>
            </Stack>
          </form>
        </Card>
      )}

      {/* View Warehouse Dialog */}
      <Dialog
        open={openViewDialog}
        onClose={() => setOpenViewDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        {viewWarehouse && (
          <>
            <DialogTitle sx={{ fontWeight: 700, pb: 1, color: '#0f172a' }}>
              Warehouse Details
            </DialogTitle>
            <Divider sx={{ mx: 3 }} />
            <DialogContent sx={{ py: 3 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 2.5 }}>
                {[
                  { label: 'Warehouse Name:', value: viewWarehouse.name },
                  { label: 'Location:', value: viewWarehouse.location || '-' },
                  { label: 'Manager:', value: viewWarehouse.manager || '-' },
                  { label: 'Phone:', value: viewWarehouse.phone || '-' },
                  {
                    label: 'Capacity:',
                    value: viewWarehouse.capacity != null
                      ? `${viewWarehouse.capacity.toLocaleString()} units`
                      : '-'
                  },
                  {
                    label: 'Created At:',
                    value: new Date(viewWarehouse.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric', month: 'long', day: 'numeric'
                    })
                  },
                ].map(({ label, value }) => (
                  <React.Fragment key={label}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                      {label}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#0f172a', fontWeight: 500 }}>
                      {value}
                    </Typography>
                  </React.Fragment>
                ))}
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setOpenViewDialog(false)} variant="contained" sx={{ borderRadius: 1.5 }}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
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
            Are you sure you want to delete {deleteIds.length} selected warehouse(s)? This action cannot be undone.
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
            disabled={loading}
            sx={{ borderRadius: 1.5, boxShadow: 'none', '&:hover': { boxShadow: 'none' } }}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Global Warehouse Notifications */}
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

export default Warehouse;
