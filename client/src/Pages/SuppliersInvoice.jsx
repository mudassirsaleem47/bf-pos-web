import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, Button, TextField, Alert, Stack,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Divider, MenuItem, Select, FormControl, InputLabel,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Paper, Chip, Tooltip, Snackbar,
} from '@mui/material';
import {
  Add as AddIcon, ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon, Edit as EditIcon,
  AttachFile as AttachFileIcon, CheckCircle as CheckCircleIcon,
  Visibility as VisibilityIcon, Print as PrintIcon,
} from '@mui/icons-material';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import DataTable from '../Components/DataTable';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') ? import.meta.env.VITE_API_URL : window.location.origin);

const emptyItem = () => ({ itemName: '', quantity: '', rate: '', total: 0 });

const SuppliersInvoice = () => {
  const navigate = useNavigate();
  const [view, setView] = useState('list');
  const [invoices, setInvoices] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selected, setSelected] = useState([]);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deleteIds, setDeleteIds] = useState([]);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    supplierId: '',
    warehouseId: '',
    date: '',
    paidAmount: '',
    shippingCost: '',
    weight: '',
    imageFile: null,
    imageName: '',
  });
  const [items, setItems] = useState([emptyItem()]);

  const itemsTotal = items.reduce((sum, it) => sum + (parseFloat(it.total) || 0), 0);
  const shippingCost = parseFloat(formData.shippingCost) || 0;
  const grandTotal = itemsTotal + shippingCost;
  const due = grandTotal - (parseFloat(formData.paidAmount) || 0);

  const getToken = () => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return null; }
    return token;
  };

  const authHeaders = (token) => ({ 'Authorization': `Bearer ${token}` });

  const handleAuthError = (status) => {
    if (status === 401 || status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
      return true;
    }
    return false;
  };

  // Fetch all required data
  const fetchDropdowns = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const [sRes, wRes] = await Promise.all([
        fetch(`${API_URL}/api/suppliers`, { headers: authHeaders(token) }),
        fetch(`${API_URL}/api/warehouses`, { headers: authHeaders(token) }),
      ]);
      if (sRes.ok) setSuppliers(await sRes.json());
      if (wRes.ok) setWarehouses(await wRes.json());
    } catch { /* silent */ }
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/supplier-invoices`, { headers: authHeaders(token) });
      if (handleAuthError(res.status)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setInvoices(data);
      setSelected([]);
    } catch (err) {
      setError(err.message || 'Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'list') { fetchInvoices(); fetchDropdowns(); }
    if (view === 'add') fetchDropdowns();
  }, [view]);

  // ─── Items handlers ───────────────────────────────────────────
  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    
    const qty = parseFloat(field === 'quantity' ? value : updated[index].quantity) || 0;

    if (field === 'rate') {
      const rate = parseFloat(value) || 0;
      updated[index].total = parseFloat((qty * rate).toFixed(2));
    } else if (field === 'total') {
      const totalVal = parseFloat(value) || 0;
      updated[index].total = value === '' ? '' : totalVal;
      if (qty > 0 && value !== '') {
        updated[index].rate = parseFloat((totalVal / qty).toFixed(2));
      }
    } else if (field === 'quantity') {
      const enteredRate = parseFloat(updated[index].rate);
      const enteredTotal = parseFloat(updated[index].total);
      if (!isNaN(enteredRate) && enteredRate > 0) {
        updated[index].total = parseFloat((qty * enteredRate).toFixed(2));
      } else if (!isNaN(enteredTotal) && enteredTotal > 0 && qty > 0) {
        updated[index].rate = parseFloat((enteredTotal / qty).toFixed(2));
      }
    }
    setItems(updated);
  };

  const addItem = () => setItems([...items, emptyItem()]);
  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

  // ─── Form submit ──────────────────────────────────────────────
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!formData.supplierId || !formData.date) {
      setError('Supplier and Date are required');
      return;
    }
    if (items.length === 0 || items.some(it => !it.itemName)) {
      setError('All items must have a name');
      return;
    }

    const isEdit = view === 'edit';
    const url = isEdit
      ? `${API_URL}/api/supplier-invoices/${editId}`
      : `${API_URL}/api/supplier-invoices`;
    const method = isEdit ? 'PUT' : 'POST';

    const fd = new FormData();
    fd.append('supplierId', formData.supplierId);
    if (formData.warehouseId) {
      fd.append('warehouseId', formData.warehouseId);
    }
    fd.append('date', formData.date);
    fd.append('shippingCost', parseFloat(formData.shippingCost) || 0);
    fd.append('weight', parseFloat(formData.weight) || 0);
    fd.append('paidAmount', parseFloat(formData.paidAmount) || 0);
    fd.append('items', JSON.stringify(items));
    if (formData.imageFile) fd.append('image', formData.imageFile);

    setLoading(true);
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch(url, {
        method,
        headers: authHeaders(token), // no Content-Type — FormData sets it
        body: fd,
      });
      if (handleAuthError(res.status)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');

      setSuccessMsg(isEdit ? 'Invoice updated!' : 'Invoice created!');
      resetForm();
      setTimeout(() => { setView('list'); setSuccessMsg(''); }, 1500);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleFullPaid = () => {
    setFormData(f => ({ ...f, paidAmount: grandTotal.toFixed(2) }));
  };

  const resetForm = () => {
    setFormData({
      supplierId: '',
      warehouseId: '',
      date: '',
      paidAmount: '',
      shippingCost: '',
      weight: '',
      imageFile: null,
      imageName: ''
    });
    setItems([emptyItem()]);
    setEditId(null);
    setError('');
  };

  const handleViewClick = async (row) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/supplier-invoices/${row.id}`, { headers: authHeaders(token) });
      const data = await res.json();
      if (res.ok) setViewInvoice(data);
    } catch { /* silent */ }
    setOpenViewDialog(true);
  };

  const handlePrintInvoice = (invoice) => {
    if (!invoice) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // ── Header bar ──────────────────────────────────────────────
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SUPPLIER INVOICE', 14, 13);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.invoiceNo, 14, 21);

    // ── Date on right ───────────────────────────────────────────
    const dateStr = new Date(invoice.date).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    doc.text(`Date: ${dateStr}`, pageW - 14, 21, { align: 'right' });

    // ── Info section ────────────────────────────────────────────
    doc.setTextColor(30, 41, 59);
    const infoY = 38;
    const col2 = pageW / 2 + 5;

    // Supplier
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('SUPPLIER', 14, infoY);
    doc.text('WAREHOUSE', col2, infoY);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(invoice.supplier?.name || '-', 14, infoY + 6);
    doc.text(invoice.warehouse?.name || 'None', col2, infoY + 6);

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, infoY + 12, pageW - 14, infoY + 12);

    // ── Items table ─────────────────────────────────────────────
    const tableStartY = infoY + 18;
    autoTable(doc, {
      startY: tableStartY,
      head: [['#', 'Item Name', 'Quantity', 'Rate (Rs.)', 'Total (Rs.)']],
      body: invoice.items.map((item, i) => [
        i + 1,
        item.itemName,
        item.quantity,
        (item.rate && item.rate > 0) ? item.rate.toFixed(2) : (item.quantity > 0 && item.total > 0 ? (item.total / item.quantity).toFixed(2) : '-'),
        item.total.toFixed(2),
      ]),
      styles: { fontSize: 9, cellPadding: 3, textColor: [71, 85, 105] },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
      tableLineColor: [226, 232, 240],
      tableLineWidth: 0.3,
    });

    // ── Totals ──────────────────────────────────────────────────
    const totalsY = doc.lastAutoTable.finalY + 8;
    const totalsX = pageW - 80;
    const totalsW = 66;

    const drawTotalRow = (label, value, y, bgRgb, textRgb) => {
      doc.setFillColor(...bgRgb);
      doc.rect(totalsX, y, totalsW, 9, 'F');
      doc.setTextColor(...textRgb);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(label, totalsX + 3, y + 6);
      doc.text(`${value}`, totalsX + totalsW - 3, y + 6, { align: 'right' });
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.rect(totalsX, y, totalsW, 9);
    };

    let currentY = totalsY;
    const itemsSubtotal = invoice.items.reduce((s, it) => s + (it.total || 0), 0);
    drawTotalRow('Items Total', `Rs. ${itemsSubtotal.toFixed(2)}`, currentY, [255, 255, 255], [15, 23, 42]);
    currentY += 9;

    if (invoice.shippingCost && invoice.shippingCost > 0) {
      drawTotalRow('Shipping Cost', `Rs. ${invoice.shippingCost.toFixed(2)}`, currentY, [240, 249, 255], [2, 132, 199]);
      currentY += 9;
    }
    if (invoice.weight && invoice.weight > 0) {
      drawTotalRow('Weight', `${invoice.weight} kg`, currentY, [255, 255, 255], [100, 116, 139]);
      currentY += 9;
    }

    drawTotalRow('Grand Total', `Rs. ${invoice.grandTotal.toFixed(2)}`, currentY, [248, 250, 252], [15, 23, 42]);
    currentY += 9;
    drawTotalRow('Paid Amount', `Rs. ${invoice.paidAmount.toFixed(2)}`, currentY, [240, 253, 244], [21, 128, 61]);
    currentY += 9;
    drawTotalRow(
      'Due',
      `Rs. ${invoice.due.toFixed(2)}`,
      currentY,
      invoice.due > 0 ? [254, 242, 242] : [240, 253, 244],
      invoice.due > 0 ? [185, 28, 28] : [21, 128, 61]
    );

    // ── Footer ──────────────────────────────────────────────────
    const pageH = doc.internal.pageSize.getHeight();
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 14, pageH - 8);
    doc.text('Inventory Management System', pageW - 14, pageH - 8, { align: 'right' });

    doc.save(`${invoice.invoiceNo}.pdf`);
  };

  const handleEditClick = async (row) => {
    setError('');
    setSuccessMsg('');
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/supplier-invoices/${row.id}`, { headers: authHeaders(token) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setFormData({
        supplierId: data.supplierId || '',
        warehouseId: data.warehouseId || '',
        date: data.date ? data.date.slice(0, 10) : '',
        paidAmount: String(data.paidAmount ?? ''),
        shippingCost: String(data.shippingCost ?? ''),
        weight: String(data.weight ?? ''),
        imageFile: null,
        imageName: data.imagePath ? data.imagePath.split('/').pop() : '',
      });
      setItems(data.items.map(it => ({
        itemName: it.itemName,
        quantity: String(it.quantity),
        rate: String(it.rate),
        total: it.total,
      })));
      setEditId(data.id);
      await fetchDropdowns();
      setView('edit');
    } catch (err) {
      setError(err.message || 'Failed to load invoice');
    }
  };

  // ─── Bulk delete ──────────────────────────────────────────────
  const handleBulkDelete = async (ids) => {
    setLoading(true);
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/supplier-invoices`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ ids }),
      });
      if (handleAuthError(res.status)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSuccessMsg('Invoice(s) deleted!');
      fetchInvoices();
      setOpenDeleteDialog(false);
      setDeleteIds([]);
    } catch (err) {
      setError(err.message || 'Delete failed');
      setOpenDeleteDialog(false);
    } finally {
      setLoading(false);
    }
  };

  // ─── Table columns ────────────────────────────────────────────
  const columns = [
    { id: 'invoiceNo', label: 'Invoice #', sortable: true, cellSx: { fontWeight: 700, color: '#1d4ed8' } },
    {
      id: 'supplier', label: 'Supplier', sortable: false,
      render: (row) => row.supplier?.name || '-'
    },
    {
      id: 'warehouse', label: 'Warehouse', sortable: false,
      render: (row) => row.warehouse?.name || '-'
    },
    {
      id: 'date', label: 'Date', sortable: true,
      render: (row) => new Date(row.date).toLocaleDateString()
    },
    {
      id: 'shippingCost', label: 'Shipping', sortable: true,
      render: (row) => (row.shippingCost && row.shippingCost > 0) ? `Rs. ${parseFloat(row.shippingCost).toFixed(2)}` : '-'
    },
    {
      id: 'weight', label: 'Weight', sortable: true,
      render: (row) => (row.weight && row.weight > 0) ? `${row.weight} kg` : '-'
    },
    {
      id: 'grandTotal', label: 'Grand Total', sortable: true,
      render: (row) => <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>Rs. {row.grandTotal.toFixed(2)}</Typography>
    },
    {
      id: 'paidAmount', label: 'Paid', sortable: false,
      render: (row) => (
        <Chip label={`Rs. ${row.paidAmount.toFixed(2)}`} size="small"
          sx={{ bgcolor: '#f0fdf4', color: '#15803d', fontWeight: 600, fontSize: '0.75rem', height: 22 }} />
      )
    },
    {
      id: 'due', label: 'Due', sortable: false,
      render: (row) => (
        <Chip label={`Rs. ${row.due.toFixed(2)}`} size="small"
          sx={{
            bgcolor: row.due > 0 ? '#fef2f2' : '#f0fdf4',
            color: row.due > 0 ? '#b91c1c' : '#15803d',
            fontWeight: 600, fontSize: '0.75rem', height: 22
          }} />
      )
    },
    {
      id: 'actions', label: 'Actions', sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <IconButton onClick={(e) => { e.stopPropagation(); handleViewClick(row); }}
            size="small" sx={{ color: '#64748b', '&:hover': { color: '#2563eb' } }}>
            <VisibilityIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <IconButton onClick={(e) => { e.stopPropagation(); handleEditClick(row); }}
            size="small" sx={{ color: '#64748b', '&:hover': { color: '#2563eb' } }}>
            <EditIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Stack>
      )
    }
  ];

  const bulkActions = [{
    label: 'Delete Selected',
    icon: <DeleteIcon sx={{ fontSize: 18 }} />,
    action: (ids) => { setDeleteIds(ids); setOpenDeleteDialog(true); },
    color: 'error'
  }];

  // ─── Render form ──────────────────────────────────────────────
  const renderForm = () => (
    <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
          {view === 'edit' ? 'Edit Invoice' : 'Create New Invoice'}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Fill in the details below to {view === 'edit' ? 'update the' : 'create a new supplier'} invoice.
        </Typography>
      </Box>

      <form onSubmit={handleFormSubmit}>
        {/* ── Top fields ── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 3 }}>
          {/* Left col */}
          <Stack spacing={3}>
            <FormControl variant="standard" fullWidth required>
              <InputLabel>Select Supplier</InputLabel>
              <Select
                value={formData.supplierId}
                onChange={(e) => setFormData(f => ({ ...f, supplierId: e.target.value }))}
                displayEmpty
              >
                {suppliers.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl variant="standard" fullWidth>
              <InputLabel>Select Warehouse (Optional)</InputLabel>
              <Select
                value={formData.warehouseId}
                onChange={(e) => setFormData(f => ({ ...f, warehouseId: e.target.value }))}
              >
                <MenuItem value=""><em>None / Direct (No Warehouse)</em></MenuItem>
                {warehouses.map(w => <MenuItem key={w.id} value={w.id}>{w.name}</MenuItem>)}
              </Select>
            </FormControl>

            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                label="Date"
                value={formData.date ? dayjs(formData.date) : null}
                onChange={(newVal) =>
                  setFormData(f => ({ ...f, date: newVal ? newVal.format('YYYY-MM-DD') : '' }))
                }
                slotProps={{
                  textField: {
                    variant: 'standard',
                    fullWidth: true,
                    required: true,
                    size: 'small',
                  }
                }}
              />
            </LocalizationProvider>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                variant="standard"
                label="Shipping Charges (Rs.)"
                type="number"
                value={formData.shippingCost}
                onChange={(e) => setFormData(f => ({ ...f, shippingCost: e.target.value }))}
                placeholder="0.00"
                slotProps={{
                  htmlInput: { min: 0, step: 'any' }
                }}
                fullWidth
              />
              <TextField
                variant="standard"
                label="Weight (kg / lbs)"
                type="number"
                value={formData.weight}
                onChange={(e) => setFormData(f => ({ ...f, weight: e.target.value }))}
                placeholder="0.00"
                slotProps={{
                  htmlInput: { min: 0, step: 'any' }
                }}
                fullWidth
              />
            </Box>
          </Stack>

          {/* Right col — Image */}
          <Box>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 1, fontWeight: 600 }}>
              Image / Document
            </Typography>
            <Box
              sx={{
                border: '2px dashed #e2e8f0', borderRadius: 2, p: 3,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5,
                cursor: 'pointer', transition: 'border-color 0.2s',
                '&:hover': { borderColor: '#2563eb' }
              }}
              onClick={() => document.getElementById('invoice-image-input').click()}
            >
              <AttachFileIcon sx={{ fontSize: 32, color: '#94a3b8' }} />
              {formData.imageName ? (
                <Typography variant="body2" sx={{ color: '#2563eb', fontWeight: 600, textAlign: 'center' }}>
                  {formData.imageName}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                  Click to browse file<br />
                  <span style={{ fontSize: '0.75rem' }}>JPG, PNG, PDF • Max 5MB</span>
                </Typography>
              )}
            </Box>
            <input
              id="invoice-image-input"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) setFormData(f => ({ ...f, imageFile: file, imageName: file.name }));
              }}
            />
          </Box>
        </Box>

        {/* ── Items Table ── */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', mb: 1.5 }}>
          Item Information
        </Typography>
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, borderRadius: 1.5 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                {['Item Name *', 'Quantity *', 'Rate (Optional)', 'Total Price *', 'Action'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem', py: 1.5 }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell sx={{ minWidth: 160 }}>
                    <TextField
                      variant="outlined"
                      size="small"
                      placeholder="Item Name"
                      value={item.itemName}
                      required
                      onChange={(e) => handleItemChange(idx, 'itemName', e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.85rem' } }}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 120 }}>
                    <TextField
                      variant="outlined"
                      size="small"
                      type="number"
                      placeholder="0"
                      inputProps={{ min: 0, step: 'any' }}
                      value={item.quantity}
                      required
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.85rem' } }}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 130 }}>
                    <TextField
                      variant="outlined"
                      size="small"
                      type="number"
                      placeholder="Rate (Opt)"
                      inputProps={{ min: 0, step: 'any' }}
                      value={item.rate}
                      onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.85rem' } }}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell sx={{ minWidth: 130 }}>
                    <TextField
                      variant="outlined"
                      size="small"
                      type="number"
                      placeholder="0.00"
                      inputProps={{ min: 0, step: 'any' }}
                      value={item.total}
                      onChange={(e) => handleItemChange(idx, 'total', e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.85rem' } }}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Remove item">
                      <span>
                        <Button
                          variant="contained"
                          color="error"
                          size="small"
                          onClick={() => removeItem(idx)}
                          disabled={items.length === 1}
                          sx={{ minWidth: 70, fontSize: '0.75rem', borderRadius: 1, px: 1.5 }}
                        >
                          Delete
                        </Button>
                      </span>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* ── Bottom row: Add Item button + Totals ── */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, alignItems: 'start' }}>
          {/* Left: Add Item + Submit buttons */}
          <Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={addItem}
              size="small"
              sx={{ borderRadius: 2, mb: 3, bgcolor: '#0891b2', '&:hover': { bgcolor: '#0e7490' } }}
            >
              Add New Item
            </Button>

            <Stack direction="row" spacing={1.5}>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{ borderRadius: 2, px: 3 }}
              >
                {loading ? 'Saving...' : (view === 'edit' ? 'Update' : 'Submit')}
              </Button>
              <Button
                type="button"
                variant="contained"
                onClick={handleFullPaid}
                sx={{ borderRadius: 2, px: 3, bgcolor: '#f59e0b', '&:hover': { bgcolor: '#d97706' } }}
                startIcon={<CheckCircleIcon />}
              >
                Full Paid
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                disabled={loading}
                onClick={() => { resetForm(); setView('list'); }}
                sx={{ borderRadius: 2 }}
              >
                Cancel
              </Button>
            </Stack>
          </Box>

          {/* Right: Totals */}
          <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, overflow: 'hidden' }}>
            {[
              { label: 'Items Total:', value: itemsTotal.toFixed(2), bold: false },
              ...(shippingCost > 0 ? [{ label: 'Shipping Charges:', value: shippingCost.toFixed(2), bold: false, color: '#0284c7' }] : []),
              { label: 'Grand Total:', value: grandTotal.toFixed(2), bold: true },
            ].map(r => (
              <Box key={r.label} sx={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #f1f5f9', bgcolor: r.bold ? '#f8fafc' : 'transparent' }}>
                <Typography sx={{ flex: 1, px: 2, py: 1.5, fontSize: '0.85rem', fontWeight: r.bold ? 700 : 600, color: r.color || '#475569', borderRight: '1px solid #f1f5f9' }}>
                  {r.label}
                </Typography>
                <Box sx={{ flex: 2, px: 2 }}>
                  <TextField
                    variant="standard"
                    value={r.value}
                    disabled
                    fullWidth
                    slotProps={{ input: { disableUnderline: true, sx: { fontSize: '0.85rem', fontWeight: 700, color: r.color || '#0f172a' } } }}
                  />
                </Box>
              </Box>
            ))}
            {/* Paid Amount */}
            <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
              <Typography sx={{ flex: 1, px: 2, py: 1.5, fontSize: '0.85rem', fontWeight: 600, color: '#475569', borderRight: '1px solid #f1f5f9' }}>
                Paid Amount:
              </Typography>
              <Box sx={{ flex: 2, px: 2, py: 0.5 }}>
                <TextField
                  variant="standard"
                  type="number"
                  value={formData.paidAmount}
                  onChange={(e) => setFormData(f => ({ ...f, paidAmount: e.target.value }))}
                  fullWidth
                  placeholder="0.00"
                  slotProps={{
                    htmlInput: { min: 0, step: 'any' },
                    input: { disableUnderline: true, sx: { fontSize: '0.85rem' } }
                  }}
                />
              </Box>
            </Box>
            {/* Due */}
            <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: due > 0 ? '#fef2f2' : '#f0fdf4' }}>
              <Typography sx={{ flex: 1, px: 2, py: 1.5, fontSize: '0.85rem', fontWeight: 700, color: due > 0 ? '#b91c1c' : '#15803d', borderRight: '1px solid #f1f5f9' }}>
                Due:
              </Typography>
              <Box sx={{ flex: 2, px: 2 }}>
                <TextField
                  variant="standard"
                  value={due.toFixed(2)}
                  disabled
                  fullWidth
                  slotProps={{ input: { disableUnderline: true, sx: { fontSize: '0.85rem', fontWeight: 700, color: due > 0 ? '#b91c1c' : '#15803d' } } }}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </form>
    </Card>
  );

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', display: 'flex', flexDirection: 'column', gap: 3, fontFamily: '"Inter", sans-serif' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
          {view === 'list' ? 'Suppliers Invoice' : (view === 'edit' ? 'Edit Invoice' : 'Create Invoice')}
        </Typography>
        {view === 'list' ? (
          <Button variant="contained" startIcon={<AddIcon />}
            onClick={() => { resetForm(); setView('add'); }}
            sx={{ borderRadius: 2 }}>
            Create Invoice
          </Button>
        ) : (
          <Button variant="outlined" startIcon={<ArrowBackIcon />}
            onClick={() => { resetForm(); setView('list'); }}
            sx={{ borderRadius: 2 }}>
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
            data={invoices}
            loading={loading}
            selected={selected}
            onSelectedChange={setSelected}
            bulkActions={bulkActions}
            searchPlaceholder="Search invoices..."
            storageKey="supplier_invoices"
          />
        </Card>
      ) : renderForm()}

      {/* View Invoice Dialog */}
      <Dialog
        open={openViewDialog}
        onClose={() => { setOpenViewDialog(false); setViewInvoice(null); }}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        {viewInvoice && (
          <>
            <DialogTitle sx={{ fontWeight: 700, pb: 1, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
              Invoice Details
              <Chip label={viewInvoice.invoiceNo} size="small"
                sx={{ ml: 1, bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: '0.8rem' }} />
            </DialogTitle>
            <Divider sx={{ mx: 3 }} />
            <DialogContent sx={{ py: 3 }}>
              {/* Top info grid */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
                {[
                  { label: 'Supplier', value: viewInvoice.supplier?.name || '-' },
                  { label: 'Warehouse', value: viewInvoice.warehouse?.name || 'None' },
                  { label: 'Date', value: new Date(viewInvoice.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) },
                  { label: 'Created', value: new Date(viewInvoice.createdAt).toLocaleDateString() },
                  ...(viewInvoice.weight && viewInvoice.weight > 0 ? [{ label: 'Weight', value: `${viewInvoice.weight} kg` }] : []),
                  ...(viewInvoice.shippingCost && viewInvoice.shippingCost > 0 ? [{ label: 'Shipping Cost', value: `Rs. ${viewInvoice.shippingCost.toFixed(2)}` }] : []),
                ].map(({ label, value }) => (
                  <Box key={label} sx={{ bgcolor: '#f8fafc', borderRadius: 1.5, p: 1.5, border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, display: 'block' }}>{label}</Typography>
                    <Typography variant="body2" sx={{ color: '#0f172a', fontWeight: 600, mt: 0.25 }}>{value}</Typography>
                  </Box>
                ))}
              </Box>

              {/* Items Table */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', mb: 1.5 }}>Items</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3, borderRadius: 1.5 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                      {['#', 'Item Name', 'Quantity', 'Rate', 'Total'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem', py: 1.5 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {viewInvoice.items.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell sx={{ color: '#94a3b8', fontSize: '0.8rem' }}>{idx + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>{item.itemName}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>
                          {(item.rate && item.rate > 0)
                            ? `Rs. ${item.rate.toFixed(2)}`
                            : (item.quantity > 0 && item.total > 0 ? `Rs. ${(item.total / item.quantity).toFixed(2)}` : '-')}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Rs. {item.total.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Totals */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Box sx={{ minWidth: 280, border: '1px solid #e2e8f0', borderRadius: 1.5, overflow: 'hidden' }}>
                  {(() => {
                    const itemsSub = viewInvoice.items.reduce((s, it) => s + (it.total || 0), 0);
                    return [
                      { label: 'Items Subtotal', value: `Rs. ${itemsSub.toFixed(2)}`, color: '#475569', bg: '#ffffff' },
                      ...(viewInvoice.shippingCost && viewInvoice.shippingCost > 0 ? [{ label: 'Shipping Charges', value: `Rs. ${viewInvoice.shippingCost.toFixed(2)}`, color: '#0284c7', bg: '#f0f9ff' }] : []),
                      { label: 'Grand Total', value: `Rs. ${viewInvoice.grandTotal.toFixed(2)}`, color: '#0f172a', bg: '#f8fafc' },
                      { label: 'Paid Amount', value: `Rs. ${viewInvoice.paidAmount.toFixed(2)}`, color: '#15803d', bg: '#f0fdf4' },
                      { label: 'Due', value: `Rs. ${viewInvoice.due.toFixed(2)}`, color: viewInvoice.due > 0 ? '#b91c1c' : '#15803d', bg: viewInvoice.due > 0 ? '#fef2f2' : '#f0fdf4' },
                    ].map(({ label, value, color, bg }) => (
                      <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 1.25, bgcolor: bg, borderBottom: '1px solid #e2e8f0' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569' }}>{label}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color }}>{value}</Typography>
                      </Box>
                    ));
                  })()}
                </Box>
              </Box>

              {/* Image */}
              {viewInvoice.imagePath && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', mb: 1 }}>Attached Document</Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AttachFileIcon />}
                    href={`${API_URL}/${viewInvoice.imagePath}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ borderRadius: 2, textTransform: 'none' }}
                  >
                    {viewInvoice.imagePath.split('/').pop()}
                  </Button>
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
              <Button
                onClick={() => handlePrintInvoice(viewInvoice)}
                variant="outlined"
                startIcon={<PrintIcon />}
                sx={{ borderRadius: 1.5, borderColor: '#2563eb', color: '#2563eb', '&:hover': { bgcolor: '#eff6ff', borderColor: '#1d4ed8' } }}
              >
                Print PDF
              </Button>
              <Button onClick={() => { setOpenViewDialog(false); setViewInvoice(null); }}
                variant="contained" sx={{ borderRadius: 1.5 }}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1, color: '#b91c1c' }}>Confirm Deletion</DialogTitle>
        <Divider sx={{ mx: 3 }} />
        <DialogContent sx={{ py: 3 }}>
          <Typography variant="body2" sx={{ color: '#475569' }}>
            Are you sure you want to delete {deleteIds.length} invoice(s)? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenDeleteDialog(false)} color="inherit" variant="outlined" sx={{ borderRadius: 1.5 }}>Cancel</Button>
          <Button onClick={() => handleBulkDelete(deleteIds)} color="error" variant="contained"
            disabled={loading} sx={{ borderRadius: 1.5, boxShadow: 'none' }}>
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Global Invoice Notifications */}
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

export default SuppliersInvoice;
