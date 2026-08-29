import React, { useState, useEffect, useMemo } from 'react';
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
  Divider,
  Chip,
  IconButton,
  Alert,
  Tabs,
  Tab,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer
} from '@mui/material';
import {
  LocalShipping as ShippingIcon,
  AttachMoney as MoneyIcon,
  ReceiptLong as ReceiptIcon,
  People as PeopleIcon,
  Visibility as VisibilityIcon,
  Print as PrintIcon,
  CalendarMonth as CalendarIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';
import DataTable from '../Components/DataTable';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000'
  : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') ? import.meta.env.VITE_API_URL : window.location.origin);

const Shippings = () => {
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTab, setSelectedTab] = useState(() => {
    const s = sessionStorage.getItem('shippings_tab');
    return s !== null ? parseInt(s, 10) : 0;
  }); // 0 = Orders with Shipping, 1 = Customer Breakdown

  // Store settings
  const [storeSettings, setStoreSettings] = useState({
    storeName: 'BF Makeup',
    address: '',
    phone: '',
    email: '',
    website: '',
    currency: 'Rs.',
    receiptFooter: 'Thank you! Come again'
  });

  // Month & Year Filter State (Default: Current month)
  const [selectedMonth, setSelectedMonth] = useState(() => sessionStorage.getItem('shippings_month') || dayjs().format('YYYY-MM')); // e.g. "2026-08"
  const [filterMode, setFilterMode] = useState(() => sessionStorage.getItem('shippings_filtermode') || 'monthly'); // 'monthly' | 'all'
  const [onlyWithShipping, setOnlyWithShipping] = useState(() => sessionStorage.getItem('shippings_onlyshipping') !== 'false');

  useEffect(() => {
    sessionStorage.setItem('shippings_tab', selectedTab.toString());
  }, [selectedTab]);

  useEffect(() => {
    sessionStorage.setItem('shippings_month', selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    sessionStorage.setItem('shippings_filtermode', filterMode);
  }, [filterMode]);

  useEffect(() => {
    sessionStorage.setItem('shippings_onlyshipping', onlyWithShipping.toString());
  }, [onlyWithShipping]);

  // View Details Modal State
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [activeSale, setActiveSale] = useState(null);

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

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      if (!token) return;

      const [salesRes, custRes] = await Promise.all([
        fetch(`${API_URL}/api/sales`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/customers`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (salesRes.status === 401 || custRes.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const salesData = await salesRes.json();
      const custData = await custRes.json();

      setSales(Array.isArray(salesData) ? salesData : []);
      setCustomers(Array.isArray(custData) ? custData : []);
    } catch (err) {
      setError(err.message || 'Error loading shipping records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchSettings();
  }, []);

  // Filter sales based on selected month and shipping condition
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const hasShipping = parseFloat(s.shipping || 0) > 0;
      if (onlyWithShipping && !hasShipping) return false;

      if (filterMode === 'monthly') {
        const saleMonth = dayjs(s.createdAt).format('YYYY-MM');
        if (saleMonth !== selectedMonth) return false;
      }

      return true;
    });
  }, [sales, selectedMonth, filterMode, onlyWithShipping]);

  // Aggregate Customer-wise Shipping Stats
  const customerShippingStats = useMemo(() => {
    const map = {};

    filteredSales.forEach(sale => {
      const shippingVal = parseFloat(sale.shipping || 0);
      const custId = sale.customerId || 'walkin';
      const custName = sale.customer?.name || (sale.customerId ? 'Unknown Customer' : 'Walk-in Customer');
      const custPhone = sale.customer?.phone || '-';
      const custAddress = sale.customer?.address || '-';

      if (!map[custId]) {
        map[custId] = {
          id: custId,
          name: custName,
          phone: custPhone,
          address: custAddress,
          orderCount: 0,
          totalShipping: 0,
          totalOrderAmount: 0,
          shippingOrders: [],
          lastDate: sale.createdAt
        };
      }

      map[custId].orderCount += 1;
      map[custId].totalShipping += shippingVal;
      map[custId].totalOrderAmount += parseFloat(sale.totalAmount || 0);
      map[custId].shippingOrders.push(sale);

      if (new Date(sale.createdAt) > new Date(map[custId].lastDate)) {
        map[custId].lastDate = sale.createdAt;
      }
    });

    return Object.values(map).sort((a, b) => b.totalShipping - a.totalShipping);
  }, [filteredSales]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    setSelectedMonth(prev => dayjs(prev + '-01').subtract(1, 'month').format('YYYY-MM'));
  };

  const handleNextMonth = () => {
    setSelectedMonth(prev => dayjs(prev + '-01').add(1, 'month').format('YYYY-MM'));
  };

  const handleCurrentMonth = () => {
    setSelectedMonth(dayjs().format('YYYY-MM'));
    setFilterMode('monthly');
  };

  // Metrics
  const totalShippingSum = filteredSales.reduce((sum, s) => sum + (parseFloat(s.shipping) || 0), 0);
  const shippedOrdersCount = filteredSales.filter(s => (parseFloat(s.shipping) || 0) > 0).length;
  const avgShippingRate = shippedOrdersCount > 0 ? (totalShippingSum / shippedOrdersCount) : 0;
  const uniqueCustomersCount = new Set(filteredSales.map(s => s.customerId || s.customer?.name || 'walkin')).size;

  // Print A4 Invoice PDF
  const handlePrintReceipt = (sale) => {
    if (!sale) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // Blue header bar
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageW, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(storeSettings.storeName.toUpperCase(), 14, 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Receipt: ${sale.receiptNo}`, 14, 20);

    const dateStr = dayjs(sale.createdAt).format('DD/MM/YYYY hh:mm A');
    doc.text(`Date: ${dateStr}`, pageW - 14, 20, { align: 'right' });

    // Store & Customer info
    doc.setTextColor(30, 41, 59);
    const infoY = 38;
    const col2 = pageW / 2 + 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('STORE ADDRESS', 14, infoY);
    doc.text('CUSTOMER / SHIPPING DETAILS', col2, infoY);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(storeSettings.address || 'N/A', 14, infoY + 6, { maxWidth: pageW / 2 - 10 });

    const custName = sale.customer?.name || 'Walk-in Customer';
    let contactText = `Customer: ${custName}\n`;
    if (sale.customer?.phone) contactText += `Phone: ${sale.customer.phone}\n`;
    if (sale.customer?.address) contactText += `Address: ${sale.customer.address}\n`;
    doc.text(contactText, col2, infoY + 6);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, infoY + 24, pageW - 14, infoY + 24);

    // Items table
    const tableStartY = infoY + 30;
    autoTable(doc, {
      startY: tableStartY,
      head: [['#', 'Item / Product', 'Barcode', 'Quantity', `Price (${storeSettings.currency})`, `Total (${storeSettings.currency})`]],
      body: (sale.items || []).map((item, i) => [
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

    doc.save(`${sale.receiptNo}_shipping.pdf`);
  };

  // Columns for Tab 1: Orders / Receipts
  const orderColumns = [
    {
      id: 'receiptNo',
      label: 'Receipt #',
      sortable: true,
      cellSx: { fontWeight: 700, color: '#2563eb' }
    },
    {
      id: 'createdAt',
      label: 'Date & Time',
      sortable: true,
      render: (row) => dayjs(row.createdAt).format('DD/MM/YYYY hh:mm A')
    },
    {
      id: 'customer',
      label: 'Customer Name',
      sortable: true,
      render: (row) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
            {row.customer?.name || 'Walk-in Customer'}
          </Typography>
          {row.customer?.phone && (
            <Typography variant="caption" color="text.secondary" display="block">
              {row.customer.phone}
            </Typography>
          )}
        </Box>
      )
    },
    {
      id: 'items',
      label: 'Items Count',
      sortable: false,
      render: (row) => `${row.items?.length || 0} ${(row.items?.length || 0) === 1 ? 'item' : 'items'}`
    },
    {
      id: 'shipping',
      label: 'Shipping Rate',
      sortable: true,
      render: (row) => (
        <Chip
          label={`${storeSettings.currency} ${parseFloat(row.shipping || 0).toFixed(2)}`}
          size="small"
          sx={{
            fontWeight: 700,
            bgcolor: parseFloat(row.shipping || 0) > 0 ? '#eff6ff' : '#f1f5f9',
            color: parseFloat(row.shipping || 0) > 0 ? '#1d4ed8' : '#64748b',
            border: parseFloat(row.shipping || 0) > 0 ? '1px solid #bfdbfe' : '1px solid #e2e8f0'
          }}
        />
      )
    },
    {
      id: 'totalAmount',
      label: 'Order Total',
      sortable: true,
      render: (row) => (
        <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
          {storeSettings.currency} {parseFloat(row.totalAmount).toFixed(2)}
        </Typography>
      )
    },
    {
      id: 'paidAmount',
      label: 'Status / Paid',
      sortable: true,
      render: (row) => {
        const isFullPaid = row.paidAmount >= row.totalAmount;
        return (
          <Chip
            label={isFullPaid ? 'Paid' : `Due: ${storeSettings.currency}${(row.totalAmount - row.paidAmount).toFixed(0)}`}
            size="small"
            color={isFullPaid ? 'success' : 'warning'}
            variant="outlined"
            sx={{ fontWeight: 600, fontSize: '0.75rem' }}
          />
        );
      }
    },
    {
      id: 'actions',
      label: 'Actions',
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="View Receipt Details">
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                setActiveSale(row);
                setOpenViewDialog(true);
              }}
              size="small"
              sx={{ color: '#64748b', '&:hover': { color: '#2563eb' } }}
            >
              <VisibilityIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Print Receipt PDF">
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                handlePrintReceipt(row);
              }}
              size="small"
              sx={{ color: '#64748b', '&:hover': { color: '#059669' } }}
            >
              <PrintIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      )
    }
  ];

  // Columns for Tab 2: Customer Aggregation
  const customerColumns = [
    {
      id: 'name',
      label: 'Customer Name',
      sortable: true,
      cellSx: { fontWeight: 700, color: '#0f172a' },
      render: (row) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
            {row.name}
          </Typography>
          {row.address && row.address !== '-' && (
            <Typography variant="caption" color="text.secondary" display="block">
              {row.address}
            </Typography>
          )}
        </Box>
      )
    },
    {
      id: 'phone',
      label: 'Phone / Contact',
      sortable: true,
      render: (row) => row.phone || '-'
    },
    {
      id: 'orderCount',
      label: 'Shipped Orders',
      sortable: true,
      render: (row) => (
        <Chip
          label={`${row.orderCount} order${row.orderCount > 1 ? 's' : ''}`}
          size="small"
          sx={{ bgcolor: '#f8fafc', fontWeight: 600 }}
        />
      )
    },
    {
      id: 'totalShipping',
      label: 'Total Shipping Rate Charged',
      sortable: true,
      render: (row) => (
        <Typography variant="body2" sx={{ fontWeight: 700, color: '#1d4ed8' }}>
          {storeSettings.currency} {row.totalShipping.toFixed(2)}
        </Typography>
      )
    },
    {
      id: 'avgRate',
      label: 'Avg. Rate / Order',
      sortable: true,
      render: (row) => (
        <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569' }}>
          {storeSettings.currency} {(row.orderCount > 0 ? row.totalShipping / row.orderCount : 0).toFixed(2)}
        </Typography>
      )
    },
    {
      id: 'totalOrderAmount',
      label: 'Total Orders Value',
      sortable: true,
      render: (row) => `${storeSettings.currency} ${row.totalOrderAmount.toFixed(2)}`
    },
    {
      id: 'lastDate',
      label: 'Last Shipped Date',
      sortable: true,
      render: (row) => dayjs(row.lastDate).format('DD/MM/YYYY')
    }
  ];

  const currentMonthLabel = dayjs(selectedMonth + '-01').format('MMMM YYYY');

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', display: 'flex', flexDirection: 'column', gap: 3, fontFamily: '"Inter", sans-serif' }}>
      
      {/* Page Header */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShippingIcon sx={{ color: '#2563eb', fontSize: 28 }} />
            Shippings & Delivery Rates
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Monthly shipping logs and customer-wise shipping charges record
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={fetchData}
            sx={{ borderRadius: 1.5 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={() => navigate('/pos')}
            sx={{ borderRadius: 1.5 }}
          >
            New POS Sale
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Month Selector Bar */}
      <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 2, bgcolor: '#ffffff' }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          {/* Month Navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={handlePrevMonth} size="small" sx={{ border: '1px solid #e2e8f0' }}>
              <ChevronLeftIcon />
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 0.5, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
              <CalendarIcon sx={{ color: '#2563eb', fontSize: 20 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, minWidth: 140, textAlign: 'center' }}>
                {filterMode === 'monthly' ? currentMonthLabel : 'All Time Records'}
              </Typography>
            </Box>
            <IconButton onClick={handleNextMonth} size="small" sx={{ border: '1px solid #e2e8f0' }}>
              <ChevronRightIcon />
            </IconButton>
            <Button
              size="small"
              variant="text"
              onClick={handleCurrentMonth}
              sx={{ fontWeight: 600, fontSize: '0.8rem', ml: 0.5 }}
            >
              This Month
            </Button>
          </Box>

          {/* Quick Filter Toggle */}
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>View Range</InputLabel>
              <Select
                value={filterMode}
                label="View Range"
                onChange={(e) => setFilterMode(e.target.value)}
              >
                <MenuItem value="monthly">Selected Month</MenuItem>
                <MenuItem value="all">All Time</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel>Filter Shipping</InputLabel>
              <Select
                value={onlyWithShipping ? 'shipping_only' : 'all_orders'}
                label="Filter Shipping"
                onChange={(e) => setOnlyWithShipping(e.target.value === 'shipping_only')}
              >
                <MenuItem value="shipping_only">With Shipping Rate</MenuItem>
                <MenuItem value="all_orders">All Sales Orders</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Box>
      </Card>

      {/* Summary KPI Cards */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 2 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '18px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#eff6ff', borderRadius: 2, display: 'flex', color: '#2563eb' }}>
                <MoneyIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Total Shipping Charged
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#1d4ed8' }}>
                  {storeSettings.currency} {totalShippingSum.toFixed(2)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 2 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '18px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#ecfdf5', borderRadius: 2, display: 'flex', color: '#059669' }}>
                <ShippingIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Shipped Orders
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#0f172a' }}>
                  {shippedOrdersCount}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 2 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '18px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#fdf2f8', borderRadius: 2, display: 'flex', color: '#db2777' }}>
                <ReceiptIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Average Shipping Rate
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#0f172a' }}>
                  {storeSettings.currency} {avgShippingRate.toFixed(2)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 2 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: '18px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#fef3c7', borderRadius: 2, display: 'flex', color: '#d97706' }}>
                <PeopleIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Customers Shipped To
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#0f172a' }}>
                  {uniqueCustomersCount}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content Area: Tabs for Order Log and Customer Summary */}
      <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 1, bgcolor: '#f8fafc' }}>
          <Tabs
            value={selectedTab}
            onChange={(e, newVal) => setSelectedTab(newVal)}
            sx={{
              minHeight: 44,
              '& .MuiTab-root': {
                fontWeight: 600,
                fontSize: '0.875rem',
                minHeight: 44,
                textTransform: 'none',
              }
            }}
          >
            <Tab
              icon={<ShippingIcon sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label={`Monthly Shippings Log (${filteredSales.length})`}
            />
            <Tab
              icon={<PeopleIcon sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label={`Customer Rates Summary (${customerShippingStats.length})`}
            />
          </Tabs>
        </Box>

        {/* Tab 1: Orders / Receipts List */}
        {selectedTab === 0 && (
          <Box sx={{ p: 0 }}>
            <DataTable
              columns={orderColumns}
              data={filteredSales}
              loading={loading}
              searchPlaceholder="Search customer, phone, receipt #..."
              storageKey="shippings_orders_table"
            />
          </Box>
        )}

        {/* Tab 2: Customer Aggregated Summary */}
        {selectedTab === 1 && (
          <Box sx={{ p: 0 }}>
            <DataTable
              columns={customerColumns}
              data={customerShippingStats}
              loading={loading}
              searchPlaceholder="Search customer name, phone, address..."
              storageKey="shippings_customers_table"
            />
          </Box>
        )}
      </Card>

      {/* View Sale Details Modal */}
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
                Shipping Receipt Details
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

            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2.5 }}>
              {/* Customer / Store Details Box */}
              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1.5, border: '1px solid #f1f5f9' }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block' }}>
                      CUSTOMER
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', mt: 0.25 }}>
                      {activeSale.customer?.name || 'Walk-in Customer'}
                    </Typography>
                    {activeSale.customer?.phone && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Tel: {activeSale.customer.phone}
                      </Typography>
                    )}
                    {activeSale.customer?.address && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Address: {activeSale.customer.address}
                      </Typography>
                    )}
                  </Grid>

                  <Grid item xs={6} sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block' }}>
                      TRANSACTION DATE
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a', mt: 0.25 }}>
                      {dayjs(activeSale.createdAt).format('DD/MM/YYYY')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {dayjs(activeSale.createdAt).format('hh:mm A')}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

              {/* Items Table */}
              <TableContainer component={Paper} sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, boxShadow: 'none' }}>
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
                    {(activeSale.items || []).map((it) => (
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

              {/* Summary Calculation Breakdown */}
              <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, overflow: 'hidden' }}>
                {[
                  { label: 'Subtotal:', value: (activeSale.totalAmount + (activeSale.discount || 0) - (activeSale.tax || 0) - (activeSale.shipping || 0)).toFixed(2) },
                  ...(parseFloat(activeSale.discount || 0) > 0 ? [{ label: 'Discount Given:', value: parseFloat(activeSale.discount).toFixed(2), color: '#dc2626' }] : []),
                  ...(parseFloat(activeSale.tax || 0) > 0 ? [{ label: 'Sales Tax:', value: parseFloat(activeSale.tax).toFixed(2) }] : []),
                  ...(parseFloat(activeSale.shipping || 0) > 0 ? [{ label: 'Shipping Rate Charged:', value: parseFloat(activeSale.shipping).toFixed(2), color: '#0284c7', bold: true }] : []),
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
                      bgcolor: row.label.includes('Shipping') ? '#f0f9ff' : (row.bold ? '#f8fafc' : 'transparent')
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
            </DialogContent>
          </>
        )}
      </Dialog>

    </Box>
  );
};

export default Shippings;
