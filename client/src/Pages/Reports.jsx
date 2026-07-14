import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Grid,
  Divider,
  Paper,
  LinearProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  BarChart as ChartIcon,
  Print as PrintIcon,
  TrendingUp as ProfitIcon,
  ArrowUpward as SalesIcon,
  ArrowDownward as ExpenseIcon,
  ShoppingBag as ProductsIcon
} from '@mui/icons-material';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') ? import.meta.env.VITE_API_URL : window.location.origin);

const Reports = () => {
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currency, setCurrency] = useState('Rs.');
  const [storeName, setStoreName] = useState('BF Makeup');

  const getToken = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return null;
    }
    return token;
  };

  const fetchReportData = async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      if (!token) return;

      // 1. Fetch sales, products, settings, expenses, and categories in parallel from SQLite
      const [salesRes, productsRes, settingsRes, expensesRes, categoriesRes] = await Promise.all([
        fetch(`${API_URL}/api/sales`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/products`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/settings`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/expenses`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/categories`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (salesRes.status === 401 || productsRes.status === 401 || expensesRes.status === 401 || categoriesRes.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const salesData = await salesRes.json();
      const productsData = await productsRes.json();
      const expensesData = await expensesRes.json();
      const categoriesData = await categoriesRes.json();

      setSales(Array.isArray(salesData) ? salesData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setExpenses(Array.isArray(expensesData) ? expensesData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        if (settingsData && settingsData.currency) setCurrency(settingsData.currency);
        if (settingsData && settingsData.storeName) setStoreName(settingsData.storeName);
      }
    } catch (err) {
      setError('Failed to fetch data for report analytics.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  // ── Stats Calculations ─────────────────────────────────────────
  // Gross Sales is the sum of (item.price * item.quantity) before any discounts, filtered by brand if active
  const grossSales = sales.reduce((sum, s) => {
    const itemGross = (s.items || []).reduce((itemSum, item) => {
      const product = products.find(p => p.id === item.productId);
      if (selectedCategory !== 'all' && product?.categoryId !== selectedCategory) {
        return itemSum;
      }
      return itemSum + (item.price * item.quantity);
    }, 0);
    return sum + itemGross;
  }, 0);

  // Total Discounts is the sum of transaction discount (proportional) + item discounts, filtered by brand
  const totalDiscounts = sales.reduce((sum, s) => {
    const saleTotal = (s.items || []).reduce((itemSum, item) => itemSum + item.total, 0) || 1;
    const brandDiscounts = (s.items || []).reduce((itemSum, item) => {
      const product = products.find(p => p.id === item.productId);
      if (selectedCategory !== 'all' && product?.categoryId !== selectedCategory) {
        return itemSum;
      }
      const itemDisc = item.discount || 0;
      const proportion = item.total / saleTotal;
      const shareOfTransDiscount = (s.discount || 0) * proportion;
      return itemSum + itemDisc + shareOfTransDiscount;
    }, 0);

    // If no brand filter is active, we just use the simple sum of transaction discount + all item discounts
    if (selectedCategory === 'all') {
      const itemDiscounts = (s.items || []).reduce((itemSum, item) => itemSum + (item.discount || 0), 0);
      return sum + (s.discount || 0) + itemDiscounts;
    }

    return sum + brandDiscounts;
  }, 0);

  // Total Buying Price is the cost of goods sold (COGS)
  const totalBuyingPrice = sales.reduce((sum, s) => {
    const saleCost = (s.items || []).reduce((itemSum, item) => {
      const product = products.find(p => p.id === item.productId);
      if (selectedCategory !== 'all' && product?.categoryId !== selectedCategory) {
        return itemSum;
      }
      const costPrice = product ? (product.supplierPrice || 0) : 0;
      return itemSum + (costPrice * item.quantity);
    }, 0);
    return sum + saleCost;
  }, 0);

  // Store operating expenses (only show if all brands are selected; for a specific brand, operating expenses are 0)
  const totalExpenses = selectedCategory === 'all' ? expenses.reduce((sum, ex) => sum + ex.amount, 0) : 0;

  // Final Profit = Gross Sales - Total Discounts - Total Buying Price - Total Expenses
  const finalProfit = grossSales - totalDiscounts - totalBuyingPrice - totalExpenses;

  // Calculate Top Selling Products
  const productSalesCount = {};
  sales.forEach(sale => {
    (sale.items || []).forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (selectedCategory !== 'all' && product?.categoryId !== selectedCategory) {
        return; // Skip items from other brands
      }
      const pId = item.productId || item.name;
      productSalesCount[pId] = (productSalesCount[pId] || 0) + item.quantity;
    });
  });

  const topProducts = Object.keys(productSalesCount)
    .map(pId => {
      const product = products.find(p => p.id === pId);
      const name = product ? product.name : pId;
      const stock = product ? product.stock : 0;
      const unit = product ? product.unit : 'pcs';
      return {
        name,
        quantity: productSalesCount[pId],
        stock,
        unit
      };
    })
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Calculate Expense Categories breakdown (expenses are store-wide, so only show when 'all' is selected)
  const expenseCategories = {};
  if (selectedCategory === 'all') {
    expenses.forEach(ex => {
      expenseCategories[ex.category] = (expenseCategories[ex.category] || 0) + ex.amount;
    });
  }

  // Calculate Category Product Share
  const categoryAssets = {};
  products.forEach(p => {
    if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) {
      return; // Skip if a specific category is selected and this is not it
    }
    const catName = p.category?.name || 'Unassigned';
    categoryAssets[catName] = (categoryAssets[catName] || 0) + (p.stock * p.price);
  });

  // ── Print PDF Executive Report ───────────────────────────────
  const handlePrintExecutiveReport = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // Custom Header
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageW, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`${storeName.toUpperCase()} - EXECUTIVE SUMMARY REPORT`, 14, 13);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated on: ${dayjs().format('DD/MM/YYYY hh:mm A')}`, 14, 21);

    // Core Metrics Table
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Financial Performance Summary', 14, 40);

    autoTable(doc, {
      startY: 44,
      head: [['Key Performance Metric', `Value (${currency})`]],
      body: [
        ['Total Gross Sales Revenue', grossSales.toFixed(2)],
        ['Total Sales Discount Granted', totalDiscounts.toFixed(2)],
        ['Total Cost of Goods Sold (Buying Price)', totalBuyingPrice.toFixed(2)],
        ['Total Operating Expenses Paid', totalExpenses.toFixed(2)],
        ['Final Net Profit', finalProfit.toFixed(2)],
      ],
      styles: { fontSize: 10, cellPadding: 4, textColor: [30, 41, 59] },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: 14, right: 14 },
    });

    // Top Selling Items
    const topProdY = doc.lastAutoTable.finalY + 12;
    doc.text('2. Top Selling Products (By Quantity Sold)', 14, topProdY);
    autoTable(doc, {
      startY: topProdY + 4,
      head: [['Product Name', 'Quantity Sold', 'Remaining Stock']],
      body: topProducts.map(p => [
        p.name,
        `${p.quantity} ${p.unit}`,
        `${p.stock} ${p.unit}`
      ]),
      styles: { fontSize: 9, cellPadding: 3.5 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'center', fontStyle: 'bold' }, 2: { halign: 'center' } },
      margin: { left: 14, right: 14 },
    });

    // Operational Expenses Breakdown
    const expY = doc.lastAutoTable.finalY + 12;
    doc.text('3. Operating Expenses Breakdown by Category', 14, expY);
    autoTable(doc, {
      startY: expY + 4,
      head: [['Expense Category', `Total Amount (${currency})`]],
      body: Object.keys(expenseCategories).map(cat => [
        cat,
        expenseCategories[cat].toFixed(2)
      ]),
      styles: { fontSize: 9, cellPadding: 3.5 },
      headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      margin: { left: 14, right: 14 },
    });

    // Footer
    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageH - 15, pageW - 14, pageH - 15);
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('BF Makeup Executive Reports • Internal Management Audit Only', 14, pageH - 10);
    doc.text('Page 1 of 1', pageW - 20, pageH - 10, { align: 'right' });

    doc.save(`Executive_Report_${dayjs().format('YYYYMMDD')}.pdf`);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <LinearProgress sx={{ width: '50%', borderRadius: 1 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', display: 'flex', flexDirection: 'column', gap: 3, fontFamily: '"Inter", sans-serif' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
            Store Performance Reports
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Consolidated operating statistics, top revenue streams, cost structures, and printable audits.
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" sx={{ width: { xs: '100%', md: 'auto' } }}>
          {/* Brand Filter */}
          <FormControl size="small" sx={{ minWidth: 160, width: { xs: '100%', sm: 'auto' } }}>
            <InputLabel id="brand-filter-label">Filter by Brand</InputLabel>
            <Select
              labelId="brand-filter-label"
              value={selectedCategory}
              label="Filter by Brand"
              onChange={(e) => setSelectedCategory(e.target.value)}
              sx={{ bgcolor: '#ffffff', borderRadius: 2 }}
            >
              <MenuItem value="all"><em>All Brands</em></MenuItem>
              {categories.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>
                  {cat.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrintExecutiveReport}
            sx={{ borderRadius: 2, height: 40, width: { xs: '100%', sm: 'auto' } }}
          >
            Executive Summary Report
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Primary KPI Cards */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#2563eb', color: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.9 }}>TOTAL GROSS REVENUE</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 1 }}>
                    {currency} {grossSales.toFixed(2)}
                  </Typography>
                </Box>
                <SalesIcon sx={{ fontSize: 40, opacity: 0.2 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#dc2626', color: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.9 }}>TOTAL STORE EXPENSES</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 1 }}>
                    {currency} {totalExpenses.toFixed(2)}
                  </Typography>
                </Box>
                <ExpenseIcon sx={{ fontSize: 40, opacity: 0.2 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: finalProfit >= 0 ? '#10b981' : '#f97316', color: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.9 }}>FINAL PROFIT</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 1 }}>
                    {currency} {finalProfit.toFixed(2)}
                  </Typography>
                </Box>
                <ProfitIcon sx={{ fontSize: 40, opacity: 0.2 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#7c3aed', color: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.9 }}>DISCOUNTS OFFERED</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 1 }}>
                    {currency} {totalDiscounts.toFixed(2)}
                  </Typography>
                </Box>
                <ProductsIcon sx={{ fontSize: 40, opacity: 0.2 }} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Details analytics grid */}
      <Grid container spacing={3}>
        {/* Top selling products */}
        <Grid item xs={12} md={6}>
          <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
            <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #e2e8f0' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                Top 5 High-Demand Items (Qty Sold)
              </Typography>
            </Box>
            <CardContent sx={{ p: 3 }}>
              {topProducts.length === 0 ? (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                  No checkout transactions found. Start selling in POS Cashier to populate reports.
                </Typography>
              ) : (
                <Stack spacing={2.5}>
                  {topProducts.map((p, idx) => {
                    const maxQty = topProducts[0]?.quantity || 1;
                    const percentage = (p.quantity / maxQty) * 100;
                    return (
                      <Box key={idx}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                            {p.name}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#2563eb' }}>
                            {p.quantity} {p.unit} sold
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={percentage}
                          sx={{ height: 6, borderRadius: 3, bgcolor: '#f1f5f9', '& .MuiLinearProgress-bar': { bgcolor: '#2563eb' } }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                          Remaining Stock: {p.stock} {p.unit}
                        </Typography>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Operating cost allocations */}
        <Grid item xs={12} md={6}>
          <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, height: '100%' }}>
            <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #e2e8f0' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                Operational Expenses Breakdown
              </Typography>
            </Box>
            <CardContent sx={{ p: 3 }}>
              {selectedCategory !== 'all' ? (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4, fontStyle: 'italic' }}>
                  Operating expenses are store-wide and are only shown when "All Brands" is selected.
                </Typography>
              ) : Object.keys(expenseCategories).length === 0 ? (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                  No store expenses recorded yet. Go to Expenses to record cost drivers.
                </Typography>
              ) : (
                <Stack spacing={2.5}>
                  {Object.keys(expenseCategories).map((cat, idx) => {
                    const totalEx = totalExpenses || 1;
                    const percentage = (expenseCategories[cat] / totalEx) * 100;
                    return (
                      <Box key={idx}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                            {cat}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#dc2626' }}>
                            {currency} {expenseCategories[cat].toFixed(2)} ({percentage.toFixed(0)}%)
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={percentage}
                          sx={{ height: 6, borderRadius: 3, bgcolor: '#f1f5f9', '& .MuiLinearProgress-bar': { bgcolor: '#dc2626' } }}
                        />
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Stock value distribution */}
        <Grid item xs={12}>
          <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
            <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #e2e8f0' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                Tied-Up Capital Valuation by Brand
              </Typography>
            </Box>
            <CardContent sx={{ p: 3 }}>
              {Object.keys(categoryAssets).length === 0 ? (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                  No stock items or brands registered.
                </Typography>
              ) : (
                <Grid container spacing={3}>
                  {Object.keys(categoryAssets).map((catName, idx) => (
                    <Grid item xs={12} sm={6} md={4} key={idx}>
                      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                          {catName}
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5, color: '#0f172a' }}>
                          {currency} {categoryAssets[catName].toFixed(2)}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Reports;
