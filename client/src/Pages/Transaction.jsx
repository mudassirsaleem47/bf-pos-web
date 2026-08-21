import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Chip,
  IconButton,
  Alert,
  Snackbar
} from '@mui/material';
import {
  ReceiptLong as ReceiptIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingIcon,
  Percent as TaxIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Print as PrintIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';
import DataTable from '../Components/DataTable';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') ? import.meta.env.VITE_API_URL : window.location.origin);

const Transaction = () => {
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selected, setSelected] = useState([]);

  // Settings / Store details
  const [storeSettings, setStoreSettings] = useState({
    storeName: 'BF Makeup',
    address: '',
    phone: '',
    email: '',
    website: '',
    currency: 'Rs.',
    receiptFooter: 'Thank you! Come again'
  });

  // View Details dialog states
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [activeSale, setActiveSale] = useState(null);

  // Delete dialog states
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
        setStoreSettings(data);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const fetchSales = async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/api/sales`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch sales transactions');

      setSales(Array.isArray(data) ? data : []);
      setSelected([]);
    } catch (err) {
      setError(err.message || 'Something went wrong fetching sales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
    fetchSettings();
  }, []);

  const handleBulkDelete = async (ids) => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const token = getToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/api/sales`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids })
      });

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete sale transaction(s)');

      setSuccessMsg('Voided selected transaction(s) successfully!');
      fetchSales();
      setOpenDeleteDialog(false);
      setSelected([]);
    } catch (err) {
      setError(err.message || 'Void transaction failed');
      setOpenDeleteDialog(false);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = (sale) => {
    if (!sale) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // Blue colored header bar
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageW, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(storeSettings.storeName.toUpperCase(), 14, 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Receipt: ${sale.receiptNo}`, 14, 20);
    if (sale.orderNo) {
      doc.text(`Order #: ${sale.orderNo}`, 14, 24);
    }

    const dateStr = dayjs(sale.createdAt).format('DD/MM/YYYY hh:mm A');
    doc.text(`Date: ${dateStr}`, pageW - 14, 20, { align: 'right' });

    // Store profile details
    doc.setTextColor(30, 41, 59);
    const infoY = 38;
    const col2 = pageW / 2 + 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('STORE ADDRESS', 14, infoY);
    doc.text('CONTACT & ORDER DETAILS', col2, infoY);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(storeSettings.address || 'N/A', 14, infoY + 6, { maxWidth: pageW / 2 - 10 });

    let contactText = '';
    if (storeSettings.phone) contactText += `Phone: ${storeSettings.phone}\n`;
    if (storeSettings.email) contactText += `Email: ${storeSettings.email}\n`;
    if (sale.orderNo) contactText += `Order #: ${sale.orderNo}\n`;
    if (sale.notes) contactText += `Notes: ${sale.notes}\n`;
    if (storeSettings.website) contactText += `Web: ${storeSettings.website}`;
    doc.text(contactText || 'N/A', col2, infoY + 6);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, infoY + 24, pageW - 14, infoY + 24);

    // Items table
    const tableStartY = infoY + 30;
    autoTable(doc, {
      startY: tableStartY,
      head: [['#', 'Item / Product', 'Barcode', 'Quantity', `Price (${storeSettings.currency})`, `Total (${storeSettings.currency})`]],
      body: sale.items.map((item, i) => [
        i + 1,
        parseFloat(item.discount || 0) > 0 
          ? `${item.name}\n(Disc: -${storeSettings.currency}${parseFloat(item.discount).toFixed(2)})`
          : item.name,
        item.barcode || '-',
        item.quantity,
        parseFloat(item.price).toFixed(2),
        parseFloat(item.total).toFixed(2),
      ]),
      styles: { fontSize: 9, cellPadding: 3, textColor: [71, 85, 105] },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
      tableLineColor: [226, 232, 240],
      tableLineWidth: 0.3,
    });

    // Totals Section
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
      doc.text(`${storeSettings.currency} ${value}`, totalsX + totalsW - 3, y + 6, { align: 'right' });
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.rect(totalsX, y, totalsW, 9);
    };

    const taxVal = sale.tax || 0;
    const shippingVal = sale.shipping || 0;
    const subtotalVal = sale.totalAmount + sale.discount - taxVal - shippingVal;

    let curY = totalsY;
    drawTotalRow('Subtotal', subtotalVal.toFixed(2), curY, [255, 255, 255], [15, 23, 42]);
    curY += 9;
    if (sale.discount > 0) {
      drawTotalRow('Discount Given', sale.discount.toFixed(2), curY, [254, 242, 242], [185, 28, 28]);
      curY += 9;
    }
    if (taxVal > 0) {
      drawTotalRow('Tax Collected', taxVal.toFixed(2), curY, [255, 255, 255], [15, 23, 42]);
      curY += 9;
    }
    if (shippingVal > 0) {
      drawTotalRow('Shipping Fee', shippingVal.toFixed(2), curY, [240, 249, 255], [2, 132, 199]);
      curY += 9;
    }
    drawTotalRow('Grand Total', sale.totalAmount.toFixed(2), curY, [248, 250, 252], [15, 23, 42]);
    curY += 9;
    drawTotalRow('Paid Amount', sale.paidAmount.toFixed(2), curY, [240, 253, 244], [21, 128, 61]);
    curY += 9;
    drawTotalRow('Cash Change', sale.change.toFixed(2), curY, [240, 253, 244], [21, 128, 61]);

    // Footer note
    const pageH = doc.internal.pageSize.getHeight();
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.text(storeSettings.receiptFooter, pageW / 2, pageH - 20, { align: 'center' });

    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`POS Cashier Transaction System • Receipt #${sale.receiptNo}`, 14, pageH - 8);
    doc.text('Inventory Management System', pageW - 14, pageH - 8, { align: 'right' });

    doc.save(`${sale.receiptNo}.pdf`);
  };

  // Stats calculation
  const totalTransactionsCount = sales.length;
  const totalSalesRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalDiscounts = sales.reduce((sum, s) => sum + s.discount, 0);
  const totalTaxes = sales.reduce((sum, s) => sum + s.tax, 0);

  const columns = [
    { id: 'receiptNo', label: 'Receipt #', sortable: true, cellSx: { fontWeight: 700, color: '#2563eb' } },
    {
      id: 'orderNo',
      label: 'Order #',
      sortable: true,
      render: (row) => row.orderNo || '-'
    },
    {
      id: 'customer',
      label: 'Customer',
      sortable: false,
      render: (row) => row.customer?.name || 'Walk-in'
    },
    {
      id: 'createdAt',
      label: 'Date & Time',
      sortable: true,
      render: (row) => dayjs(row.createdAt).format('DD/MM/YYYY hh:mm A')
    },
    {
      id: 'items',
      label: 'Items Qty',
      sortable: false,
      render: (row) => `${row.items.length} ${row.items.length === 1 ? 'item' : 'items'}`
    },
    {
      id: 'discount',
      label: 'Discount',
      sortable: true,
      render: (row) => `${storeSettings.currency} ${parseFloat(row.discount).toFixed(2)}`
    },
    {
      id: 'tax',
      label: 'Tax',
      sortable: true,
      render: (row) => `${storeSettings.currency} ${parseFloat(row.tax).toFixed(2)}`
    },
    {
      id: 'totalAmount',
      label: 'Total Paid',
      sortable: true,
      render: (row) => (
        <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>
          {storeSettings.currency} {parseFloat(row.totalAmount).toFixed(2)}
        </Typography>
      )
    },
    {
      id: 'actions',
      label: 'Actions',
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <IconButton
            onClick={(e) => { e.stopPropagation(); setActiveSale(row); setOpenViewDialog(true); }}
            size="small"
            sx={{ color: '#64748b', '&:hover': { color: '#2563eb' } }}
          >
            <VisibilityIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <IconButton
            onClick={(e) => { e.stopPropagation(); handlePrintReceipt(row); }}
            size="small"
            sx={{ color: '#64748b', '&:hover': { color: '#059669' } }}
          >
            <PrintIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Stack>
      )
    }
  ];

  const bulkActions = [
    {
      label: 'Void / Delete Selected',
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
          Sale Transactions Log
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/pos')}
          sx={{ borderRadius: 2 }}
        >
          Launch POS Cashier
        </Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Summary Metrics */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: '20px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#eff6ff', borderRadius: 1.5, display: 'flex', color: '#2563eb' }}>
                <ReceiptIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Total Transactions
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#0f172a' }}>
                  {totalTransactionsCount}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: '20px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#ecfdf5', borderRadius: 1.5, display: 'flex', color: '#10b981' }}>
                <MoneyIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Sales Revenue
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#0f172a' }}>
                  {storeSettings.currency} {totalSalesRevenue.toFixed(2)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: '20px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#fef2f2', borderRadius: 1.5, display: 'flex', color: '#ef4444' }}>
                <TrendingIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Discounts Given
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#0f172a' }}>
                  {storeSettings.currency} {totalDiscounts.toFixed(2)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: '20px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#fffbeb', borderRadius: 1.5, display: 'flex', color: '#d97706' }}>
                <TaxIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Total Tax Collected
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#0f172a' }}>
                  {storeSettings.currency} {totalTaxes.toFixed(2)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main transactions table */}
      <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          data={sales}
          loading={loading}
          selected={selected}
          onSelectedChange={setSelected}
          bulkActions={bulkActions}
          searchPlaceholder="Search by receipt number, order #, customer..."
          storageKey="transactions"
        />
      </Card>

      {/* View Dialog Details */}
      <Dialog
        open={openViewDialog}
        onClose={() => { setOpenViewDialog(false); setActiveSale(null); }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        {activeSale && (
          <>
            <DialogTitle sx={{ fontWeight: 700, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Checkout Receipt Details
                <Chip
                  label={activeSale.receiptNo}
                  size="small"
                  sx={{ ml: 1, bgcolor: '#eff6ff', color: '#2563eb', fontWeight: 700 }}
                />
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<PrintIcon />}
                onClick={() => handlePrintReceipt(activeSale)}
                sx={{ borderRadius: 1.5 }}
              >
                Print PDF
              </Button>
            </DialogTitle>
            <Divider sx={{ mx: 3 }} />
            <DialogContent sx={{ py: 3 }}>
              {/* Receipt Meta Box */}
              <Box sx={{ bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 1.5, p: 2, mb: 3 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>Store:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{storeSettings.storeName}</Typography>
                  </Grid>
                  <Grid item xs={6} sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>Transaction Date:</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {dayjs(activeSale.createdAt).format('DD/MM/YYYY hh:mm A')}
                    </Typography>
                  </Grid>
                  {activeSale.customer && (
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>Customer:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {activeSale.customer.name} {activeSale.customer.phone ? `(${activeSale.customer.phone})` : ''}
                      </Typography>
                    </Grid>
                  )}
                  {activeSale.orderNo && (
                    <Grid item xs={6} sx={{ textAlign: activeSale.customer ? 'right' : 'left' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>Order #:</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#2563eb' }}>{activeSale.orderNo}</Typography>
                    </Grid>
                  )}
                  {activeSale.notes && (
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>Notes / Remarks:</Typography>
                      <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#475569' }}>{activeSale.notes}</Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>

              {/* Items list */}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', mb: 1.5 }}>
                Items Purchased
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1.5, mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                      <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }} align="center">Qty</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }} align="right">Price</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8rem' }} align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {activeSale.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell sx={{ fontSize: '0.825rem', fontWeight: 500 }}>
                          {it.name}
                          {parseFloat(it.discount || 0) > 0 && (
                            <Typography variant="caption" display="block" color="error.main" sx={{ fontWeight: 600 }}>
                              Discount: -{storeSettings.currency}{parseFloat(it.discount).toFixed(2)}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.825rem' }} align="center">{it.quantity}</TableCell>
                        <TableCell sx={{ fontSize: '0.825rem' }} align="right">{storeSettings.currency} {it.price.toFixed(2)}</TableCell>
                        <TableCell sx={{ fontSize: '0.825rem', fontWeight: 600 }} align="right">{storeSettings.currency} {it.total.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Summary calculation breakdown */}
              <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, overflow: 'hidden' }}>
                {[
                  { label: 'Subtotal:', value: (activeSale.totalAmount + (activeSale.discount || 0) - (activeSale.tax || 0) - (activeSale.shipping || 0)).toFixed(2) },
                  ...(parseFloat(activeSale.discount || 0) > 0 ? [{ label: 'Discount Given:', value: parseFloat(activeSale.discount).toFixed(2), color: '#dc2626' }] : []),
                  ...(parseFloat(activeSale.tax || 0) > 0 ? [{ label: 'Sales Tax:', value: parseFloat(activeSale.tax).toFixed(2) }] : []),
                  ...(parseFloat(activeSale.shipping || 0) > 0 ? [{ label: 'Shipping Fee:', value: parseFloat(activeSale.shipping).toFixed(2), color: '#0284c7' }] : []),
                  { label: 'Grand Total:', value: parseFloat(activeSale.totalAmount).toFixed(2), bold: true },
                  { label: 'Amount Paid:', value: parseFloat(activeSale.paidAmount).toFixed(2), color: '#16a34a' },
                  { label: 'Cash Change:', value: parseFloat(activeSale.change).toFixed(2), color: '#16a34a' }
                ].map((row, idx, arr) => (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      px: 2.5,
                      py: 1.25,
                      borderBottom: idx === arr.length - 1 ? 'none' : '1px solid #f1f5f9',
                      bgcolor: row.bold ? '#f8fafc' : 'transparent'
                    }}
                  >
                    <Typography variant="body2" sx={{ color: row.color || '#475569', fontWeight: row.bold ? 700 : 500 }}>
                      {row.label}
                    </Typography>
                    <Typography variant="body2" sx={{ color: row.color || '#0f172a', fontWeight: 700 }}>
                      {storeSettings.currency} {row.value}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* Receipt Footer Message */}
              <Typography variant="caption" align="center" sx={{ display: 'block', mt: 3, color: '#94a3b8', fontStyle: 'italic' }}>
                {storeSettings.receiptFooter}
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button
                onClick={() => { setOpenViewDialog(false); setActiveSale(null); }}
                variant="contained"
                sx={{ borderRadius: 1.5 }}
              >
                Close Receipt
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Delete / Void Confirmation Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={() => setOpenDeleteDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon /> Void Sales Transaction
        </DialogTitle>
        <Divider sx={{ mx: 3 }} />
        <DialogContent sx={{ py: 3 }}>
          <Typography variant="body2" sx={{ color: '#475569' }}>
            Are you sure you want to void and delete {deleteIds.length} selected transaction(s)? <strong>This action cannot be undone and will delete the receipts from the transaction log.</strong>
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
            {loading ? 'Voiding...' : 'Void Transaction(s)'}
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

export default Transaction;
