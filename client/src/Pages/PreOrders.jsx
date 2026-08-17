import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Alert,
  Snackbar,
  Stack,
  Grid,
  FormControl,
  Select,
  MenuItem,
  TextField,
  InputLabel,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Autocomplete,
  Tooltip,
  Menu
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Print as PrintIcon,
  Visibility as VisibilityIcon,
  ShoppingBag as OrderIcon,
  PendingActions as PendingIcon,
  CheckCircle as CompletedIcon,
  LocalShipping as ReadyIcon,
  AttachMoney as MoneyIcon,
  ArrowForward as ArrowIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import DataTable from '../Components/DataTable';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000'
  : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost')
    ? import.meta.env.VITE_API_URL
    : window.location.origin);

const emptyItem = () => ({ productId: '', name: '', quantity: 1, price: 0, total: 0 });

const PreOrders = () => {
  const navigate = useNavigate();
  const [preOrders, setPreOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [currency, setCurrency] = useState('Rs.');
  const [storeName, setStoreName] = useState('My Store');
  const [settings, setSettings] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Status Filter State
  const [statusFilter, setStatusFilter] = useState('all');

  // Selected for Bulk Actions
  const [selected, setSelected] = useState([]);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deleteIds, setDeleteIds] = useState([]);

  // Create / Edit Dialog State
  const [openFormDialog, setOpenFormDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    customerPhone: '',
    advanceAmount: 0,
    expectedDate: '',
    status: 'Pending',
    notes: '',
  });

  const [formItems, setFormItems] = useState([emptyItem()]);

  // View / Print Dialog State
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [viewOrder, setViewOrder] = useState(null);

  // Status Change Menu State
  const [statusMenuAnchor, setStatusMenuAnchor] = useState(null);
  const [targetOrderForStatus, setTargetOrderForStatus] = useState(null);

  const getToken = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return null;
    }
    return token;
  }, [navigate]);

  const authHeaders = useCallback((token) => ({
    'Authorization': `Bearer ${token}`
  }), []);

  // Fetch Settings, Products, Customers, PreOrders
  const fetchSettings = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/settings`, { headers: authHeaders(token) });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setSettings(data);
          if (data.currency) setCurrency(data.currency);
          if (data.storeName) setStoreName(data.storeName);
        }
      }
    } catch { /* silent */ }
  }, [getToken, authHeaders]);

  const fetchDropdowns = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) return;
      const [prodRes, custRes] = await Promise.all([
        fetch(`${API_URL}/api/products`, { headers: authHeaders(token) }),
        fetch(`${API_URL}/api/customers`, { headers: authHeaders(token) })
      ]);
      if (prodRes.ok) setProducts(await prodRes.json());
      if (custRes.ok) setCustomers(await custRes.json());
    } catch { /* silent */ }
  }, [getToken, authHeaders]);

  const fetchPreOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/pre-orders`, { headers: authHeaders(token) });
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch pre-orders');
      setPreOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load pre-orders');
    } finally {
      setLoading(false);
    }
  }, [getToken, authHeaders, navigate]);

  useEffect(() => {
    fetchSettings();
    fetchDropdowns();
    fetchPreOrders();
  }, [fetchSettings, fetchDropdowns, fetchPreOrders]);

  // Form Calculations
  const formTotalAmount = formItems.reduce((sum, item) => {
    const q = parseFloat(item.quantity) || 0;
    const p = parseFloat(item.price) || 0;
    return sum + (q * p);
  }, 0);
  const formAdvance = parseFloat(formData.advanceAmount) || 0;
  const formDue = Math.max(0, formTotalAmount - formAdvance);

  // Form Handlers
  const handleOpenCreate = () => {
    setIsEditing(false);
    setEditId(null);
    setFormData({
      customerId: '',
      customerName: '',
      customerPhone: '',
      advanceAmount: '',
      expectedDate: '',
      status: 'Pending',
      notes: '',
    });
    setFormItems([emptyItem()]);
    setFormError('');
    setOpenFormDialog(true);
  };

  const handleOpenEdit = (order) => {
    setIsEditing(true);
    setEditId(order.id);
    setFormData({
      customerId: order.customerId || '',
      customerName: order.customerName || '',
      customerPhone: order.customerPhone || '',
      advanceAmount: order.advanceAmount,
      expectedDate: order.expectedDate ? dayjs(order.expectedDate).format('YYYY-MM-DD') : '',
      status: order.status || 'Pending',
      notes: order.notes || '',
    });
    setFormItems(
      order.items && order.items.length > 0
        ? order.items.map(it => ({
          productId: it.productId || '',
          name: it.name,
          quantity: it.quantity,
          price: it.price,
          total: it.total
        }))
        : [emptyItem()]
    );
    setFormError('');
    setOpenFormDialog(true);
  };

  const handleAddItemRow = () => {
    setFormItems(prev => [...prev, emptyItem()]);
  };

  const handleRemoveItemRow = (idx) => {
    if (formItems.length === 1) {
      setFormItems([emptyItem()]);
      return;
    }
    setFormItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, value) => {
    setFormItems(prev => {
      const updated = [...prev];
      const current = { ...updated[idx], [field]: value };

      if (field === 'productId') {
        const prod = products.find(p => p.id === value);
        if (prod) {
          current.name = prod.name;
          current.price = prod.price > 0 ? prod.price : (prod.supplierPrice || 0);
        }
      }

      const q = parseFloat(current.quantity) || 0;
      const p = parseFloat(current.price) || 0;
      current.total = q * p;
      updated[idx] = current;
      return updated;
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const validItems = formItems.filter(it => it.name.trim() && (parseFloat(it.quantity) > 0));
    if (validItems.length === 0) {
      setFormError('Please add at least one item with a valid name and quantity.');
      return;
    }

    if (!formData.customerId && !formData.customerName.trim()) {
      setFormError('Please select an existing customer or enter a customer name.');
      return;
    }

    setFormLoading(true);
    try {
      const token = getToken();
      if (!token) return;

      const payload = {
        customerId: formData.customerId || null,
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
        advanceAmount: parseFloat(formData.advanceAmount) || 0,
        expectedDate: formData.expectedDate || null,
        status: formData.status,
        notes: formData.notes.trim(),
        items: validItems.map(it => ({
          productId: it.productId || null,
          name: it.name.trim(),
          quantity: parseFloat(it.quantity) || 1,
          price: parseFloat(it.price) || 0,
        }))
      };

      const url = isEditing ? `${API_URL}/api/pre-orders/${editId}` : `${API_URL}/api/pre-orders`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save pre-order');

      setSuccessMsg(isEditing ? 'Pre-order updated successfully!' : 'Pre-order created successfully!');
      setOpenFormDialog(false);
      fetchPreOrders();
    } catch (err) {
      setFormError(err.message || 'Something went wrong');
    } finally {
      setFormLoading(false);
    }
  };

  // Status Changer
  const handleQuickStatusChange = async (newStatus) => {
    if (!targetOrderForStatus) return;
    setStatusMenuAnchor(null);
    try {
      const token = getToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/api/pre-orders/${targetOrderForStatus.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        setSuccessMsg(`Order ${targetOrderForStatus.orderNo} status updated to ${newStatus}`);
        fetchPreOrders();
      }
    } catch (err) {
      setError('Failed to update status: ' + err.message);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async (ids) => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/api/pre-orders`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete pre-orders');

      setSuccessMsg('Selected pre-order(s) deleted successfully!');
      setSelected([]);
      setOpenDeleteDialog(false);
      fetchPreOrders();
    } catch (err) {
      setError(err.message || 'Error deleting pre-orders');
      setOpenDeleteDialog(false);
    } finally {
      setLoading(false);
    }
  };

  // PDF / Print Slip Generation
  const handlePrintSlip = (order) => {
    if (!order) return;
    try {
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();

      // Header Bar
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pageW, 26, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(storeName.toUpperCase(), 14, 12);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`PRE-ORDER / ADVANCE BOOKING SLIP: ${order.orderNo}`, 14, 20);

      const orderDate = dayjs(order.createdAt || order.orderDate).format('DD/MM/YYYY hh:mm A');
      doc.text(`Booking Date: ${orderDate}`, pageW - 14, 20, { align: 'right' });

      // Customer & Status Details
      doc.setTextColor(30, 41, 59);
      const infoY = 36;
      const col2 = pageW / 2 + 5;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('CUSTOMER INFORMATION', 14, infoY);
      doc.text('ORDER & DELIVERY DETAILS', col2, infoY);

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      const custName = order.customer?.name || order.customerName || 'N/A';
      const custPhone = order.customer?.phone || order.customerPhone || 'N/A';
      doc.text(`Name: ${custName}\nPhone: ${custPhone}`, 14, infoY + 6);

      const expDate = order.expectedDate ? dayjs(order.expectedDate).format('DD/MM/YYYY') : 'Not Specified';
      doc.text(`Status: ${order.status.toUpperCase()}\nExpected Delivery: ${expDate}`, col2, infoY + 6);

      if (order.notes) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Notes: ${order.notes}`, 14, infoY + 20, { maxWidth: pageW - 28 });
      }

      // Items Table
      const tableStartY = infoY + (order.notes ? 28 : 22);
      const itemsList = (order.items || []).map((it, i) => [
        i + 1,
        it.name,
        it.quantity,
        `${currency}${parseFloat(it.price).toFixed(2)}`,
        `${currency}${parseFloat(it.total).toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: tableStartY,
        head: [['#', 'Item / Product Description', 'Quantity', 'Rate', 'Total']],
        body: itemsList,
        styles: { fontSize: 9, cellPadding: 3, textColor: [71, 85, 105] },
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 9 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'right' },
          4: { halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: 14, right: 14 }
      });

      // Totals Box
      const totalsY = doc.lastAutoTable.finalY + 8;
      const totalsX = pageW - 80;
      const totalsW = 66;

      const drawRow = (label, value, y, bgRgb, textRgb) => {
        doc.setFillColor(...bgRgb);
        doc.rect(totalsX, y, totalsW, 8.5, 'F');
        doc.setTextColor(...textRgb);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(label, totalsX + 3, y + 5.5);
        doc.text(`${currency} ${parseFloat(value).toFixed(2)}`, totalsX + totalsW - 3, y + 5.5, { align: 'right' });
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.rect(totalsX, y, totalsW, 8.5);
      };

      drawRow('Total Order Value', order.totalAmount, totalsY, [255, 255, 255], [15, 23, 42]);
      drawRow('Advance Paid (Deposit)', order.advanceAmount, totalsY + 8.5, [240, 253, 244], [21, 128, 61]);
      drawRow('Remaining Balance Due', order.dueAmount, totalsY + 17, [254, 242, 242], [185, 28, 28]);

      // Footer
      const pageH = doc.internal.pageSize.getHeight();
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text(settings?.receiptFooter || 'Thank you for your pre-order!', pageW / 2, pageH - 18, { align: 'center' });

      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(`Pre-Order Management System • Booking #${order.orderNo}`, 14, pageH - 8);

      doc.save(`PreOrder_${order.orderNo}.pdf`);
      setSuccessMsg(`Booking Slip ${order.orderNo} downloaded successfully!`);
    } catch (err) {
      console.error(err);
      setError('Failed to print booking slip: ' + err.message);
    }
  };

  // Status Styling Helper
  const getStatusChip = (status) => {
    switch (status) {
      case 'Pending':
        return <Chip label="Pending" size="small" sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 600, fontSize: '0.75rem' }} />;
      case 'Processing':
        return <Chip label="Processing" size="small" sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 600, fontSize: '0.75rem' }} />;
      case 'Ready':
        return <Chip label="Ready" size="small" sx={{ bgcolor: '#f0fdfa', color: '#0f766e', fontWeight: 600, fontSize: '0.75rem' }} />;
      case 'Delivered':
        return <Chip label="Delivered" size="small" sx={{ bgcolor: '#ecfdf5', color: '#047857', fontWeight: 600, fontSize: '0.75rem' }} />;
      case 'Cancelled':
        return <Chip label="Cancelled" size="small" sx={{ bgcolor: '#fef2f2', color: '#b91c1c', fontWeight: 600, fontSize: '0.75rem' }} />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  // Filtered Pre-Orders
  const filteredOrders = preOrders.filter(o => {
    if (statusFilter === 'all') return true;
    return o.status === statusFilter;
  });

  // KPI Calculations
  const totalCount = preOrders.length;
  const pendingCount = preOrders.filter(o => o.status === 'Pending' || o.status === 'Processing').length;
  const readyCount = preOrders.filter(o => o.status === 'Ready').length;
  const deliveredCount = preOrders.filter(o => o.status === 'Delivered').length;
  const totalAdvanceCollected = preOrders.reduce((sum, o) => sum + (o.advanceAmount || 0), 0);
  const totalPendingDue = preOrders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').reduce((sum, o) => sum + (o.dueAmount || 0), 0);

  // DataTable Columns
  const columns = [
    {
      id: 'orderNo',
      label: 'Order No',
      sortable: true,
      render: (row) => (
        <Typography sx={{ fontWeight: 700, color: '#2563eb', fontSize: '0.85rem' }}>
          {row.orderNo}
        </Typography>
      )
    },
    {
      id: 'customer',
      label: 'Customer',
      sortable: true,
      render: (row) => {
        const name = row.customer?.name || row.customerName || 'Walk-in Customer';
        const phone = row.customer?.phone || row.customerPhone;
        return (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
              {name}
            </Typography>
            {phone && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.75rem' }}>
                {phone}
              </Typography>
            )}
          </Box>
        );
      }
    },
    {
      id: 'items',
      label: 'Items Booked',
      sortable: false,
      render: (row) => {
        const count = row.items?.length || 0;
        const names = (row.items || []).map(it => `${it.name} (x${it.quantity})`).join(', ');
        return (
          <Tooltip title={names || 'No items'}>
            <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.825rem' }}>
              {count} item{count > 1 ? 's' : ''}: {names}
            </Typography>
          </Tooltip>
        );
      }
    },
    {
      id: 'expectedDate',
      label: 'Expected Date',
      sortable: true,
      render: (row) => row.expectedDate ? dayjs(row.expectedDate).format('DD/MM/YYYY') : '-'
    },
    {
      id: 'totalAmount',
      label: 'Total Value',
      sortable: true,
      render: (row) => `${currency}${parseFloat(row.totalAmount).toFixed(2)}`
    },
    {
      id: 'advanceAmount',
      label: 'Advance Paid',
      sortable: true,
      render: (row) => (
        <Typography sx={{ color: '#16a34a', fontWeight: 600, fontSize: '0.85rem' }}>
          {currency}{parseFloat(row.advanceAmount).toFixed(2)}
        </Typography>
      )
    },
    {
      id: 'dueAmount',
      label: 'Remaining Due',
      sortable: true,
      render: (row) => (
        <Typography sx={{ color: parseFloat(row.dueAmount) > 0 ? '#dc2626' : '#64748b', fontWeight: parseFloat(row.dueAmount) > 0 ? 600 : 400, fontSize: '0.85rem' }}>
          {currency}{parseFloat(row.dueAmount).toFixed(2)}
        </Typography>
      )
    },
    {
      id: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <Box
          onClick={(e) => {
            e.stopPropagation();
            setTargetOrderForStatus(row);
            setStatusMenuAnchor(e.currentTarget);
          }}
          sx={{ cursor: 'pointer', display: 'inline-block' }}
        >
          {getStatusChip(row.status)}
        </Box>
      )
    },
    {
      id: 'actions',
      label: 'Actions',
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="View Details">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setViewOrder(row);
                setOpenViewDialog(true);
              }}
              sx={{ color: '#64748b', '&:hover': { color: '#2563eb' } }}
            >
              <VisibilityIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Print Booking Slip">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handlePrintSlip(row);
              }}
              sx={{ color: '#64748b', '&:hover': { color: '#059669' } }}
            >
              <PrintIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit Pre-Order">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenEdit(row);
              }}
              sx={{ color: '#64748b', '&:hover': { color: '#d97706' } }}
            >
              <EditIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteIds([row.id]);
                setOpenDeleteDialog(true);
              }}
              sx={{ color: '#64748b', '&:hover': { color: '#dc2626' } }}
            >
              <DeleteIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      )
    }
  ];

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', display: 'flex', flexDirection: 'column', gap: 3, fontFamily: '"Inter", sans-serif' }}>
      
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
            Pre-Orders & Advance Bookings
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage customer advance orders, booking deposits, and delivery schedules.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenCreate}
          sx={{ borderRadius: 1.5, px: 2.5, py: 1, textTransform: 'none', fontWeight: 600 }}
        >
          Create Pre-Order
        </Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {successMsg && <Alert severity="success">{successMsg}</Alert>}

      {/* KPI Cards */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                Total Orders
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a', mt: 0.5 }}>
                {totalCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 600, textTransform: 'uppercase' }}>
                Pending / In Progress
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#b45309', mt: 0.5 }}>
                {pendingCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#0f766e', fontWeight: 600, textTransform: 'uppercase' }}>
                Ready for Pickup
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f766e', mt: 0.5 }}>
                {readyCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 600, textTransform: 'uppercase' }}>
                Advance Collected
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#16a34a', mt: 0.5 }}>
                {currency}{totalAdvanceCollected.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="caption" sx={{ color: '#dc2626', fontWeight: 600, textTransform: 'uppercase' }}>
                Pending Balance Due
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#dc2626', mt: 0.5 }}>
                {currency}{totalPendingDue.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Table Card */}
      <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {/* Status Filter Chips */}
        <Box sx={{ px: 3, pt: 2.5, pb: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap', borderBottom: '1px solid #f1f5f9' }}>
          {[
            { label: 'All Orders', value: 'all', count: totalCount },
            { label: 'Pending', value: 'Pending', count: preOrders.filter(o => o.status === 'Pending').length },
            { label: 'Processing', value: 'Processing', count: preOrders.filter(o => o.status === 'Processing').length },
            { label: 'Ready', value: 'Ready', count: readyCount },
            { label: 'Delivered', value: 'Delivered', count: deliveredCount },
            { label: 'Cancelled', value: 'Cancelled', count: preOrders.filter(o => o.status === 'Cancelled').length },
          ].map((tab) => (
            <Chip
              key={tab.value}
              label={`${tab.label} (${tab.count})`}
              onClick={() => setStatusFilter(tab.value)}
              variant={statusFilter === tab.value ? 'filled' : 'outlined'}
              color={statusFilter === tab.value ? 'primary' : 'default'}
              sx={{ fontWeight: statusFilter === tab.value ? 700 : 500, fontSize: '0.8rem', cursor: 'pointer' }}
            />
          ))}
        </Box>

        <DataTable
          columns={columns}
          data={filteredOrders}
          loading={loading}
          selected={selected}
          onSelectedChange={setSelected}
          searchPlaceholder="Search order number, customer, phone..."
          bulkActions={[
            {
              label: 'Delete Selected',
              icon: <DeleteIcon fontSize="small" />,
              color: 'error',
              action: (ids) => {
                setDeleteIds(ids);
                setOpenDeleteDialog(true);
              }
            }
          ]}
        />
      </Card>

      {/* Quick Status Change Menu */}
      <Menu
        anchorEl={statusMenuAnchor}
        open={Boolean(statusMenuAnchor)}
        onClose={() => setStatusMenuAnchor(null)}
        PaperProps={{
          sx: { minWidth: 160, borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }
        }}
      >
        <Typography variant="caption" sx={{ px: 2, py: 0.5, fontWeight: 700, color: '#94a3b8', display: 'block' }}>
          CHANGE STATUS
        </Typography>
        <Divider sx={{ my: 0.5 }} />
        {['Pending', 'Processing', 'Ready', 'Delivered', 'Cancelled'].map((st) => (
          <MenuItem
            key={st}
            onClick={() => handleQuickStatusChange(st)}
            selected={targetOrderForStatus?.status === st}
            sx={{ fontSize: '0.85rem', py: 0.75 }}
          >
            {st}
          </MenuItem>
        ))}
      </Menu>

      {/* Create / Edit Pre-Order Modal Dialog */}
      <Dialog
        open={openFormDialog}
        onClose={() => !formLoading && setOpenFormDialog(false)}
        maxWidth="md"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1, borderBottom: '1px solid #f1f5f9' }}>
          {isEditing ? `Edit Pre-Order (${formData.customerName || 'Customer'})` : 'Create New Pre-Order / Booking'}
        </DialogTitle>

        <form onSubmit={handleFormSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2.5 }}>
            {formError && <Alert severity="error">{formError}</Alert>}

            {/* Customer Details */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b' }}>
              1. Customer Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Autocomplete
                  options={customers}
                  getOptionLabel={(option) => `${option.name} ${option.phone ? `(${option.phone})` : ''}`}
                  value={customers.find(c => c.id === formData.customerId) || null}
                  onChange={(_, newValue) => {
                    if (newValue) {
                      setFormData(prev => ({
                        ...prev,
                        customerId: newValue.id,
                        customerName: newValue.name,
                        customerPhone: newValue.phone || ''
                      }));
                    } else {
                      setFormData(prev => ({ ...prev, customerId: '' }));
                    }
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Select Existing Customer" size="small" placeholder="Search customer..." />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Customer Name *"
                  size="small"
                  fullWidth
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder="Enter customer name"
                  required
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Phone Number"
                  size="small"
                  fullWidth
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  placeholder="0300-1234567"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 1 }} />

            {/* Items Table */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                2. Ordered Items
              </Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddItemRow}
                variant="outlined"
                sx={{ borderRadius: 1.5, textTransform: 'none' }}
              >
                Add Item
              </Button>
            </Box>

            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell style={{ width: '40%' }}>Item / Product</TableCell>
                    <TableCell style={{ width: '20%' }}>Quantity</TableCell>
                    <TableCell style={{ width: '20%' }}>Unit Price ({currency})</TableCell>
                    <TableCell style={{ width: '15%' }}>Total ({currency})</TableCell>
                    <TableCell align="right" style={{ width: '5%' }}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {formItems.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Autocomplete
                          freeSolo
                          options={products}
                          getOptionLabel={(opt) => (typeof opt === 'string' ? opt : `${opt.name} (${currency}${parseFloat(opt.price || opt.supplierPrice || 0).toFixed(2)})`)}
                          value={products.find(p => p.id === item.productId) || item.name}
                          onChange={(_, newVal) => {
                            if (typeof newVal === 'object' && newVal !== null) {
                              handleItemChange(idx, 'productId', newVal.id);
                            } else if (typeof newVal === 'string') {
                              handleItemChange(idx, 'productId', '');
                              handleItemChange(idx, 'name', newVal);
                            }
                          }}
                          onInputChange={(_, newInputValue) => {
                            if (!item.productId) {
                              handleItemChange(idx, 'name', newInputValue);
                            }
                          }}
                          renderInput={(params) => (
                            <TextField {...params} placeholder="Product name or select..." size="small" />
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          size="small"
                          fullWidth
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          slotProps={{ htmlInput: { min: 1, step: 'any' } }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          size="small"
                          fullWidth
                          value={item.price}
                          onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                          slotProps={{ htmlInput: { min: 0, step: 'any' } }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {currency}{parseFloat(item.total).toFixed(2)}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" color="error" onClick={() => handleRemoveItemRow(idx)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider sx={{ my: 1 }} />

            {/* Payment & Schedule Details */}
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b' }}>
              3. Payment & Delivery Details
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={3}>
                <TextField
                  label={`Total Order Value (${currency})`}
                  size="small"
                  fullWidth
                  value={formTotalAmount.toFixed(2)}
                  disabled
                  slotProps={{ htmlInput: { style: { fontWeight: 700, color: '#0f172a' } } }}
                />
              </Grid>

              <Grid item xs={12} sm={3}>
                <TextField
                  label={`Advance Deposit (${currency})`}
                  type="number"
                  size="small"
                  fullWidth
                  value={formData.advanceAmount}
                  onChange={(e) => setFormData({ ...formData, advanceAmount: e.target.value })}
                  placeholder="0.00"
                  slotProps={{ htmlInput: { min: 0, step: 'any' } }}
                />
              </Grid>

              <Grid item xs={12} sm={3}>
                <TextField
                  label={`Remaining Due (${currency})`}
                  size="small"
                  fullWidth
                  value={formDue.toFixed(2)}
                  disabled
                  slotProps={{ htmlInput: { style: { fontWeight: 700, color: formDue > 0 ? '#dc2626' : '#16a34a' } } }}
                />
              </Grid>

              <Grid item xs={12} sm={3}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    label="Status"
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <MenuItem value="Pending">Pending</MenuItem>
                    <MenuItem value="Processing">Processing</MenuItem>
                    <MenuItem value="Ready">Ready</MenuItem>
                    <MenuItem value="Delivered">Delivered</MenuItem>
                    <MenuItem value="Cancelled">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DatePicker
                    label="Expected Delivery / Arrival Date"
                    value={formData.expectedDate ? dayjs(formData.expectedDate) : null}
                    onChange={(newVal) => setFormData(f => ({ ...f, expectedDate: newVal ? newVal.format('YYYY-MM-DD') : '' }))}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </LocalizationProvider>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Special Notes / Instructions"
                  size="small"
                  fullWidth
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g., Customer requested specific shade/model..."
                />
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions sx={{ p: 2.5, borderTop: '1px solid #f1f5f9' }}>
            <Button onClick={() => setOpenFormDialog(false)} disabled={formLoading} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={formLoading}
              sx={{ borderRadius: 1.5, px: 3, textTransform: 'none', fontWeight: 600 }}
            >
              {formLoading ? 'Saving...' : (isEditing ? 'Update Pre-Order' : 'Save Pre-Order')}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog
        open={openViewDialog}
        onClose={() => setOpenViewDialog(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1, borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Booking #{viewOrder?.orderNo}</span>
          {viewOrder && getStatusChip(viewOrder.status)}
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {viewOrder && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', bgcolor: '#f8fafc', p: 2, borderRadius: 1.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">CUSTOMER</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {viewOrder.customer?.name || viewOrder.customerName || 'Walk-in Customer'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {viewOrder.customer?.phone || viewOrder.customerPhone || 'No Phone'}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" color="text.secondary">EXPECTED DELIVERY</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {viewOrder.expectedDate ? dayjs(viewOrder.expectedDate).format('DD/MM/YYYY') : 'Not Specified'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Booked: {dayjs(viewOrder.createdAt).format('DD/MM/YYYY')}
                  </Typography>
                </Box>
              </Box>

              {viewOrder.notes && (
                <Alert severity="info" sx={{ py: 0.5, fontSize: '0.85rem' }}>
                  <strong>Notes:</strong> {viewOrder.notes}
                </Alert>
              )}

              <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>Items Breakdown</Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell>Item</TableCell>
                      <TableCell align="center">Qty</TableCell>
                      <TableCell align="right">Rate</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(viewOrder.items || []).map((it, idx) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ fontWeight: 500 }}>{it.name}</TableCell>
                        <TableCell align="center">{it.quantity}</TableCell>
                        <TableCell align="right">{currency}{parseFloat(it.price).toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>{currency}{parseFloat(it.total).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, p: 2, bgcolor: '#f8fafc', borderRadius: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Total Order Value:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{currency}{parseFloat(viewOrder.totalAmount).toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" sx={{ color: '#16a34a' }}>Advance Paid (Deposit):</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#16a34a' }}>{currency}{parseFloat(viewOrder.advanceAmount).toFixed(2)}</Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#dc2626' }}>Remaining Balance Due:</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#dc2626' }}>{currency}{parseFloat(viewOrder.dueAmount).toFixed(2)}</Typography>
                </Box>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #f1f5f9' }}>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={() => handlePrintSlip(viewOrder)}
            sx={{ borderRadius: 1.5, textTransform: 'none' }}
          >
            Download Slip PDF
          </Button>
          <Button onClick={() => setOpenViewDialog(false)} sx={{ textTransform: 'none' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={() => setOpenDeleteDialog(false)}
        slotProps={{ paper: { sx: { borderRadius: 2, width: 400 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to delete {deleteIds.length} selected pre-order(s)? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDeleteDialog(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => handleBulkDelete(deleteIds)}
            sx={{ borderRadius: 1.5, textTransform: 'none' }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default PreOrders;
