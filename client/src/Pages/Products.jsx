import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Box,
  Typography,
  Card,
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
  Paper,
  TextField,
  InputLabel,
  Chip
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
  Upload as UploadIcon,
  Inventory as InventoryIcon,
  Warning as WarningIcon,
  AttachMoney as MoneyIcon,
  BarChart as BarChartIcon
} from '@mui/icons-material';
import DataTable from '../Components/DataTable';
import Barcode from 'react-barcode';
import dayjs from 'dayjs';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') ? import.meta.env.VITE_API_URL : window.location.origin);

const Products = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || '';

  const [products, setProducts] = useState([]);
  const [currency, setCurrency] = useState('Rs.');
  const [dateFilter, setDateFilter] = useState(() => sessionStorage.getItem('products_date_filter') || 'all');
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deleteIds, setDeleteIds] = useState([]);
  const [showLowStockOnly, setShowLowStockOnly] = useState(() => sessionStorage.getItem('products_lowstock_filter') === 'true');

  // Brand (Category) States
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(() => sessionStorage.getItem('products_brand_filter') || 'all');

  useEffect(() => {
    sessionStorage.setItem('products_brand_filter', selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    sessionStorage.setItem('products_lowstock_filter', showLowStockOnly.toString());
  }, [showLowStockOnly]);

  useEffect(() => {
    sessionStorage.setItem('products_date_filter', dateFilter);
  }, [dateFilter]);

  // Printable Barcode Dialog
  const [openBarcodeDialog, setOpenBarcodeDialog] = useState(false);
  const [barcodeToPrint, setBarcodeToPrint] = useState('');
  const [productNameToPrint, setProductNameToPrint] = useState('');


  // View Product Dialog States
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [viewProduct, setViewProduct] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const handleViewClick = async (product) => {
    setDateFilter('all');
    setCustomStartDate(null);
    setCustomEndDate(null);
    setViewProduct(product);
    setOpenViewDialog(true);
    setViewLoading(true);
    try {
      const token = getToken();
      if (!token) return;
      const response = await fetch(`${API_URL}/api/products/${product.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setViewProduct(data);
      }
    } catch (err) {
      console.error('Failed to fetch full product details:', err);
    } finally {
      setViewLoading(false);
    }
  };

  const handlePrintStickerFromView = (prod) => {
    if (!prod) return;
    const printWindow = window.open('', '_blank', 'width=500,height=400');
    if (!printWindow) {
      alert("Please allow popups to print barcode stickers.");
      return;
    }
    const barcodeHtml = document.getElementById('view-dialog-barcode-svg').outerHTML;
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Barcode Sticker</title>
          <style>
            @media print {
              @page {
                size: 50mm 30mm;
                margin: 0;
              }
              html, body {
                width: 50mm;
                height: 30mm;
                margin: 0;
                padding: 0;
                background-color: #fff;
                -webkit-print-color-adjust: exact;
              }
            }
            body {
              margin: 0;
              padding: 1.5mm;
              width: 50mm;
              height: 30mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              font-family: 'Inter', -apple-system, sans-serif;
              overflow: hidden;
              text-align: center;
            }
            .product-name {
              font-size: 9px;
              font-weight: 700;
              color: #000;
              margin: 1px 0;
              line-height: 1.2;
              max-height: 22px;
              overflow: hidden;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              width: 100%;
            }
            .barcode-container {
              display: flex;
              justify-content: center;
              align-items: center;
              width: 100%;
              height: 12mm;
            }
            .barcode-container svg {
              width: 100%;
              height: 100%;
              max-height: 12mm;
            }
            .barcode-value {
              font-family: monospace;
              font-size: 9px;
              font-weight: 700;
              margin-top: 1px;
              letter-spacing: 1px;
              color: #000;
            }
          </style>
        </head>
        <body>
          <div class="product-name">${prod.name}</div>
          <div class="barcode-container">
            ${barcodeHtml}
          </div>
          <div class="barcode-value">${prod.barcode}</div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // CSV Import States
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [columnMapping, setColumnMapping] = useState({
    name: '',
    price: '',
    barcode: '',
    stock: '',
    unit: '',
    lowStockAlert: '',
    supplierPrice: '',
    model: '',
    detail: '',
    mfgDate: '',
    expiryDate: '',
  });
  const [importLoading, setImportLoading] = useState(false);
  const [importSummary, setImportSummary] = useState(null);

  const databaseFields = [
    { key: 'name', label: 'Product Name', required: true, matches: /name|product|item|title/i },
    { key: 'price', label: 'Sell Price', required: false, matches: /price|sell|retail|rate/i },
    { key: 'barcode', label: 'SKU / Barcode', required: false, matches: /barcode|sku|code|serial/i },
    { key: 'stock', label: 'Quantity / Stock', required: false, matches: /stock|quantity|qty|count|amt/i },
    { key: 'unit', label: 'Unit', required: false, matches: /unit|pack/i },
    { key: 'lowStockAlert', label: 'Low Stock Alert', required: false, matches: /alert|low|minimum/i },
    { key: 'supplierPrice', label: 'Supplier Price', required: false, matches: /cost|supplier|purchase|buy/i },
    { key: 'model', label: 'Model', required: false, matches: /model|type/i },
    { key: 'detail', label: 'Detail / Description', required: false, matches: /detail|description|desc/i },
    { key: 'mfgDate', label: 'Mfg. Date', required: false, matches: /mfg|manufacture/i },
    { key: 'expiryDate', label: 'Exp. Date', required: false, matches: /exp|expiry/i },
  ];

  const parseCSV = (text) => {
    const lines = [];
    let row = [""];
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];
      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push('');
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') { i++; }
        lines.push(row);
        row = [''];
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 1 || row[0] !== '') {
      lines.push(row);
    }
    return lines;
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const parsed = parseCSV(text);
      if (parsed.length === 0) return;

      const headers = parsed[0].map(h => h.trim());
      setCsvHeaders(headers);
      setCsvData(parsed.slice(1));

      const initialMapping = {};
      databaseFields.forEach(field => {
        const matchingIndex = headers.findIndex(h => field.matches.test(h));
        initialMapping[field.key] = matchingIndex !== -1 ? String(matchingIndex) : '';
      });
      setColumnMapping(initialMapping);
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const headers = ["Name", "Sell Price", "Barcode (Optional)", "Quantity (Optional)", "Unit (Optional)", "Low Stock Alert (Optional)", "Supplier Price (Optional)", "Model (Optional)", "Detail (Optional)", "Mfg Date (Optional)", "Exp Date (Optional)"];
    const example = ["Classic Cola 330ml", "75.00", "890103074090", "120", "pcs", "15", "55.00", "330ml Can", "Premium carbonated cola drink", "2026-01-01", "2026-12-31"];
    const csvContent = [headers.join(','), example.join(',')].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "products_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportSubmit = async () => {
    if (columnMapping.name === '') {
      alert('Please map the Product Name field');
      return;
    }
    if (columnMapping.price === '') {
      alert('Please map the Sell Price field');
      return;
    }

    const payloadProducts = csvData.map(row => {
      const prod = {};
      databaseFields.forEach(field => {
        const mappedIndex = columnMapping[field.key];
        if (mappedIndex !== '') {
          prod[field.key] = row[Number(mappedIndex)] || '';
        } else {
          prod[field.key] = '';
        }
      });
      return prod;
    }).filter(p => p.name && p.name.trim() !== '');

    if (payloadProducts.length === 0) {
      alert('No valid products found to import.');
      return;
    }

    setImportLoading(true);
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/products/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ products: payloadProducts })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to import products');

      setImportSummary(data);
    } catch (err) {
      alert(err.message || 'Something went wrong during import');
    } finally {
      setImportLoading(false);
    }
  };

  const handleCloseImportDialog = () => {
    setOpenImportDialog(false);
    setCsvHeaders([]);
    setCsvData([]);
    setCsvFileName('');
    setImportSummary(null);
    fetchProducts();
  };

  const getToken = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return null;
    }
    return token;
  }, [navigate]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch products');

      setProducts(Array.isArray(data) ? data : []);
      setSelected([]);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [navigate, getToken]);

  const fetchCategories = useCallback(async () => {
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
  }, [getToken]);

  const fetchSettings = useCallback(async () => {
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.currency) {
          setCurrency(data.currency);
        }
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  }, [getToken]);

  useEffect(() => {
    fetchProducts();
    fetchSettings();
    fetchCategories();

    const handleSync = () => {
      fetchProducts();
    };

    window.addEventListener('sync-database', handleSync);
    return () => {
      window.removeEventListener('sync-database', handleSync);
    };
  }, [fetchProducts, fetchSettings, fetchCategories]);

  const handleBulkDelete = async (selectedIds) => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/products`, {
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
      if (!response.ok) throw new Error(data.message || 'Failed to delete products');

      setSuccessMsg('Product(s) deleted successfully!');
      fetchProducts();
      setOpenDeleteDialog(false);
      setDeleteIds([]);
    } catch (err) {
      setError(err.message || 'Something went wrong deleting');
      setOpenDeleteDialog(false);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintSticker = () => {
    const printWindow = window.open('', '_blank', 'width=500,height=400');
    if (!printWindow) {
      alert("Please allow popups to print barcode stickers.");
      return;
    }
    const barcodeHtml = document.getElementById('sticker-barcode-svg').outerHTML;
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Barcode Sticker</title>
          <style>
            @media print {
              @page {
                size: 50mm 30mm;
                margin: 0;
              }
              html, body {
                width: 50mm;
                height: 30mm;
                margin: 0;
                padding: 0;
                background-color: #fff;
                -webkit-print-color-adjust: exact;
              }
            }
            body {
              margin: 0;
              padding: 1.5mm;
              width: 50mm;
              height: 30mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              font-family: 'Inter', -apple-system, sans-serif;
              overflow: hidden;
              text-align: center;
            }
            .product-name {
              font-size: 9px;
              font-weight: 700;
              color: #000;
              margin: 1px 0;
              line-height: 1.2;
              max-height: 22px;
              overflow: hidden;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              width: 100%;
            }
            .barcode-container {
              display: flex;
              justify-content: center;
              align-items: center;
              width: 100%;
              height: 12mm;
            }
            .barcode-container svg {
              width: 100%;
              height: 100%;
              max-height: 12mm;
            }
            .barcode-value {
              font-family: monospace;
              font-size: 9px;
              font-weight: 700;
              margin-top: 1px;
              letter-spacing: 1px;
              color: #000;
            }
          </style>
        </head>
        <body>
          <div class="product-name">${productNameToPrint}</div>
          <div class="barcode-container">
            ${barcodeHtml}
          </div>
          <div class="barcode-value">${barcodeToPrint}</div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const columns = [
    { id: 'name', label: 'Name', sortable: true, cellSx: { fontWeight: 600, color: '#0f172a' } },
    {
      id: 'barcode',
      label: 'Barcode',
      sortable: true,
      render: (row) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>
            {row.barcode}
          </Typography>
          <Button
            size="small"
            variant="text"
            onClick={(e) => {
              e.stopPropagation();
              setBarcodeToPrint(row.barcode);
              setProductNameToPrint(row.name);
              setOpenBarcodeDialog(true);
            }}
            sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: '0.7rem', textTransform: 'none', borderRadius: 1 }}
          >
            Sticker
          </Button>
        </Stack>
      )
    },
    {
      id: 'price',
      label: 'Sell Price',
      sortable: true,
      render: (row) => parseFloat(row.price) > 0 ? `Rs. ${parseFloat(row.price).toFixed(2)}` : 'Dynamic / POS'
    },
    {
      id: 'supplierPrice',
      label: 'Cost Price',
      sortable: true,
      render: (row) => `Rs. ${parseFloat(row.supplierPrice || 0).toFixed(2)}`
    },
    {
      id: 'stock',
      label: 'Stock',
      sortable: true,
      render: (row) => {
        const isLow = (Number(row.stock) || 0) <= (Number(row.lowStockAlert) || 5);
        return (
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ fontWeight: 600, color: isLow ? '#dc2626' : '#0f172a' }}>
              {row.stock}
            </Typography>
            {isLow && (
              <Chip
                label="⚠️ Low (Edit)"
                size="small"
                color="error"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/products/edit/${row.id}`);
                }}
                sx={{
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  height: 20,
                  '&:hover': { bgcolor: '#b91c1c' }
                }}
                title="Low stock alert! Click to edit product stock and settings"
              />
            )}
          </Stack>
        );
      }
    },
    { id: 'unit', label: 'Unit', sortable: true },
    {
      id: 'category',
      label: 'Brand',
      sortable: false,
      render: (row) => row.category?.name || '-'
    },
    {
      id: 'expiryDate',
      label: 'Expiry Date',
      sortable: true,
      render: (row) => row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : '-'
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
            sx={{ color: '#64748b', '&:hover': { color: '#0f766e' } }}
            title="View Details"
          >
            <VisibilityIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <IconButton
            onClick={(e) => { e.stopPropagation(); navigate(`/products/edit/${row.id}`); }}
            size="small"
            sx={{ color: '#64748b', '&:hover': { color: '#2563eb' } }}
            title="Edit Product"
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

  // Filter products based on selected Category/Brand and Low Stock toggle
  const filteredProducts = products.filter(p => {
    if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
    if (showLowStockOnly && (Number(p.stock) || 0) > (Number(p.lowStockAlert) || 5)) return false;
    return true;
  });

  // Calculate statistics from the filtered products state
  const totalProducts = filteredProducts.length;
  const totalStock = filteredProducts.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
  const totalRetailValue = filteredProducts.reduce((sum, p) => sum + ((Number(p.stock) || 0) * (Number(p.price) || 0)), 0);
  const totalCostValue = filteredProducts.reduce((sum, p) => sum + ((Number(p.stock) || 0) * (Number(p.supplierPrice) || 0)), 0);
  const lowStockCount = filteredProducts.filter(p => (Number(p.stock) || 0) <= (Number(p.lowStockAlert) || 5)).length;

  const formatCurrency = (val) => {
    const num = Number(val);
    return isNaN(num) ? 'Rs. 0.00' : 'Rs. ' + num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatNumber = (val) => {
    const num = Number(val);
    return isNaN(num) ? '0' : num.toLocaleString();
  };

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF();

      // Add Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('BF MakeUp POS - Inventory Report', 14, 20);

      // Add Date/Time
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

      // Add summary stats
      doc.text(`Total Products: ${filteredProducts.length}   |   Total Stock Qty: ${totalStock}   |   Total Retail Value: Rs. ${totalRetailValue.toFixed(2)}`, 14, 34);

      // Prepare Table Data
      const tableColumn = ["#", "Name", "Barcode", "Price", "Stock", "Unit", "Brand", "Expiry Date"];
      const tableRows = [];

      filteredProducts.forEach((prod, index) => {
        const prodData = [
          index + 1,
          prod.name,
          prod.barcode || '-',
          `Rs. ${parseFloat(prod.price || 0).toFixed(2)}`,
          prod.stock || 0,
          prod.unit || 'pcs',
          prod.category?.name || '-',
          prod.expiryDate ? new Date(prod.expiryDate).toLocaleDateString() : '-'
        ];
        tableRows.push(prodData);
      });

      // Generate Table
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 40,
        theme: 'striped',
        headStyles: { fillColor: [15, 118, 110] }, // teal
        styles: { fontSize: 9, cellPadding: 2 }
      });

      // Save PDF
      doc.save(`Inventory_Report_${new Date().toISOString().slice(0,10)}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Error generating PDF report.');
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', display: 'flex', flexDirection: 'column', gap: 3, fontFamily: '"Inter", sans-serif' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
          Manage Products & Items
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" sx={{ width: { xs: '100%', sm: 'auto' } }}>
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
            variant="outlined"
            color="secondary"
            startIcon={<PrintIcon />}
            onClick={handleDownloadPDF}
            sx={{ borderRadius: 2, px: 3, width: { xs: '100%', sm: 'auto' } }}
          >
            Inventory Report
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => setOpenImportDialog(true)}
            sx={{ borderRadius: 2, px: 3, width: { xs: '100%', sm: 'auto' } }}
          >
            Import CSV
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/products/add')}
            sx={{ borderRadius: 2, px: 3, width: { xs: '100%', sm: 'auto' } }}
          >
            Add Product
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Stats Cards Section */}
      <Grid container spacing={3}>
        {/* Card 1: Total Products */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
              color: '#ffffff',
              borderRadius: '12px',
              border: 'none',
              position: 'relative',
              overflow: 'hidden',
              height: 115,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              pl: 3,
              pr: 2,
              boxShadow: '0 4px 20px 0 rgba(59, 130, 246, 0.15)',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              '&:hover': {
                boxShadow: '0 8px 30px 0 rgba(59, 130, 246, 0.25)',
              }
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: 800, fontSize: '1.85rem', lineHeight: 1.2 }}>
              {formatNumber(totalProducts)}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.85)', mt: 0.5, letterSpacing: '0.75px', fontSize: '0.72rem', textTransform: 'uppercase' }}>
              Total Product Types
            </Typography>
            <InventoryIcon
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

        {/* Card 2: Total Stock Qty */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
              color: '#ffffff',
              borderRadius: '12px',
              border: 'none',
              position: 'relative',
              overflow: 'hidden',
              height: 115,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              pl: 3,
              pr: 2,
              boxShadow: '0 4px 20px 0 rgba(20, 184, 166, 0.15)',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              '&:hover': {
                boxShadow: '0 8px 30px 0 rgba(20, 184, 166, 0.25)',
              }
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: 800, fontSize: '1.85rem', lineHeight: 1.2 }}>
              {formatNumber(totalStock)}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.85)', mt: 0.5, letterSpacing: '0.75px', fontSize: '0.72rem', textTransform: 'uppercase' }}>
              Total Items in Stock
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

        {/* Card 3: Stock Value */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{
              background: 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)',
              color: '#ffffff',
              borderRadius: '12px',
              border: 'none',
              position: 'relative',
              overflow: 'hidden',
              height: 115,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              pl: 3,
              pr: 2,
              boxShadow: '0 4px 20px 0 rgba(34, 197, 94, 0.15)',
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              '&:hover': {
                boxShadow: '0 8px 30px 0 rgba(34, 197, 94, 0.25)',
              }
            }}
          >
            <Typography variant="h4" sx={{ fontWeight: 800, fontSize: '1.5rem', lineHeight: 1.2 }}>
              {formatCurrency(totalRetailValue)}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.95)', mt: 0.5, letterSpacing: '0.75px', fontSize: '0.72rem', textTransform: 'uppercase' }}>
              Stock Value (Retail)
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'rgba(255,255,255,0.75)', mt: 0.25, fontSize: '0.68rem' }}>
              Cost: {formatCurrency(totalCostValue)}
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

        {/* Card 4: Low Stock */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            onClick={() => setShowLowStockOnly(prev => !prev)}
            sx={{
              background: showLowStockOnly ? 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)' : 'linear-gradient(135deg, #be123c 0%, #f43f5e 100%)',
              color: '#ffffff',
              borderRadius: '12px',
              border: showLowStockOnly ? '3px solid #fef08a' : 'none',
              position: 'relative',
              overflow: 'hidden',
              height: 115,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              pl: 3,
              pr: 2,
              cursor: 'pointer',
              boxShadow: showLowStockOnly ? '0 0 0 2px #dc2626, 0 8px 30px 0 rgba(220, 38, 38, 0.4)' : '0 4px 20px 0 rgba(244, 63, 94, 0.15)',
              transition: 'all 0.25s ease',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 8px 30px 0 rgba(244, 63, 94, 0.35)',
              }
            }}
            title="Click to toggle filtering Low Stock items"
          >
            <Typography variant="h4" sx={{ fontWeight: 800, fontSize: '1.85rem', lineHeight: 1.2 }}>
              {formatNumber(lowStockCount)}
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.85)', mt: 0.5, letterSpacing: '0.75px', fontSize: '0.72rem', textTransform: 'uppercase' }}>
              Low Stock Items {showLowStockOnly ? '• [FILTERED ON]' : ''}
            </Typography>
            <WarningIcon
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

      {showLowStockOnly && (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={() => setShowLowStockOnly(false)}>
              Show All Products
            </Button>
          }
          sx={{ mb: 1, borderRadius: 2 }}
        >
          Filtering by <strong>Low Stock Items</strong> only ({filteredProducts.length} items). Click on the card or 'Show All Products' to clear.
        </Alert>
      )}

      {/* Content */}
      <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          data={filteredProducts}
          loading={loading}
          selected={selected}
          onSelectedChange={setSelected}
          bulkActions={bulkActions}
          searchPlaceholder="Search by name, barcode, brand, details..."
          storageKey="products_table"
          initialSearchQuery={urlSearch}
        />
      </Card>

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
            Are you sure you want to delete {deleteIds.length} selected product(s)? This action cannot be undone.
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

      {/* Barcode Sticker Dialog */}
      <Dialog
        open={openBarcodeDialog}
        onClose={() => setOpenBarcodeDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1.5 }}>
          Barcode Sticker Preview
        </DialogTitle>
        <Divider sx={{ mx: 3 }} />
        <DialogContent sx={{ py: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#f8fafc', px: 3 }}>
          {/* Real 50mm x 30mm Sticker Card (Scaled on Screen) */}
          <Box
            sx={{
              width: '280px',
              height: '168px', // 5:3 Aspect Ratio (50mm x 30mm)
              bgcolor: '#fff',
              borderRadius: 2,
              p: 2.5,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
            }}
          >
            {/* Product Name */}
            <Typography
              variant="body2"
              sx={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#0f172a',
                lineHeight: 1.2,
                textAlign: 'center',
                maxHeight: '40px',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                width: '100%'
              }}
            >
              {productNameToPrint}
            </Typography>

            {/* Barcode SVG Container */}
            <Box sx={{ width: '100%', height: '55px', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
              <Barcode
                value={barcodeToPrint}
                format="CODE128"
                width={1.2}
                height={55}
                displayValue={false}
                background="transparent"
                margin={0}
                id="sticker-barcode-svg"
              />
            </Box>

            {/* Barcode Value */}
            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '11px', color: '#1e293b', letterSpacing: '1px' }}>
              {barcodeToPrint}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenBarcodeDialog(false)} color="inherit" variant="outlined" sx={{ borderRadius: 1.5 }}>
            Close
          </Button>
          <Button
            onClick={handlePrintSticker}
            variant="contained"
            startIcon={<PrintIcon />}
            sx={{ borderRadius: 1.5 }}
          >
            Print Sticker
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Product Details Dialog */}
      <Dialog
        open={openViewDialog}
        onClose={() => {
          setOpenViewDialog(false);
          setDateFilter('all');
          setCustomStartDate(null);
          setCustomEndDate(null);
        }}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2.5, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Product Details</span>
          {viewProduct && (
            <Button
              variant="contained"
              size="small"
              startIcon={<EditIcon sx={{ fontSize: 16 }} />}
              onClick={() => {
                setOpenViewDialog(false);
                navigate(`/products/edit/${viewProduct.id}`);
              }}
              sx={{ textTransform: 'none', borderRadius: 1.5, py: 0.5, px: 2 }}
            >
              Edit Product
            </Button>
          )}
        </DialogTitle>
        <Divider sx={{ mx: 3 }} />
        <DialogContent sx={{ py: 3 }}>
          {viewLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <Typography variant="body1">Loading product details...</Typography>
            </Box>
          ) : viewProduct ? (
            <Grid container spacing={3}>
              {/* Left Side - Image and Barcode */}
              <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, borderRight: { md: '1px solid #e2e8f0' }, pr: { md: 3 } }}>
                <Box sx={{ width: 180, height: 180, border: '1px solid #cbd5e1', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', bgcolor: '#f8fafc' }}>
                  {viewProduct.imagePath ? (
                    <img
                      src={`${API_URL}/${viewProduct.imagePath}`}
                      alt={viewProduct.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No Image
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, width: '100%' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Sticker Preview (50x30mm)
                  </Typography>

                  {/* Miniature Sticker Preview */}
                  <Box
                    sx={{
                      width: '100%',
                      maxWidth: '220px',
                      height: '132px', // Scaled preview
                      bgcolor: '#fff',
                      borderRadius: 1.5,
                      p: 1.5,
                      boxSizing: 'border-box',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                    }}
                  >
                    {/* Product Name */}
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#0f172a',
                        lineHeight: 1.2,
                        textAlign: 'center',
                        maxHeight: '30px',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        width: '100%'
                      }}
                    >
                      {viewProduct.name}
                    </Typography>

                    {/* Barcode SVG Container */}
                    <Box sx={{ width: '100%', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                      <Barcode
                        value={viewProduct.barcode}
                        format="CODE128"
                        width={1.0}
                        height={40}
                        displayValue={false}
                        background="transparent"
                        margin={0}
                        id="view-dialog-barcode-svg"
                      />
                    </Box>

                    {/* Barcode Value */}
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '9px', color: '#1e293b', letterSpacing: '0.5px' }}>
                      {viewProduct.barcode}
                    </Typography>
                  </Box>

                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PrintIcon />}
                    onClick={() => handlePrintStickerFromView(viewProduct)}
                    sx={{ textTransform: 'none', borderRadius: 1.5, mt: 1, width: '100%', maxWidth: '220px' }}
                  >
                    Print Sticker
                  </Button>
                </Box>
              </Grid>

              {/* Right Side - Fields */}
              <Grid item xs={12} md={8}>
                <Stack spacing={3.5}>
                  {/* General Info */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#475569', mb: 1.5, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                      General Info
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Product Name</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>{viewProduct.name}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Model</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>{viewProduct.model || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Brand</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>{viewProduct.category?.name || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Unit</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>{viewProduct.unit || 'pcs'}</Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Detail / Description</Typography>
                        <Typography variant="body2" sx={{ color: '#475569', mt: 0.25, whiteSpace: 'pre-wrap' }}>{viewProduct.detail || '-'}</Typography>
                      </Grid>
                    </Grid>
                  </Box>

                  <Divider />

                  {/* Stock & Location */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#475569', mb: 1.5, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                      Inventory & Location
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Warehouse</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>{viewProduct.warehouse?.name || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Rack Number</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>{viewProduct.rackNo || '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Current Stock</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>{viewProduct.stock} {viewProduct.unit}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Low Stock Alert</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#b91c1c', mt: 0.25 }}>{viewProduct.lowStockAlert !== null ? viewProduct.lowStockAlert : '-'}</Typography>
                      </Grid>
                    </Grid>
                  </Box>

                  <Divider />

                  {/* Pricing & Supplier */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#475569', mb: 1.5, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                      Pricing & Supplier
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Supplier Price</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#16a34a', mt: 0.25 }}>Rs. {viewProduct.supplierPrice !== null ? parseFloat(viewProduct.supplierPrice).toFixed(2) : '0.00'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Sell Price (Retail)</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#2563eb', mt: 0.25 }}>Rs. {viewProduct.price !== null ? parseFloat(viewProduct.price).toFixed(2) : '0.00'}</Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Supplier</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>{viewProduct.supplier?.name || '-'}</Typography>
                      </Grid>
                    </Grid>
                  </Box>

                  <Divider />

                  {/* Dates */}
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#475569', mb: 1.5, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                      Dates & Timestamps
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Mfg. Date</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>{viewProduct.mfgDate ? new Date(viewProduct.mfgDate).toLocaleDateString() : '-'}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Expiry Date</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#b91c1c', mt: 0.25 }}>{viewProduct.expiryDate ? new Date(viewProduct.expiryDate).toLocaleDateString() : '-'}</Typography>
                      </Grid>
                    </Grid>
                  </Box>
                </Stack>
              </Grid>
              
              {/* Sales Summary & History Section */}
              <Grid item xs={12} sx={{ width: '100%' }}>
                <Box sx={{ mt: 2, width: '100%' }}>
                  <Divider sx={{ mb: 3 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#475569', mb: 2, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                    Sales Summary & History
                  </Typography>

                  {/* Date Filter Bar */}
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, mb: 3, alignItems: 'center', bgcolor: '#f8fafc', p: 2.5, borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                      <FormControl size="small" sx={{ minWidth: 180 }}>
                        <InputLabel id="product-date-filter-label">Period</InputLabel>
                        <Select
                          labelId="product-date-filter-label"
                          value={dateFilter}
                          label="Period"
                          onChange={(e) => setDateFilter(e.target.value)}
                        >
                          <MenuItem value="all">All Time</MenuItem>
                          <MenuItem value="today">Today</MenuItem>
                          <MenuItem value="yesterday">Yesterday</MenuItem>
                          <MenuItem value="thisweek">This Week</MenuItem>
                          <MenuItem value="thismonth">This Month</MenuItem>
                          <MenuItem value="30days">Last 30 Days</MenuItem>
                          <MenuItem value="365days">Last 365 Days</MenuItem>
                          <MenuItem value="custom">Custom Range</MenuItem>
                        </Select>
                      </FormControl>

                      {dateFilter === 'custom' && (
                        <>
                          <DatePicker
                            label="Start Date"
                            value={customStartDate}
                            onChange={(newValue) => setCustomStartDate(newValue)}
                            slotProps={{ textField: { size: 'small', sx: { width: 170 } } }}
                          />
                          <DatePicker
                            label="End Date"
                            value={customEndDate}
                            onChange={(newValue) => setCustomEndDate(newValue)}
                            slotProps={{ textField: { size: 'small', sx: { width: 170 } } }}
                          />
                        </>
                      )}
                    </Box>
                  </LocalizationProvider>

                  {/* Filter Calculations */}
                  {(() => {
                    const filteredSaleItems = (viewProduct.saleItems || []).filter(item => {
                      if (!item.sale?.createdAt) return false;
                      const saleDate = dayjs(item.sale.createdAt);
                      
                      if (dateFilter === 'today') {
                        return saleDate.isSame(dayjs(), 'day');
                      }
                      if (dateFilter === 'yesterday') {
                        return saleDate.isSame(dayjs().subtract(1, 'day'), 'day');
                      }
                      if (dateFilter === 'thisweek') {
                        return saleDate.isAfter(dayjs().startOf('week').subtract(1, 'day')) && saleDate.isBefore(dayjs().endOf('day'));
                      }
                      if (dateFilter === 'thismonth') {
                        return saleDate.isSame(dayjs(), 'month');
                      }
                      if (dateFilter === '30days') {
                        return saleDate.isAfter(dayjs().subtract(30, 'day').startOf('day')) && saleDate.isBefore(dayjs().endOf('day'));
                      }
                      if (dateFilter === '365days') {
                        return saleDate.isAfter(dayjs().subtract(365, 'day').startOf('day')) && saleDate.isBefore(dayjs().endOf('day'));
                      }
                      if (dateFilter === 'custom') {
                        if (customStartDate && saleDate.isBefore(dayjs(customStartDate).startOf('day'))) return false;
                        if (customEndDate && saleDate.isAfter(dayjs(customEndDate).endOf('day'))) return false;
                        return true;
                      }
                      return true; // 'all'
                    });

                    const totalUnitsFiltered = filteredSaleItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
                    const revenueFiltered = filteredSaleItems.reduce((sum, item) => sum + (item.total || 0), 0);
                    const costFiltered = totalUnitsFiltered * (viewProduct.supplierPrice || 0);
                    const profitFiltered = revenueFiltered - costFiltered;
                    const discountFiltered = filteredSaleItems.reduce((sum, item) => sum + (parseFloat(item.discount || 0)), 0);

                    return (
                      <>
                        {/* Stats Cards */}
                        <Grid container spacing={2} sx={{ mb: 3 }}>
                          <Grid item xs={12} sm={4} md={4}>
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">Total Units Sold</Typography>
                              <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a' }}>
                                {totalUnitsFiltered} {viewProduct.unit || 'pcs'}
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={12} sm={4} md={4}>
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">Total Discount Given</Typography>
                              <Typography variant="h6" sx={{ fontWeight: 700, color: '#d97706' }}>
                                {currency} {discountFiltered.toFixed(2)}
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={12} sm={4} md={4}>
                            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">Total Profit Earned</Typography>
                              <Typography variant="h6" sx={{ 
                                fontWeight: 700, 
                                color: profitFiltered >= 0 ? '#16a34a' : '#b91c1c'
                              }}>
                                {currency} {profitFiltered.toFixed(2)}
                              </Typography>
                            </Paper>
                          </Grid>
                        </Grid>

                        {/* Sales Table */}
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#475569', mb: 1.5, fontSize: '0.75rem' }}>
                          Recent Sales Transactions
                        </Typography>
                        
                        {viewLoading ? (
                          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Loading sales history...</Typography>
                        ) : filteredSaleItems.length === 0 ? (
                          <Typography variant="body2" color="text.secondary" sx={{ py: 2, fontStyle: 'italic' }}>
                            No sales recorded for this product in the selected period.
                          </Typography>
                        ) : (
                          <Box sx={{ width: '100%', maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: '"Inter", sans-serif', fontSize: '0.85rem' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                  <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>Date & Time</th>
                                  <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>Receipt No</th>
                                  <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>Customer</th>
                                  <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Qty</th>
                                  <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Retail Price</th>
                                  <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Discount</th>
                                  <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569', textAlign: 'right' }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[...filteredSaleItems]
                                  .sort((a, b) => new Date(b.sale?.createdAt) - new Date(a.sale?.createdAt))
                                  .map((item, idx) => (
                                    <tr key={item.id} style={{ borderBottom: idx < filteredSaleItems.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                      <td style={{ padding: '10px 14px', color: '#0f172a' }}>
                                        {item.sale?.createdAt ? new Date(item.sale.createdAt).toLocaleString() : '-'}
                                      </td>
                                      <td style={{ padding: '10px 14px', color: '#64748b', fontWeight: 500 }}>
                                        #{item.sale?.receiptNo || '-'}
                                      </td>
                                      <td style={{ padding: '10px 14px', color: '#0f172a' }}>
                                        {item.sale?.customer ? (
                                          <Box>
                                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                              {item.sale.customer.name}
                                            </Typography>
                                            {item.sale.customer.phone && (
                                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                {item.sale.customer.phone}
                                              </Typography>
                                            )}
                                          </Box>
                                        ) : (
                                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>Walk-in Customer</Typography>
                                        )}
                                      </td>
                                      <td style={{ padding: '10px 14px', color: '#0f172a', textAlign: 'right', fontWeight: 600 }}>
                                        {item.quantity} {viewProduct.unit || 'pcs'}
                                      </td>
                                      <td style={{ padding: '10px 14px', color: '#0f172a', textAlign: 'right' }}>
                                        {currency} {parseFloat(item.price || 0).toFixed(2)}
                                      </td>
                                      <td style={{ padding: '10px 14px', color: '#b91c1c', textAlign: 'right' }}>
                                        {item.discount > 0 ? `${currency} ${parseFloat(item.discount).toFixed(2)}` : '-'}
                                      </td>
                                      <td style={{ padding: '10px 14px', color: '#0f172a', textAlign: 'right', fontWeight: 700 }}>
                                        {currency} {parseFloat(item.total || 0).toFixed(2)}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </Box>
                        )}
                      </>
                    );
                  })()}
                </Box>
              </Grid>
            </Grid>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setOpenViewDialog(false)}
            color="inherit"
            variant="outlined"
            sx={{ borderRadius: 1.5 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* CSV Import Dialog */}
      <Dialog
        open={openImportDialog}
        onClose={handleCloseImportDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2.5, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Import Products from CSV</span>
          {!importSummary && (
            <Button
              size="small"
              variant="text"
              startIcon={<PrintIcon />}
              onClick={handleDownloadTemplate}
              sx={{ textTransform: 'none', borderRadius: 1.5 }}
            >
              Download Template
            </Button>
          )}
        </DialogTitle>
        <Divider sx={{ mx: 3 }} />
        <DialogContent sx={{ py: 3 }}>
          {importSummary ? (
            <Stack spacing={3}>
              <Alert severity={importSummary.skippedCount > 0 ? "warning" : "success"} sx={{ borderRadius: 1.5 }}>
                <strong>Import completed!</strong> Successfully imported {importSummary.successCount} product(s). Skipped {importSummary.skippedCount} product(s).
              </Alert>

              {importSummary.errors && importSummary.errors.length > 0 && (
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#e11d48', mb: 1 }}>
                    Skipped Rows & Warnings:
                  </Typography>
                  <Box sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: 1.5, p: 2, bgcolor: '#fff1f2' }}>
                    {importSummary.errors.map((err, index) => (
                      <Typography key={index} variant="caption" sx={{ display: 'block', color: '#9f1239', mb: 0.5, fontFamily: 'monospace' }}>
                        • {err}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}
            </Stack>
          ) : csvHeaders.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', px: 2 }}>
                Upload a CSV file containing your product records. You can download the example template above to see the required column formatting.
              </Typography>
              <Button
                variant="contained"
                component="label"
                startIcon={<UploadIcon />}
                sx={{ borderRadius: 2, px: 4, py: 1.25, boxShadow: 'none' }}
              >
                Choose CSV File
                <input
                  type="file"
                  hidden
                  accept=".csv"
                  onChange={handleCSVUpload}
                />
              </Button>
            </Box>
          ) : (
            <Stack spacing={3}>
              <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                File: <strong>{csvFileName}</strong> ({csvData.length} records detected). Map your CSV headers to the database fields below.
              </Alert>

              <Box sx={{ maxHeight: 300, overflowY: 'auto', pr: 1 }}>
                <Grid container spacing={2}>
                  {databaseFields.map(field => (
                    <React.Fragment key={field.key}>
                      <Grid item xs={6} sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: field.required ? 700 : 500, color: field.required ? '#0f172a' : '#475569' }}>
                          {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <FormControl fullWidth size="small">
                          <Select
                            value={columnMapping[field.key]}
                            onChange={(e) => setColumnMapping({ ...columnMapping, [field.key]: e.target.value })}
                            displayEmpty
                          >
                            <MenuItem value="">
                              <em>[Do Not Map / Auto]</em>
                            </MenuItem>
                            {csvHeaders.map((header, idx) => (
                              <MenuItem key={idx} value={String(idx)}>
                                {header}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    </React.Fragment>
                  ))}
                </Grid>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {importSummary ? (
            <Button
              onClick={handleCloseImportDialog}
              variant="contained"
              sx={{ borderRadius: 1.5 }}
            >
              Done
            </Button>
          ) : csvHeaders.length === 0 ? (
            <Button
              onClick={handleCloseImportDialog}
              color="inherit"
              variant="outlined"
              sx={{ borderRadius: 1.5 }}
            >
              Cancel
            </Button>
          ) : (
            <Box sx={{ display: 'flex', gap: 1.5, width: '100%', justifyContent: 'flex-end' }}>
              <Button
                onClick={() => {
                  setCsvHeaders([]);
                  setCsvData([]);
                  setCsvFileName('');
                }}
                disabled={importLoading}
                color="inherit"
                variant="outlined"
                sx={{ borderRadius: 1.5 }}
              >
                Back / Reset
              </Button>
              <Button
                onClick={handleImportSubmit}
                disabled={importLoading}
                variant="contained"
                sx={{ borderRadius: 1.5 }}
              >
                {importLoading ? 'Importing...' : 'Import Products'}
              </Button>
            </Box>
          )}
        </DialogActions>
      </Dialog>

      {/* Global Page Notifications */}
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

export default Products;
