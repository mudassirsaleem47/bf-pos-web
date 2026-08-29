import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Tabs,
  Tab
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import {
  AttachMoney as MoneyIcon,
  ShoppingCart as CartIcon,
  Description as InvoiceIcon,
  Settings as SettingsIcon,
  People as PeopleIcon,
  BarChart as BarChartIcon,
  TrendingUp as TrendingIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Inventory as InventoryIcon,
  Category as CategoryIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5000'
  : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost')
    ? import.meta.env.VITE_API_URL
    : window.location.origin);

const DashboardOverview = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data States
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierInvoices, setSupplierInvoices] = useState([]);
  const [loans, setLoans] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [currency, setCurrency] = useState('Rs.');

  // Date Filter States (Persisted)
  const [selectedYear, setSelectedYear] = useState(() => {
    const y = sessionStorage.getItem('dashboard_year');
    return y ? parseInt(y, 10) : dayjs().year();
  });
  const [selectedMonth, setSelectedMonth] = useState(() => sessionStorage.getItem('dashboard_month') || 'all');
  const [dateFilter, setDateFilter] = useState(() => sessionStorage.getItem('dashboard_date_filter') || 'bymonth');
  const [customStartDate, setCustomStartDate] = useState(dayjs().subtract(30, 'day'));
  const [customEndDate, setCustomEndDate] = useState(dayjs());
  const [chartTab, setChartTab] = useState(() => sessionStorage.getItem('dashboard_chart_tab') || 'bymonth');

  useEffect(() => {
    sessionStorage.setItem('dashboard_year', selectedYear.toString());
  }, [selectedYear]);

  useEffect(() => {
    sessionStorage.setItem('dashboard_month', selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    sessionStorage.setItem('dashboard_date_filter', dateFilter);
  }, [dateFilter]);

  useEffect(() => {
    sessionStorage.setItem('dashboard_chart_tab', chartTab);
  }, [chartTab]);

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const FULL_MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Get start and end date based on dateFilter selection
  const getFilterDateRange = () => {
    const now = dayjs();
    let start = null;
    let end = now.endOf('day');

    switch (dateFilter) {
      case 'bymonth':
        if (selectedMonth === 'all') {
          start = dayjs().year(selectedYear).startOf('year');
          end = dayjs().year(selectedYear).endOf('year');
        } else {
          const m = parseInt(selectedMonth, 10);
          start = dayjs().year(selectedYear).month(m).startOf('month');
          end = dayjs().year(selectedYear).month(m).endOf('month');
        }
        break;
      case 'today':
        start = now.startOf('day');
        end = now.endOf('day');
        break;
      case 'yesterday':
        start = now.subtract(1, 'day').startOf('day');
        end = now.subtract(1, 'day').endOf('day');
        break;
      case 'thisweek':
        start = now.startOf('week');
        end = now.endOf('week');
        break;
      case 'thismonth':
        start = now.startOf('month');
        end = now.endOf('month');
        break;
      case '30days':
        start = now.subtract(30, 'day').startOf('day');
        break;
      case '365days':
        start = now.subtract(365, 'day').startOf('day');
        break;
      case 'custom':
        start = customStartDate ? dayjs(customStartDate).startOf('day') : null;
        end = customEndDate ? dayjs(customEndDate).endOf('day') : null;
        break;
      case 'all':
      default:
        start = null;
        end = null;
        break;
    }
    return { start, end };
  };

  const filterByDate = (dateVal) => {
    if (!dateVal) return false;
    const { start, end } = getFilterDateRange();
    const d = dayjs(dateVal);
    if (start && d.isBefore(start)) return false;
    if (end && d.isAfter(end)) return false;
    return true;
  };

  const handleSelectMonth = (monthIdx) => {
    setDateFilter('bymonth');
    setSelectedMonth(monthIdx === 'all' ? 'all' : String(monthIdx));
  };

  // Filtered Datasets
  const filteredSales = sales.filter(s => filterByDate(s.createdAt));
  const filteredSupplierInvoices = supplierInvoices.filter(s => filterByDate(s.date || s.createdAt));
  const filteredLoans = loans.filter(l => filterByDate(l.createdAt));
  const filteredCustomers = customers.filter(c => filterByDate(c.createdAt));
  const filteredExpenses = expenses.filter(e => filterByDate(e.date || e.createdAt));

  // Get aggregated sales data for the chart based on selected tab
  const getChartData = () => {
    const now = dayjs();
    const chartData = [];

    if (chartTab === 'bymonth') {
      // 12 months for selectedYear
      for (let m = 0; m < 12; m++) {
        const mStart = dayjs().year(selectedYear).month(m).startOf('month');
        const mEnd = dayjs().year(selectedYear).month(m).endOf('month');
        const monthSales = sales.filter(s => {
          const d = dayjs(s.createdAt);
          return d.isAfter(mStart.subtract(1, 'second')) && d.isBefore(mEnd.add(1, 'second'));
        });
        const total = monthSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
        chartData.push({
          label: MONTH_NAMES[m],
          fullLabel: `${FULL_MONTH_NAMES[m]} ${selectedYear}`,
          monthIndex: m,
          amount: total,
          count: monthSales.length,
          isSelected: selectedMonth !== 'all' && parseInt(selectedMonth, 10) === m
        });
      }
    } else if (chartTab === 'daily') {
      const targetM = selectedMonth !== 'all' ? parseInt(selectedMonth, 10) : now.month();
      const daysInMonth = dayjs().year(selectedYear).month(targetM).daysInMonth();
      for (let d = 1; d <= daysInMonth; d++) {
        const dayDate = dayjs().year(selectedYear).month(targetM).date(d);
        const daySales = sales.filter(s => dayjs(s.createdAt).isSame(dayDate, 'day'));
        const total = daySales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
        chartData.push({
          label: `${d}`,
          fullLabel: dayDate.format('DD MMM YYYY'),
          amount: total,
          count: daySales.length
        });
      }
    } else if (chartTab === 'today') {
      // Group by hours (last 6 2-hour intervals ending now)
      for (let i = 5; i >= 0; i--) {
        const targetHour = now.subtract(i * 2, 'hour');
        const label = targetHour.format('hh A');
        const windowStart = targetHour.subtract(2, 'hour').add(1, 'second');
        const windowEnd = targetHour;
        const salesInWindow = sales.filter(s => {
          const saleTime = dayjs(s.createdAt);
          return saleTime.isAfter(windowStart.subtract(1, 'second')) && saleTime.isBefore(windowEnd.add(1, 'second'));
        });
        const total = salesInWindow.reduce((sum, s) => sum + s.totalAmount, 0);
        chartData.push({ label, amount: total, count: salesInWindow.length });
      }
    } else if (chartTab === '1week') {
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = now.subtract(i, 'day');
        const label = date.format('ddd'); // Mon, Tue, etc.
        const salesOnDate = sales.filter(s => dayjs(s.createdAt).isSame(date, 'day'));
        const total = salesOnDate.reduce((sum, s) => sum + s.totalAmount, 0);
        chartData.push({ label, amount: total, count: salesOnDate.length });
      }
    }
    return chartData;
  };

  const renderSalesChart = () => {
    const data = getChartData();
    const maxAmount = Math.max(...data.map(d => d.amount), 100);

    // SVG Dimensions
    const svgWidth = 650;
    const svgHeight = 220;
    const paddingLeft = 55;
    const paddingRight = 15;
    const paddingTop = 20;
    const paddingBottom = 40;

    const chartWidth = svgWidth - paddingLeft - paddingRight;
    const chartHeight = svgHeight - paddingTop - paddingBottom;

    const barWidth = Math.min((chartWidth / data.length) * 0.65, 32);
    const barSpacing = chartWidth / data.length;

    // Y Axis ticks (4 ticks: 0%, 33%, 66%, 100%)
    const yTicks = [0, 0.33, 0.66, 1];

    return (
      <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box sx={{ width: '100%', height: svgHeight, display: 'flex', justifyContent: 'center' }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="barGradientNormal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.5" />
              </linearGradient>
              <linearGradient id="barGradientSelected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#f59e0b" floodOpacity="0.5"/>
              </filter>
            </defs>

            {/* Grid lines & Y Labels */}
            {yTicks.map((tick, idx) => {
              const y = paddingTop + chartHeight * (1 - tick);
              const val = (maxAmount * tick).toFixed(0);
              return (
                <g key={idx}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={svgWidth - paddingRight}
                    y2={y}
                    stroke="#e2e8f0"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={paddingLeft - 10}
                    y={y + 4}
                    fill="#94a3b8"
                    fontSize="10"
                    textAnchor="end"
                    fontWeight="600"
                  >
                    {currency}{val}
                  </text>
                </g>
              );
            })}

            {/* Bars */}
            {data.map((item, idx) => {
              const barHeight = (item.amount / maxAmount) * chartHeight;
              const x = paddingLeft + (idx * barSpacing) + (barSpacing - barWidth) / 2;
              const y = paddingTop + chartHeight - barHeight;
              const isSelected = item.isSelected;
              const isClickable = item.monthIndex !== undefined;

              return (
                <g
                  key={idx}
                  style={{ cursor: isClickable ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (isClickable) {
                      handleSelectMonth(item.monthIndex);
                    }
                  }}
                >
                  <title>{`${item.fullLabel || item.label}: ${currency}${item.amount.toFixed(2)} (${item.count || 0} sales)`}</title>
                  {/* Bar */}
                  <rect
                    x={x}
                    y={Math.min(y, paddingTop + chartHeight - 2)}
                    width={barWidth}
                    height={Math.max(barHeight, 2)}
                    rx="3"
                    fill={isSelected ? 'url(#barGradientSelected)' : 'url(#barGradientNormal)'}
                    filter={isSelected ? 'url(#glow)' : 'none'}
                    stroke={isSelected ? '#b45309' : 'none'}
                    strokeWidth={isSelected ? 1.5 : 0}
                    style={{ transition: 'all 0.25s ease' }}
                  />

                  {/* Value on top of bar */}
                  {item.amount > 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={y - 6}
                      fill={isSelected ? '#b45309' : '#1e293b'}
                      fontSize="9"
                      fontWeight={isSelected ? '800' : '700'}
                      textAnchor="middle"
                    >
                      {item.amount >= 1000 ? `${(item.amount / 1000).toFixed(1)}k` : item.amount.toFixed(0)}
                    </text>
                  )}

                  {/* X Axis Label */}
                  <text
                    x={x + barWidth / 2}
                    y={paddingTop + chartHeight + 18}
                    fill={isSelected ? '#b45309' : '#64748b'}
                    fontSize={isSelected ? '11' : '10'}
                    fontWeight={isSelected ? '800' : '600'}
                    textAnchor="middle"
                  >
                    {item.label}
                  </text>
                </g>
              );
            })}

            {/* X Axis Line */}
            <line
              x1={paddingLeft}
              y1={paddingTop + chartHeight}
              x2={svgWidth - paddingRight}
              y2={paddingTop + chartHeight}
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />
          </svg>
        </Box>
        {chartTab === 'bymonth' && (
          <Typography variant="caption" sx={{ color: '#64748b', mt: 0.5, fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            💡 <strong>Interactive Chart:</strong> Click any month bar (Jan - Dec) to instantly view that month's full analytics.
          </Typography>
        )}
      </Box>
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

  const fetchData = async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setIsRefreshing(true);
    setError('');

    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch dashboard metrics');

      setProducts(Array.isArray(data.products) ? data.products : []);
      setSales(Array.isArray(data.sales) ? data.sales : []);
      setCategories(Array.isArray(data.categories) ? data.categories : []);
      setSuppliers(Array.isArray(data.suppliers) ? data.suppliers : []);
      setSupplierInvoices(Array.isArray(data.supplierInvoices) ? data.supplierInvoices : []);
      setLoans(Array.isArray(data.loans) ? data.loans : []);
      setCustomers(Array.isArray(data.customers) ? data.customers : []);
      setExpenses(Array.isArray(data.expenses) ? data.expenses : []);

      if (data.settings && data.settings.currency) {
        setCurrency(data.settings.currency);
      }
    } catch (err) {
      setError('Failed to fetch dashboard overview metrics.');
      console.error(err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefreshClick = () => {
    fetchData(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress thickness={4} size={50} />
      </Box>
    );
  }

  // Sales & Collections
  const totalSalesRevenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalReceivedAmount = filteredSales.reduce((sum, s) => sum + s.paidAmount, 0);
  const totalDiscountGiven = filteredSales.reduce((sum, s) => sum + s.discount, 0);

  // Integrated Receivables (Customer Credit + Manual Receivables)
  const customerReceivables = customers.reduce((sum, c) => sum + (c.balance || 0), 0);
  const manualReceivables = filteredLoans.filter(l => l.type === 'Receivable' && l.status !== 'Paid').reduce((sum, l) => sum + l.amount, 0);
  const totalReceivables = customerReceivables + manualReceivables;

  // Integrated Payables (Supplier Invoice Dues + Manual Payables)
  const supplierPayables = supplierInvoices.reduce((sum, inv) => sum + (inv.due || 0), 0);
  const manualPayables = filteredLoans.filter(l => l.type === 'Payable' && l.status !== 'Paid').reduce((sum, l) => sum + l.amount, 0);
  const totalPayables = supplierPayables + manualPayables;

  // Expenses Calculations
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Small Cards Calculations
  const totalInvoiceCount = filteredSales.length;

  // Count of sold product types
  const soldProductTypesSet = new Set();
  filteredSales.forEach(sale => {
    if (sale.items && Array.isArray(sale.items)) {
      sale.items.forEach(item => {
        if (item.productId) soldProductTypesSet.add(item.productId);
        else if (item.name) soldProductTypesSet.add(item.name);
      });
    }
  });
  const soldProductTypesCount = soldProductTypesSet.size;

  const totalSoldQtyCount = filteredSales.reduce((sum, s) => {
    const qty = s.items ? s.items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) : 0;
    return sum + qty;
  }, 0);

  const totalCustomerCount = filteredCustomers.length;
  const totalSupplierCount = suppliers.length;
  const totalItemsInStockCount = products.filter(p => p.stock > 0).length;
  const totalCategoriesCount = categories.length;



  const quickActions = [
    { label: 'Finance', path: '/receivables-payables', icon: <MoneyIcon sx={{ fontSize: 24 }} /> },
    { label: 'Add Products', path: '/products/add', icon: <CartIcon sx={{ fontSize: 24 }} /> },
    { label: 'Add Invoice', path: '/pos', icon: <InvoiceIcon sx={{ fontSize: 24 }} /> },
    { label: 'Company Info', path: '/setting', icon: <SettingsIcon sx={{ fontSize: 24 }} /> }
  ];

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', pb: 4 }}>
      {error && <Alert severity="error" sx={{ borderRadius: 2, mb: 3 }}>{error}</Alert>}

      {/* 1. Top Quick Action Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {quickActions.map((action, idx) => (
          <Grid size={{ xs: 6, md: 3 }} key={idx}>
            <Card
              component={Link}
              to={action.path}
              sx={{
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 2.5,
                bgcolor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  borderColor: '#3b82f6',
                  '& .action-icon-box': {
                    color: '#2563eb'
                  }
                }
              }}
            >
              <Box
                className="action-icon-box"
                sx={{
                  color: '#2563eb',
                  mb: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {action.icon}
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569', fontSize: '0.85rem' }}>
                {action.label}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 2. Date Filter Toolbar */}
      <Card
        sx={{
          p: 2,
          mb: 3,
          bgcolor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}
      >
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <Grid container spacing={2} alignItems="center" justifyContent="space-between">
            <Grid size={{ xs: 12, md: 5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem', tracking: '0.5px', textTransform: 'uppercase' }}>
                  {dateFilter === 'bymonth' && (selectedMonth === 'all' ? `Yearly Overview (${selectedYear})` : `${FULL_MONTH_NAMES[parseInt(selectedMonth, 10)]} ${selectedYear} Report`)}
                  {dateFilter === 'today' && "Today's Report Overview"}
                  {dateFilter === 'yesterday' && "Yesterday's Report Overview"}
                  {dateFilter === 'thisweek' && "This Week's Report Overview"}
                  {dateFilter === 'thismonth' && "This Month's Report Overview"}
                  {dateFilter === '30days' && "Last 30 Days Report Overview"}
                  {dateFilter === '365days' && "Last 365 Days Report Overview"}
                  {dateFilter === 'all' && "All Time Report Overview"}
                  {dateFilter === 'custom' && `Report: ${customStartDate ? customStartDate.format('DD/MM/YYYY') : '...'} to ${customEndDate ? customEndDate.format('DD/MM/YYYY') : '...'}`}
                </Typography>

                {dateFilter === 'bymonth' && selectedMonth !== 'all' && (
                  <Chip
                    label="View Full Year"
                    size="small"
                    color="primary"
                    variant="outlined"
                    onClick={() => setSelectedMonth('all')}
                    sx={{ fontSize: '0.72rem', height: 22, cursor: 'pointer', fontWeight: 600 }}
                  />
                )}
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }} sx={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                justifyContent="flex-end"
                alignItems="center"
                sx={{ width: '100%' }}
              >
                {dateFilter === 'bymonth' && (
                  <FormControl size="small" sx={{ minWidth: 100 }}>
                    <InputLabel id="year-select-label">Year</InputLabel>
                    <Select
                      labelId="year-select-label"
                      value={selectedYear}
                      label="Year"
                      onChange={(e) => setSelectedYear(e.target.value)}
                    >
                      {[2023, 2024, 2025, 2026, 2027, 2028].map(yr => (
                        <MenuItem key={yr} value={yr}>{yr}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <FormControl size="small" sx={{ minWidth: 170, width: { xs: '100%', sm: 'auto' } }}>
                  <InputLabel id="date-filter-label">Period</InputLabel>
                  <Select
                    labelId="date-filter-label"
                    value={dateFilter}
                    label="Period"
                    onChange={(e) => setDateFilter(e.target.value)}
                  >
                    <MenuItem value="bymonth">By Month (Meta Suite)</MenuItem>
                    <MenuItem value="today">Today</MenuItem>
                    <MenuItem value="yesterday">Yesterday</MenuItem>
                    <MenuItem value="thisweek">This Week</MenuItem>
                    <MenuItem value="thismonth">This Month</MenuItem>
                    <MenuItem value="30days">Last 30 Days</MenuItem>
                    <MenuItem value="365days">Last 365 Days</MenuItem>
                    <MenuItem value="all">All Time</MenuItem>
                    <MenuItem value="custom">Custom Range</MenuItem>
                  </Select>
                </FormControl>

                {dateFilter === 'custom' && (
                  <>
                    <DatePicker
                      label="Start Date"
                      value={customStartDate}
                      onChange={(newValue) => setCustomStartDate(newValue)}
                      slotProps={{ textField: { size: 'small', sx: { width: { xs: '100%', sm: 150 } } } }}
                    />
                    <DatePicker
                      label="End Date"
                      value={customEndDate}
                      onChange={(newValue) => setCustomEndDate(newValue)}
                      slotProps={{ textField: { size: 'small', sx: { width: { xs: '100%', sm: 150 } } } }}
                    />
                  </>
                )}

                <IconButton
                  onClick={handleRefreshClick}
                  size="small"
                  sx={{
                    color: '#475569',
                    bgcolor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    '&:hover': { bgcolor: '#f8fafc' },
                    alignSelf: { xs: 'flex-end', sm: 'auto' }
                  }}
                >
                  <RefreshIcon
                    sx={{
                      fontSize: 16,
                      animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                      '@keyframes spin': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' }
                      }
                    }}
                  />
                </IconButton>
              </Stack>
            </Grid>
          </Grid>

          {/* Meta Suite Style Month Selector Ribbon */}
          {dateFilter === 'bymonth' && (
            <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', mr: 0.5, fontSize: '0.75rem' }}>
                Select Month:
              </Typography>
              <Chip
                label="All Months"
                size="small"
                onClick={() => setSelectedMonth('all')}
                variant={selectedMonth === 'all' ? 'filled' : 'outlined'}
                color={selectedMonth === 'all' ? 'primary' : 'default'}
                sx={{ fontWeight: selectedMonth === 'all' ? 700 : 500, fontSize: '0.75rem', cursor: 'pointer' }}
              />
              {MONTH_NAMES.map((mName, mIdx) => {
                const isSelected = selectedMonth !== 'all' && parseInt(selectedMonth, 10) === mIdx;
                return (
                  <Chip
                    key={mName}
                    label={mName}
                    size="small"
                    onClick={() => setSelectedMonth(String(mIdx))}
                    variant={isSelected ? 'filled' : 'outlined'}
                    color={isSelected ? 'primary' : 'default'}
                    sx={{
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      bgcolor: isSelected ? '#2563eb' : undefined,
                      color: isSelected ? '#ffffff' : undefined,
                      '&:hover': { bgcolor: isSelected ? '#1d4ed8' : '#f1f5f9' }
                    }}
                  />
                );
              })}
            </Box>
          )}
        </LocalizationProvider>
      </Card>

      {/* 3. Four Big Colored Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* TOTAL SALES (Green) */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              background: '#4caf50',
              color: '#ffffff',
              borderRadius: '6px',
              border: 'none',
              position: 'relative',
              overflow: 'hidden',
              height: 115,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              pl: 3
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 800, fontSize: '1.65rem' }}>
              {currency}{totalSalesRevenue.toFixed(0)}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.8)', mt: 0.5, letterSpacing: '0.5px', fontSize: '0.72rem' }}>
              TOTAL SALES
            </Typography>
            <TrendingIcon
              sx={{
                position: 'absolute',
                bottom: -15,
                right: -10,
                fontSize: '6.5rem',
                color: 'rgba(255, 255, 255, 0.08)'
              }}
            />
          </Card>
        </Grid>

        {/* CASH RECEIVED (Blue) */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              background: '#2196f3',
              color: '#ffffff',
              borderRadius: '6px',
              border: 'none',
              position: 'relative',
              overflow: 'hidden',
              height: 115,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              pl: 3
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 800, fontSize: '1.65rem' }}>
              {currency}{totalReceivedAmount.toFixed(0)}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.8)', mt: 0.5, letterSpacing: '0.5px', fontSize: '0.72rem' }}>
              CASH RECEIVED
            </Typography>
            <MoneyIcon
              sx={{
                position: 'absolute',
                bottom: -15,
                right: -10,
                fontSize: '6.5rem',
                color: 'rgba(255, 255, 255, 0.08)'
              }}
            />
          </Card>
        </Grid>

        {/* TOTAL RECEIVABLES (Orange) */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              background: '#ff9800',
              color: '#ffffff',
              borderRadius: '6px',
              border: 'none',
              position: 'relative',
              overflow: 'hidden',
              height: 115,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              pl: 3
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 800, fontSize: '1.65rem' }}>
              {currency}{totalReceivables.toFixed(0)}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.8)', mt: 0.5, letterSpacing: '0.5px', fontSize: '0.72rem' }}>
              TOTAL RECEIVABLES
            </Typography>
            <CartIcon
              sx={{
                position: 'absolute',
                bottom: -15,
                right: -10,
                fontSize: '6.5rem',
                color: 'rgba(255, 255, 255, 0.08)'
              }}
            />
          </Card>
        </Grid>

        {/* TOTAL PAYABLES (Red) */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              background: '#f44336',
              color: '#ffffff',
              borderRadius: '6px',
              border: 'none',
              position: 'relative',
              overflow: 'hidden',
              height: 115,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              pl: 3
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 800, fontSize: '1.65rem' }}>
              {currency}{totalPayables.toFixed(0)}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.8)', mt: 0.5, letterSpacing: '0.5px', fontSize: '0.72rem' }}>
              TOTAL PAYABLES
            </Typography>
            <BarChartIcon
              sx={{
                position: 'absolute',
                bottom: -15,
                right: -10,
                fontSize: '6.5rem',
                color: 'rgba(255, 255, 255, 0.08)'
              }}
            />
          </Card>
        </Grid>
      </Grid>

      {/* 4. Eight Smaller Metric Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'TOTAL INVOICE', value: totalInvoiceCount, icon: <InvoiceIcon sx={{ fontSize: 20 }} />, color: '#ef5350', bg: '#fef2f2' },
          { label: 'TOTAL EXPENSES', value: `${currency}${totalExpenses.toFixed(0)}`, icon: <MoneyIcon sx={{ fontSize: 20 }} />, color: '#ef5350', bg: '#fef2f2' },
          { label: 'SOLD PRODUCTS TYPES', value: soldProductTypesCount, icon: <CartIcon sx={{ fontSize: 20 }} />, color: '#42a5f5', bg: '#eff6ff' },
          { label: 'TOTAL SOLD PRO. QTY', value: totalSoldQtyCount, icon: <CartIcon sx={{ fontSize: 20 }} />, color: '#ffa726', bg: '#fff7ed' },
          { label: 'TOTAL CUSTOMER', value: totalCustomerCount, icon: <PeopleIcon sx={{ fontSize: 20 }} />, color: '#66bb6a', bg: '#ecfdf5' },
          { label: 'TOTAL SUPPLIER', value: totalSupplierCount, icon: <PeopleIcon sx={{ fontSize: 20 }} />, color: '#66bb6a', bg: '#ecfdf5' },
          { label: 'TOTAL ITEMS IN STOCK', value: totalItemsInStockCount, icon: <CartIcon sx={{ fontSize: 20 }} />, color: '#42a5f5', bg: '#eff6ff' },
          { label: 'TOTAL ITEM CATEGORIES', value: totalCategoriesCount, icon: <CartIcon sx={{ fontSize: 20 }} />, color: '#ffa726', bg: '#fff7ed' },
        ].map((card, idx) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={idx}>
            <Card
              sx={{
                bgcolor: '#ffffff',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                p: 2,
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: 70
              }}
            >
              <Box
                sx={{
                  bgcolor: card.bg,
                  color: card.color,
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {card.icon}
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 650, fontSize: '0.66rem', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                  {card.label}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mt: 0.25, fontSize: '1.25rem' }}>
                  {card.value}
                </Typography>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 5. Bottom Section: Sales Chart & Recent Invoices */}
      <Grid container spacing={3}>
        {/* Left Column: Sales Chart with Tabs */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card
            sx={{
              bgcolor: '#ffffff',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              p: 2.5,
              display: 'flex',
              flexDirection: 'column',
              height: 400
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', fontSize: '0.85rem' }}>
                  Sales Performance ({selectedYear})
                </Typography>
                {selectedMonth !== 'all' && (
                  <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 600 }}>
                    Selected: {FULL_MONTH_NAMES[parseInt(selectedMonth, 10)]}
                  </Typography>
                )}
              </Box>

              <Tabs
                value={chartTab}
                onChange={(e, newValue) => setChartTab(newValue)}
                textColor="primary"
                indicatorColor="primary"
                sx={{
                  minHeight: 28,
                  '& .MuiTab-root': {
                    minHeight: 28,
                    py: 0.5,
                    px: 1.25,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'none'
                  }
                }}
              >
                <Tab label="By Month (Jan-Dec)" value="bymonth" />
                <Tab label="Daily" value="daily" />
                <Tab label="1 Week" value="1week" />
                <Tab label="Today" value="today" />
              </Tabs>
            </Box>

            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1 }}>
              {renderSalesChart()}
            </Box>
          </Card>
        </Grid>

        {/* Right Column: Recent Invoices Table */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card
            sx={{
              bgcolor: '#ffffff',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              p: 2.5,
              height: 400,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', fontSize: '0.85rem' }}>
                Recent Supplier Invoices
              </Typography>
              <Stack direction="row" spacing={0.5}>
                <IconButton size="small" sx={{ color: '#94a3b8' }} onClick={() => fetchData(true)}>
                  <RefreshIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Stack>
            </Box>

            <TableContainer sx={{ flexGrow: 1, overflowY: 'auto' }}>
              <Table size="small" sx={{ '& td, & th': { borderBottom: '1px solid #f1f5f9', py: 1.2 } }}>
                <TableBody>
                  {filteredSupplierInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6, color: '#94a3b8' }}>
                        No supplier invoices recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSupplierInvoices.slice(0, 9).map((inv, idx) => (
                      <TableRow key={inv.id} hover>
                        <TableCell sx={{ color: '#64748b', fontWeight: 600, width: 40 }}>
                          {idx + 1}
                        </TableCell>
                        <TableCell sx={{ color: '#334155', fontWeight: 500 }}>
                          {inv.supplier?.name || 'N/A'}
                        </TableCell>
                        <TableCell sx={{ width: 120 }}>
                          <Link
                            to="/suppliers-invoice"
                            style={{
                              color: '#2563eb',
                              textDecoration: 'underline',
                              fontWeight: 600,
                              fontSize: '0.85rem'
                            }}
                          >
                            {inv.invoiceNo}
                          </Link>
                        </TableCell>
                        <TableCell sx={{ color: '#334155', fontWeight: 600, fontSize: '0.85rem' }}>
                          {currency}{inv.grandTotal.toFixed(0)}
                        </TableCell>
                        <TableCell align="right" sx={{ width: 100 }}>
                          <Chip
                            label={inv.due > 0 ? 'Unpaid' : 'Paid'}
                            size="small"
                            sx={{
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              bgcolor: inv.due > 0 ? '#ef4444' : '#4caf50',
                              color: '#ffffff',
                              borderRadius: '3px',
                              height: 18,
                              px: 0.5,
                              '& .MuiChip-label': { px: 1 }
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>
      </Grid>
    </Box >
  );
};

export default DashboardOverview;
