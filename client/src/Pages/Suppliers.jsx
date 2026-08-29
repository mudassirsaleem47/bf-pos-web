import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
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
  Grid,
  Snackbar,
} from '@mui/material';
import { Add as AddIcon, ArrowBack as ArrowBackIcon, Delete as DeleteIcon, Edit as EditIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import DataTable from '../Components/DataTable';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') ? import.meta.env.VITE_API_URL : window.location.origin);

const Suppliers = () => {
  const navigate = useNavigate();
  const [view, setView] = useState('list'); // 'list' or 'add' or 'edit'
  const [suppliers, setSuppliers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [viewSupplier, setViewSupplier] = useState(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deleteIds, setDeleteIds] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: ''
  });

  const fetchSuppliers = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(`${API_URL}/api/suppliers`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch suppliers');
      }

      setSuppliers(data);
      setSelected([]);
    } catch (err) {
      setError(err.message || 'Something went wrong fetching suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'list') {
      fetchSuppliers();
    }
  }, [view]);

  const handleBulkDelete = async (selectedIds) => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/suppliers`, {
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
      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete suppliers');
      }

      setSuccessMsg('Supplier(s) deleted successfully!');
      fetchSuppliers();
      setOpenDeleteDialog(false);
      setDeleteIds([]);
    } catch (err) {
      setError(err.message || 'Something went wrong deleting suppliers');
      setOpenDeleteDialog(false);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (supplier) => {
    setFormData({
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || ''
    });
    setEditId(supplier.id);
    setView('edit');
    setError('');
    setSuccessMsg('');
  };

  const handleViewClick = (supplier) => {
    setViewSupplier(supplier);
    setOpenViewDialog(true);
  };

  const columns = [
    { id: 'name', label: 'Supplier Name', sortable: true, cellSx: { fontWeight: 600, color: '#0f172a' } },
    { id: 'contactPerson', label: 'Contact Person', sortable: true },
    { id: 'email', label: 'Email', sortable: true },
    { id: 'phone', label: 'Phone', sortable: true },
    { id: 'address', label: 'Address', sortable: false },
    {
      id: 'actions',
      label: 'Actions',
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              handleViewClick(row);
            }}
            size="small"
            sx={{ color: '#64748b', '&:hover': { color: '#2563eb' } }}
          >
            <VisibilityIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              handleEditClick(row);
            }}
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
      action: (selectedIds) => {
        setDeleteIds(selectedIds);
        setOpenDeleteDialog(true);
      },
      color: 'error'
    }
  ];

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!formData.name || !formData.contactPerson) {
      setError('Please fill in all required fields (*)');
      return;
    }

    const isEdit = view === 'edit';
    const url = isEdit ? `${API_URL}/api/suppliers/${editId}` : `${API_URL}/api/suppliers`;
    const method = isEdit ? 'PUT' : 'POST';

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          contactPerson: formData.contactPerson,
          email: formData.email,
          phone: formData.phone,
          address: formData.address
        })
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Failed to ${isEdit ? 'update' : 'add'} supplier`);
      }

      setSuccessMsg(isEdit ? 'Supplier updated successfully!' : 'Supplier added successfully!');
      // Reset form
      setFormData({
        name: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: ''
      });
      setEditId(null);
      // Switch back to list view after a short delay
      setTimeout(() => {
        setView('list');
        setSuccessMsg('');
      }, 1500);

    } catch (err) {
      setError(err.message || `Something went wrong ${isEdit ? 'updating' : 'adding'} supplier`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', display: 'flex', flexDirection: 'column', gap: 3, fontFamily: '"Inter", sans-serif' }}>

      {/* Header Row */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
          {view === 'list' ? 'Suppliers' : (view === 'edit' ? 'Edit Supplier' : 'Add Supplier')}
        </Typography>
        {view === 'list' ? (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setView('add');
              setError('');
              setEditId(null);
              setFormData({
                name: '',
                contactPerson: '',
                email: '',
                phone: '',
                address: ''
              });
            }}
            sx={{ borderRadius: 2 }}
          >
            Add Supplier
          </Button>
        ) : (
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={() => {
              setView('list');
              setError('');
              setEditId(null);
            }}
            sx={{ borderRadius: 2 }}
          >
            Back to List
          </Button>
        )}
      </Box>
      {error && <Alert severity="error">{error}</Alert>}

      {/* View Content */}
      {view === 'list' ? (
        <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <DataTable
            columns={columns}
            data={suppliers}
            loading={loading}
            selected={selected}
            onSelectedChange={setSelected}
            bulkActions={bulkActions}
            searchPlaceholder="Search suppliers..."
            storageKey="suppliers_table"
          />
        </Card>
      ) : (
        <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', p: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
              {view === 'edit' ? 'Edit Supplier' : 'Add Supplier'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {view === 'edit' ? 'use this form to edit supplier in database..' : 'use this form to add supplier to database..'}
            </Typography>
          </Box>

          <form onSubmit={handleFormSubmit}>
            <Stack spacing={3} sx={{ maxWidth: 600 }}>
              <TextField
                label="Suppliers"
                name="name"
                variant="standard"
                autoComplete="off"
                required
                fullWidth
                size="small"
                value={formData.name}
                onChange={handleInputChange}
              />

              <TextField
                label="Contact Person"
                name="contactPerson"
                variant="standard"
                autoComplete="off"
                required
                fullWidth
                size="small"
                value={formData.contactPerson}
                onChange={handleInputChange}
              />

              <TextField
                label="Email"
                name="email"
                type="email"
                variant="standard"
                autoComplete="off"
                fullWidth
                size="small"
                value={formData.email}
                onChange={handleInputChange}
              />

              <TextField
                label="Phone"
                name="phone"
                required
                variant="standard"
                autoComplete="off"
                fullWidth
                size="small"
                value={formData.phone}
                onChange={handleInputChange}
              />

              <TextField
                label="Address"
                name="address"
                variant="standard"
                autoComplete="off"
                fullWidth
                multiline
                rows={3}
                size="small"
                value={formData.address}
                onChange={handleInputChange}
              />

              <Box sx={{ pt: 2, display: 'flex', gap: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  sx={{ borderRadius: 2, px: 4 }}
                >
                  {loading ? (view === 'edit' ? 'Saving...' : 'Adding...') : (view === 'edit' ? 'Save Changes' : 'Add Supplier')}
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  disabled={loading}
                  onClick={() => {
                    setView('list');
                    setEditId(null);
                  }}
                  sx={{ borderRadius: 2, px: 4 }}
                >
                  Cancel
                </Button>
              </Box>
            </Stack>
          </form>
        </Card>
      )}

      {/* View Supplier Dialog */}
      <Dialog
        open={openViewDialog}
        onClose={() => setOpenViewDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2, p: 1 }
        }}
      >
        {viewSupplier && (
          <>
            <DialogTitle sx={{ fontWeight: 700, pb: 1, color: '#0f172a' }}>
              Supplier Details
            </DialogTitle>
            <Divider sx={{ mx: 3 }} />
            <DialogContent sx={{ py: 3 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 2.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Supplier Name:
                </Typography>
                <Typography variant="body2" sx={{ color: '#0f172a', fontWeight: 500 }}>
                  {viewSupplier.name}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Contact Person:
                </Typography>
                <Typography variant="body2" sx={{ color: '#475569' }}>
                  {viewSupplier.contactPerson}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Email:
                </Typography>
                <Typography variant="body2" sx={{ color: '#475569' }}>
                  {viewSupplier.email || '-'}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Phone:
                </Typography>
                <Typography variant="body2" sx={{ color: '#475569' }}>
                  {viewSupplier.phone || '-'}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Address:
                </Typography>
                <Typography variant="body2" sx={{ color: '#475569', whiteSpace: 'pre-line' }}>
                  {viewSupplier.address || '-'}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Created At:
                </Typography>
                <Typography variant="body2" sx={{ color: '#475569' }}>
                  {new Date(viewSupplier.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Typography>
              </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button
                onClick={() => setOpenViewDialog(false)}
                variant="contained"
                sx={{ borderRadius: 1.5 }}
              >
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
        PaperProps={{
          sx: { borderRadius: 2, p: 1 }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1, color: '#b91c1c' }}>
          Confirm Deletion
        </DialogTitle>
        <Divider sx={{ mx: 3 }} />
        <DialogContent sx={{ py: 3 }}>
          <Typography variant="body2" sx={{ color: '#475569' }}>
            Are you sure you want to delete the {deleteIds.length} selected supplier(s)? This action cannot be undone.
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
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Global Supplier Notifications */}
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

export default Suppliers;
