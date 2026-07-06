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
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import { Add as AddIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') ? import.meta.env.VITE_API_URL : window.location.origin);

const AddProduct = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Category Sub-Dialog States
  const [openCategoryDialog, setOpenCategoryDialog] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', description: '' });
  const [catError, setCatError] = useState('');
  const [catLoading, setCatLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    price: '',
    stock: '',
    unit: 'pcs',
    categoryId: '',
    expiryDate: '',
    warehouseId: '',
    rackNo: '',
    imageFile: null,
    imageName: '',
    detail: '',
    mfgDate: '',
    lowStockAlert: '5',
    supplierPrice: '',
    model: '',
    supplierId: '',
  });

  const getToken = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return null;
    }
    return token;
  };

  const fetchCategories = async () => {
    try {
      const token = getToken();
      if (!token) return;
      const response = await fetch(`${API_URL}/api/categories`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const token = getToken();
      if (!token) return;
      const response = await fetch(`${API_URL}/api/warehouses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWarehouses(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch warehouses:', err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const token = getToken();
      if (!token) return;
      const response = await fetch(`${API_URL}/api/suppliers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSuppliers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchWarehouses();
    fetchSuppliers();
  }, []);

  const handleCategorySubmit = async () => {
    setCatError('');
    if (!catForm.name.trim()) {
      setCatError('Category name is required.');
      return;
    }
    setCatLoading(true);
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: catForm.name.trim(), description: catForm.description.trim() })
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create category');

      await fetchCategories();
      setFormData(prev => ({ ...prev, categoryId: data.id }));
      setOpenCategoryDialog(false);
    } catch (err) {
      setCatError(err.message || 'Something went wrong');
    } finally {
      setCatLoading(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!formData.name.trim()) {
      setError('Please enter a product name');
      return;
    }
    if (formData.price === '' || formData.price === null || formData.price === undefined) {
      setError('Please enter a Sell Price');
      return;
    }

    // Auto-generate barcode if empty
    let finalBarcode = formData.barcode.trim();
    if (!finalBarcode) {
      const prefix = '890';
      let code = prefix;
      for (let i = 0; i < 9; i++) {
        code += Math.floor(Math.random() * 10);
      }
      finalBarcode = code;
    }

    const fd = new FormData();
    fd.append('name', formData.name.trim());
    fd.append('barcode', finalBarcode);
    fd.append('price', formData.price ? parseFloat(formData.price) : 0);
    fd.append('stock', formData.stock ? parseFloat(formData.stock) : 0);
    fd.append('unit', formData.unit.trim());
    fd.append('categoryId', formData.categoryId || '');
    fd.append('expiryDate', formData.expiryDate || '');
    fd.append('warehouseId', formData.warehouseId || '');
    fd.append('rackNo', formData.rackNo.trim());
    fd.append('detail', formData.detail.trim());
    fd.append('mfgDate', formData.mfgDate || '');
    fd.append('lowStockAlert', formData.lowStockAlert ? parseFloat(formData.lowStockAlert) : 5);
    fd.append('supplierPrice', formData.supplierPrice ? parseFloat(formData.supplierPrice) : 0);
    fd.append('model', formData.model.trim());
    fd.append('supplierId', formData.supplierId || '');

    if (formData.imageFile) {
      fd.append('image', formData.imageFile);
    }

    setLoading(true);
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: fd
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to add product');

      setSuccessMsg('Product added successfully!');
      setTimeout(() => { navigate('/products'); }, 1500);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', display: 'flex', flexDirection: 'column', gap: 3, fontFamily: '"Inter", sans-serif' }}>
      
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
          Add Product
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/products')}
          sx={{ borderRadius: 2 }}
        >
          Back to List
        </Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {successMsg && <Alert severity="success">{successMsg}</Alert>}

      <Card sx={{ border: '1px solid #cbd5e1', borderRadius: 1.5, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)', p: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a' }}>
            Add Products
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            use this form to add product to database.
          </Typography>
        </Box>

        <form onSubmit={handleFormSubmit} style={{ width: '100%' }}>
          {/* Top Section Layout - Spans Full Width */}
          <Box sx={{ display: 'flex', gap: 4, mb: 4, flexDirection: { xs: 'column', md: 'row' }, width: '100%' }}>
            {/* Left Column */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                label="Products"
                name="name"
                placeholder="Product Name"
                variant="standard"
                autoComplete="off"
                required
                fullWidth
                size="small"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />

              <TextField
                label="Barcode / SKU (Scan or Type)"
                name="barcode"
                placeholder="Scan barcode or enter manually"
                variant="standard"
                autoComplete="off"
                fullWidth
                size="small"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}
                helperText="Leave empty to auto-generate a barcode."
              />

              <Stack direction="row" spacing={1} alignItems="flex-end">
                <FormControl variant="standard" fullWidth size="small">
                  <InputLabel id="category-select-label">Categories</InputLabel>
                  <Select
                    labelId="category-select-label"
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  >
                    <MenuItem value="">
                      <em>Select Categories (Optional)</em>
                    </MenuItem>
                    {categories.map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <IconButton
                  color="primary"
                  onClick={() => {
                    setCatForm({ name: '', description: '' });
                    setCatError('');
                    setOpenCategoryDialog(true);
                  }}
                  size="small"
                  sx={{ mb: 0.5 }}
                >
                  <AddIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Stack>

              <FormControl variant="standard" fullWidth size="small">
                <InputLabel id="warehouse-select-label">Warehouse</InputLabel>
                <Select
                  labelId="warehouse-select-label"
                  value={formData.warehouseId}
                  onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                >
                  <MenuItem value="">
                    <em>Select Warehouse (Optional)</em>
                  </MenuItem>
                  {warehouses.map((w) => (
                    <MenuItem key={w.id} value={w.id}>
                      {w.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Warehouse Rack No"
                name="rackNo"
                placeholder="Warehouse Rack No (Optional)"
                variant="standard"
                autoComplete="off"
                fullWidth
                size="small"
                value={formData.rackNo}
                onChange={(e) => setFormData({ ...formData, rackNo: e.target.value })}
              />
            </Box>

            {/* Right Column */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 500, fontSize: '0.75rem' }}>
                  Image
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Button
                    variant="outlined"
                    component="label"
                    sx={{
                      borderColor: '#cbd5e1',
                      color: '#334155',
                      textTransform: 'none',
                      borderRadius: 1.5,
                      px: 2.5,
                      py: 0.75,
                      '&:hover': {
                        borderColor: '#94a3b8',
                        backgroundColor: '#f8fafc',
                      }
                    }}
                  >
                    Browse...
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setFormData(prev => ({ ...prev, imageFile: file, imageName: file.name }));
                        }
                      }}
                    />
                  </Button>
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: formData.imageName ? 'normal' : 'italic' }}>
                    {formData.imageName || 'No file selected.'}
                  </Typography>
                </Box>
              </Box>

              <TextField
                label="Detail"
                name="detail"
                variant="standard"
                multiline
                rows={2}
                fullWidth
                placeholder="This textarea has a limit of 300 chars."
                value={formData.detail}
                onChange={(e) => {
                  if (e.target.value.length <= 300) {
                    setFormData(prev => ({ ...prev, detail: e.target.value }));
                  }
                }}
                helperText={`${formData.detail ? formData.detail.length : 0}/300`}
                inputProps={{ maxLength: 300 }}
              />

              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="Mfg. Date"
                  value={formData.mfgDate ? dayjs(formData.mfgDate) : null}
                  onChange={(newVal) =>
                    setFormData(f => ({ ...f, mfgDate: newVal ? newVal.format('YYYY-MM-DD') : '' }))
                  }
                  slotProps={{
                    textField: {
                      variant: 'standard',
                      fullWidth: true,
                      size: 'small',
                      required: false
                    }
                  }}
                />
              </LocalizationProvider>

              <Stack spacing={1}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DatePicker
                    label="Exp. Date"
                    value={formData.expiryDate ? dayjs(formData.expiryDate) : null}
                    onChange={(newVal) =>
                      setFormData(f => ({ ...f, expiryDate: newVal ? newVal.format('YYYY-MM-DD') : '' }))
                    }
                    slotProps={{
                      textField: {
                        variant: 'standard',
                        fullWidth: true,
                        size: 'small',
                        required: false
                      }
                    }}
                  />
                </LocalizationProvider>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                  {[
                    { label: '+3M', months: 3 },
                    { label: '+6M', months: 6 },
                    { label: '+1Y', months: 12 },
                    { label: '+2Y', months: 24 }
                  ].map((preset) => (
                    <Button
                      key={preset.label}
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        const d = new Date();
                        d.setMonth(d.getMonth() + preset.months);
                        setFormData({ ...formData, expiryDate: d.toISOString().split('T')[0] });
                      }}
                      sx={{ fontSize: '0.68rem', py: 0.1, px: 0.75, minWidth: 0, borderRadius: 1, textTransform: 'none', borderColor: '#e2e8f0', color: '#64748b' }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </Stack>
              </Stack>
            </Box>
          </Box>

          {/* Bottom Row Table Grid */}
          <Box sx={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 1.5, overflow: 'hidden', mb: 4 }}>
            {/* Table Header */}
            <Box sx={{ display: 'flex', bgcolor: '#f8fafc', borderBottom: '1px solid #cbd5e1', flexDirection: { xs: 'column', md: 'row' } }}>
              {[
                'Quantity',
                'Unit Code',
                'Low Stock Alert',
                'Supplier Price',
                'Sell Price *',
                'Model',
                'Suppliers'
              ].map((h, idx) => (
                <Box
                  key={h}
                  sx={{
                    width: { xs: '100%', md: 'calc(100% / 7)' },
                    p: 1.5,
                    borderRight: idx < 6 ? { md: '1px solid #cbd5e1' } : 'none',
                    borderBottom: { xs: '1px solid #cbd5e1', md: 'none' },
                    boxSizing: 'border-box'
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569', fontSize: '0.85rem' }}>
                    {h}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Table Inputs */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
              {/* Quantity */}
              <Box
                sx={{
                  width: { xs: '100%', md: 'calc(100% / 7)' },
                  p: 1.5,
                  borderRight: { md: '1px solid #cbd5e1' },
                  borderBottom: { xs: '1px solid #cbd5e1', md: 'none' },
                  boxSizing: 'border-box'
                }}
              >
                <TextField
                  placeholder="Quantity"
                  name="stock"
                  type="number"
                  fullWidth
                  variant="standard"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  InputProps={{ disableUnderline: true, style: { fontSize: '0.9rem' } }}
                />
              </Box>

              {/* Unit Code */}
              <Box
                sx={{
                  width: { xs: '100%', md: 'calc(100% / 7)' },
                  p: 1.5,
                  borderRight: { md: '1px solid #cbd5e1' },
                  borderBottom: { xs: '1px solid #cbd5e1', md: 'none' },
                  boxSizing: 'border-box'
                }}
              >
                <FormControl fullWidth variant="standard">
                  <Select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    disableUnderline
                    style={{ fontSize: '0.9rem' }}
                  >
                    <MenuItem value="pcs">pcs</MenuItem>
                    <MenuItem value="box">box</MenuItem>
                    <MenuItem value="kg">kg</MenuItem>
                    <MenuItem value="liter">liter</MenuItem>
                    <MenuItem value="dozen">dozen</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Low Stock Alert */}
              <Box
                sx={{
                  width: { xs: '100%', md: 'calc(100% / 7)' },
                  p: 1.5,
                  borderRight: { md: '1px solid #cbd5e1' },
                  borderBottom: { xs: '1px solid #cbd5e1', md: 'none' },
                  boxSizing: 'border-box'
                }}
              >
                <TextField
                  placeholder="Low Stock Alert"
                  name="lowStockAlert"
                  type="number"
                  fullWidth
                  variant="standard"
                  value={formData.lowStockAlert}
                  onChange={(e) => setFormData({ ...formData, lowStockAlert: e.target.value })}
                  InputProps={{ disableUnderline: true, style: { fontSize: '0.9rem' } }}
                />
              </Box>

              {/* Supplier Price */}
              <Box
                sx={{
                  width: { xs: '100%', md: 'calc(100% / 7)' },
                  p: 1.5,
                  borderRight: { md: '1px solid #cbd5e1' },
                  borderBottom: { xs: '1px solid #cbd5e1', md: 'none' },
                  boxSizing: 'border-box'
                }}
              >
                <TextField
                  placeholder="Supplier Price"
                  name="supplierPrice"
                  type="number"
                  fullWidth
                  variant="standard"
                  value={formData.supplierPrice}
                  onChange={(e) => setFormData({ ...formData, supplierPrice: e.target.value })}
                  InputProps={{ disableUnderline: true, style: { fontSize: '0.9rem' } }}
                />
              </Box>

              {/* Sell Price */}
              <Box
                sx={{
                  width: { xs: '100%', md: 'calc(100% / 7)' },
                  p: 1.5,
                  borderRight: { md: '1px solid #cbd5e1' },
                  borderBottom: { xs: '1px solid #cbd5e1', md: 'none' },
                  boxSizing: 'border-box'
                }}
              >
                <TextField
                  placeholder="Sell Price"
                  name="price"
                  type="number"
                  fullWidth
                  required
                  variant="standard"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  InputProps={{ disableUnderline: true, style: { fontSize: '0.9rem' } }}
                />
              </Box>

              {/* Model */}
              <Box
                sx={{
                  width: { xs: '100%', md: 'calc(100% / 7)' },
                  p: 1.5,
                  borderRight: { md: '1px solid #cbd5e1' },
                  borderBottom: { xs: '1px solid #cbd5e1', md: 'none' },
                  boxSizing: 'border-box'
                }}
              >
                <TextField
                  placeholder="Model"
                  name="model"
                  fullWidth
                  variant="standard"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  InputProps={{ disableUnderline: true, style: { fontSize: '0.9rem' } }}
                />
              </Box>

              {/* Suppliers */}
              <Box
                sx={{
                  width: { xs: '100%', md: 'calc(100% / 7)' },
                  p: 1.5,
                  boxSizing: 'border-box'
                }}
              >
                <FormControl fullWidth variant="standard">
                  <Select
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    displayEmpty
                    disableUnderline
                    style={{ fontSize: '0.9rem' }}
                  >
                    <MenuItem value="">
                      <em>Select supplier (Optional)</em>
                    </MenuItem>
                    {suppliers.map((sup) => (
                      <MenuItem key={sup.id} value={sup.id}>
                        {sup.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{ borderRadius: 1.5, px: 4, py: 1.25, textTransform: 'none', fontWeight: 600, fontSize: '0.9rem', boxShadow: 'none' }}
            >
              {loading ? 'Adding...' : 'Add Product'}
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              disabled={loading}
              onClick={() => navigate('/products')}
              sx={{ borderRadius: 1.5, px: 4, py: 1.25, textTransform: 'none', fontWeight: 600, fontSize: '0.9rem', borderColor: '#cbd5e1' }}
            >
              Cancel
            </Button>
          </Box>
        </form>
      </Card>

      {/* Category Creation Sub-Dialog */}
      <Dialog
        open={openCategoryDialog}
        onClose={() => setOpenCategoryDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          Add New Category
        </DialogTitle>
        <Divider sx={{ mx: 3 }} />
        <DialogContent sx={{ py: 3 }}>
          {catError && <Alert severity="error" sx={{ mb: 2 }}>{catError}</Alert>}
          <Stack spacing={3}>
            <TextField
              label="Category Name"
              variant="standard"
              autoComplete="off"
              required
              fullWidth
              size="small"
              value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
            />
            <TextField
              label="Description"
              variant="standard"
              autoComplete="off"
              fullWidth
              multiline
              rows={2}
              size="small"
              value={catForm.description}
              onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setOpenCategoryDialog(false)}
            color="inherit"
            variant="outlined"
            sx={{ borderRadius: 1.5 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCategorySubmit}
            color="primary"
            variant="contained"
            disabled={catLoading}
            sx={{ borderRadius: 1.5, boxShadow: 'none' }}
          >
            {catLoading ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AddProduct;
