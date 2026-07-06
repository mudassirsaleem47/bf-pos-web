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
  TextField,
  Alert,
  Snackbar,
  Divider,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import {
  Save as SaveIcon,
  CloudUpload as UploadIcon,
  Store as StoreIcon,
  Payments as PaymentsIcon,
  Receipt as ReceiptIcon,
  Print as PrintIcon,
  CheckCircle as CheckCircleIcon,
  Usb as UsbIcon
} from '@mui/icons-material';
import { usbPrinter } from '../utils/usbPrinter';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') ? import.meta.env.VITE_API_URL : window.location.origin);

const Setting = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');

  // Clear Data States
  const [openClearDialog, setOpenClearDialog] = useState(false);
  const [confirmClearText, setConfirmClearText] = useState('');
  const [clearLoading, setClearLoading] = useState(false);

  // Printer Configuration States
  const [printMethod, setPrintMethod] = useState(() => localStorage.getItem('printer_method') || 'browser');
  const [paperSize, setPaperSize] = useState(() => localStorage.getItem('printer_paper_size') || '80mm');
  const [autoPrint, setAutoPrint] = useState(() => {
    const stored = localStorage.getItem('printer_auto_print');
    return stored === null ? true : stored === 'true';
  });
  const [printBarcode, setPrintBarcode] = useState(() => {
    const stored = localStorage.getItem('printer_print_barcode');
    return stored === null ? true : stored === 'true';
  });
  const [usbConnected, setUsbConnected] = useState(false);
  const [usbDeviceName, setUsbDeviceName] = useState('');

  const [formData, setFormData] = useState({
    storeName: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    taxRate: '0',
    currency: 'Rs.',
    receiptFooter: 'Thank you! Come again'
  });

  const getToken = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return null;
    }
    return token;
  };

  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch settings');

      setFormData({
        storeName: data.storeName || '',
        address: data.address || '',
        phone: data.phone || '',
        email: data.email || '',
        website: data.website || '',
        taxRate: String(data.taxRate || 0),
        currency: data.currency || 'Rs.',
        receiptFooter: data.receiptFooter || 'Thank you! Come again'
      });

      if (data.logoPath) {
        setLogoPreview(`${API_URL}/${data.logoPath}`);
      }
    } catch (err) {
      setError(err.message || 'Failed to load store settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    // Auto-connect to WebUSB printer if previously connected
    if (localStorage.getItem('usb_printer_connected') === 'true') {
      usbPrinter.autoConnect().then(dev => {
        if (dev) {
          setUsbConnected(true);
          setUsbDeviceName(dev.productName || 'USB Printer');
        }
      }).catch(err => {
        console.error("Auto connect failed:", err);
      });
    }
  }, []);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Logo file size must be less than 2MB');
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handlePrintMethodChange = (val) => {
    setPrintMethod(val);
    localStorage.setItem('printer_method', val);
  };
  const handlePaperSizeChange = (val) => {
    setPaperSize(val);
    localStorage.setItem('printer_paper_size', val);
  };
  const handleAutoPrintChange = (val) => {
    setAutoPrint(val);
    localStorage.setItem('printer_auto_print', String(val));
  };
  const handlePrintBarcodeChange = (val) => {
    setPrintBarcode(val);
    localStorage.setItem('printer_print_barcode', String(val));
  };

  const handleConnectUsb = async () => {
    try {
      setError('');
      const dev = await usbPrinter.connect();
      setUsbConnected(true);
      setUsbDeviceName(dev.productName || 'USB Printer');
      setSuccessMsg(`Successfully connected to printer: ${dev.productName || 'USB Printer'}`);
    } catch (err) {
      console.error(err);
      setError('Failed to connect USB printer: ' + err.message);
      setUsbConnected(false);
      setUsbDeviceName('');
    }
  };

  const handleTestPrint = async () => {
    try {
      setError('');
      setSuccessMsg('');
      const testSale = {
        receiptNo: 'TEST-0001',
        createdAt: new Date().toISOString(),
        totalAmount: 150.00,
        discount: 0,
        paidAmount: 150.00,
        change: 0,
        items: [
          { name: 'Test Product 1', quantity: 1, price: 100.00, total: 100.00 },
          { name: 'Test Product 2', quantity: 1, price: 50.00, total: 50.00 }
        ]
      };
      
      const storeSettings = {
        storeName: formData.storeName || 'Test Store',
        address: formData.address || '123 Test Street',
        phone: formData.phone || '123-456-7890',
        email: formData.email || 'test@example.com',
        currency: formData.currency || 'Rs.',
        receiptFooter: formData.receiptFooter || 'Test print successful!'
      };

      await usbPrinter.printReceipt(testSale, storeSettings, paperSize, printBarcode);
      setSuccessMsg('Test receipt printed successfully!');
    } catch (err) {
      console.error(err);
      setError('Test print failed: ' + err.message);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const token = getToken();
      if (!token) return;

      const fd = new FormData();
      fd.append('storeName', formData.storeName);
      fd.append('address', formData.address);
      fd.append('phone', formData.phone);
      fd.append('email', formData.email);
      fd.append('website', formData.website);
      fd.append('taxRate', formData.taxRate);
      fd.append('currency', formData.currency);
      fd.append('receiptFooter', formData.receiptFooter);
      if (logoFile) {
        fd.append('logo', logoFile);
      }

      const response = await fetch(`${API_URL}/api/settings`, {
        method: 'PUT',
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
      if (!response.ok) throw new Error(data.message || 'Failed to save settings');

      setSuccessMsg('Store settings updated successfully!');
      if (data.logoPath) {
        setLogoPreview(`${API_URL}/${data.logoPath}?t=${Date.now()}`); // Cache bust
      }
      setLogoFile(null);
    } catch (err) {
      setError(err.message || 'Something went wrong saving settings');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllData = async () => {
    if (confirmClearText !== 'CLEAR') return;
    setClearLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/settings/clear-data`, {
        method: 'DELETE',
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
      if (!response.ok) throw new Error(data.message || 'Failed to clear store data');

      setSuccessMsg('All store data has been cleared successfully!');
      setOpenClearDialog(false);
      setConfirmClearText('');
    } catch (err) {
      setError(err.message || 'Failed to clear store data.');
    } finally {
      setClearLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', display: 'flex', flexDirection: 'column', gap: 3, fontFamily: '"Inter", sans-serif' }}>
      
      {/* Header */}
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
          Store Settings
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Customize company profile, transaction currency/tax values, and checkout receipt templates.
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <form onSubmit={handleFormSubmit}>
        <Grid container spacing={3}>
          {/* Company Profile Card */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, mb: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
                  <StoreIcon sx={{ color: '#2563eb' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
                    Company Profile
                  </Typography>
                </Stack>
                <Divider sx={{ mb: 3 }} />

                <Stack spacing={3}>
                  <TextField
                    label="Store Name"
                    variant="standard"
                    required
                    fullWidth
                    size="small"
                    value={formData.storeName}
                    onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  />
                  <TextField
                    label="Store Address"
                    variant="standard"
                    fullWidth
                    size="small"
                    multiline
                    rows={2}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Store Phone"
                        variant="standard"
                        fullWidth
                        size="small"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label="Store Email"
                        variant="standard"
                        fullWidth
                        type="email"
                        size="small"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </Grid>
                  </Grid>
                  <TextField
                    label="Store Website"
                    variant="standard"
                    fullWidth
                    size="small"
                    placeholder="https://example.com"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </Stack>
              </CardContent>
            </Card>

            {/* Financial Details & Receipts */}
            <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5 }}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
                  <PaymentsIcon sx={{ color: '#059669' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
                    Financials & Tax Configurations
                  </Typography>
                </Stack>
                <Divider sx={{ mb: 3 }} />

                <Grid container spacing={3} sx={{ mb: 4 }}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Currency Symbol"
                      variant="standard"
                      required
                      fullWidth
                      size="small"
                      placeholder="Rs. or $ or €"
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Tax Rate (%)"
                      variant="standard"
                      required
                      fullWidth
                      type="number"
                      inputProps={{ min: 0, step: 'any' }}
                      size="small"
                      value={formData.taxRate}
                      onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                    />
                  </Grid>
                </Grid>

                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
                  <ReceiptIcon sx={{ color: '#ea580c' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
                    Receipt Template Settings
                  </Typography>
                </Stack>
                <Divider sx={{ mb: 3 }} />

                <TextField
                  label="Receipt Footer / Terms Note"
                  variant="standard"
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  value={formData.receiptFooter}
                  onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                />
              </CardContent>
            </Card>

            {/* Printer Settings Card */}
            <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, mt: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
                  <PrintIcon sx={{ color: '#2563eb' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
                    Printer Settings
                  </Typography>
                </Stack>
                <Divider sx={{ mb: 3 }} />

                <Stack spacing={2.5}>
                  {/* Print Method Select */}
                  <FormControl size="small" fullWidth variant="outlined">
                    <InputLabel id="print-method-label">Print Method</InputLabel>
                    <Select
                      labelId="print-method-label"
                      label="Print Method"
                      value={printMethod}
                      onChange={(e) => handlePrintMethodChange(e.target.value)}
                    >
                      <MenuItem value="browser">Browser Print Dialog</MenuItem>
                      <MenuItem value="usb">Direct USB Print (ESC/POS)</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Paper Width Select */}
                  <FormControl size="small" fullWidth variant="outlined">
                    <InputLabel id="paper-size-label">Paper Width</InputLabel>
                    <Select
                      labelId="paper-size-label"
                      label="Paper Width"
                      value={paperSize}
                      onChange={(e) => handlePaperSizeChange(e.target.value)}
                    >
                      <MenuItem value="80mm">80mm (Standard)</MenuItem>
                      <MenuItem value="58mm">58mm (Mini)</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Autoprint Checkbox */}
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={autoPrint}
                        onChange={(e) => handleAutoPrintChange(e.target.checked)}
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ color: '#475569' }}>
                        Auto-Print on Checkout
                      </Typography>
                    }
                    sx={{ m: 0 }}
                  />

                  {/* Print Barcode Checkbox */}
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={printBarcode}
                        onChange={(e) => handlePrintBarcodeChange(e.target.checked)}
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ color: '#475569' }}>
                        Print Barcode on Receipt
                      </Typography>
                    }
                    sx={{ m: 0 }}
                  />

                  {/* WebUSB Connection Section */}
                  {printMethod === 'usb' && (
                    <Box sx={{ borderTop: '1px solid #f1f5f9', pt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {usbConnected ? (
                        <Alert 
                          severity="success" 
                          icon={<CheckCircleIcon fontSize="inherit" />}
                          sx={{ py: 0.5, px: 1.5, '& .MuiAlert-message': { fontSize: '0.775rem' } }}
                        >
                          Connected: <strong>{usbDeviceName}</strong>
                        </Alert>
                      ) : (
                        <Alert 
                          severity="warning" 
                          icon={<UsbIcon fontSize="inherit" />}
                          sx={{ py: 0.5, px: 1.5, '& .MuiAlert-message': { fontSize: '0.775rem' } }}
                        >
                          No USB Printer connected.
                        </Alert>
                      )}

                      <Stack direction="row" spacing={2}>
                        <Button
                          variant="outlined"
                          color="primary"
                          size="small"
                          fullWidth
                          startIcon={<UsbIcon />}
                          onClick={handleConnectUsb}
                          sx={{ textTransform: 'none', borderRadius: 1.5 }}
                        >
                          {usbConnected ? 'Change Printer' : 'Connect USB Printer'}
                        </Button>
                        {usbConnected && (
                          <Button
                            variant="outlined"
                            color="secondary"
                            size="small"
                            fullWidth
                            startIcon={<PrintIcon />}
                            onClick={handleTestPrint}
                            sx={{ textTransform: 'none', borderRadius: 1.5 }}
                          >
                            Print Test Receipt
                          </Button>
                        )}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Logo Identity Card */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, height: '100%' }}>
              <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', boxSizing: 'border-box' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', width: '100%', mb: 2.5 }}>
                  Store Logo
                </Typography>
                <Divider sx={{ width: '100%', mb: 4 }} />

                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexGrow: 1, justifyContent: 'center', py: 2 }}>
                  <Avatar
                    src={logoPreview}
                    alt="Store Logo"
                    variant="rounded"
                    sx={{
                      width: 160,
                      height: 160,
                      border: '1px solid #e2e8f0',
                      bgcolor: '#f8fafc',
                      '& img': { objectFit: 'contain' }
                    }}
                  />

                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569' }}>
                      Brand Identity Icon
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, maxWidth: 220 }}>
                      Used on PDF reports and POS checkout receipts. SVG, PNG, JPG accepted. Max size 2MB.
                    </Typography>
                  </Box>

                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<UploadIcon />}
                    sx={{ borderRadius: 2, textTransform: 'none', px: 3 }}
                  >
                    Upload Logo
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={handleLogoChange}
                    />
                  </Button>
                </Box>

                <Box sx={{ width: '100%', pt: 4, mt: 'auto' }}>
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    disabled={loading}
                    startIcon={<SaveIcon />}
                    sx={{ borderRadius: 2, py: 1.25, fontWeight: 700 }}
                  >
                    {loading ? 'Saving Settings...' : 'Save Settings'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </form>

      {/* Danger Zone */}
      <Card sx={{ border: '1px solid #fee2e2', bgcolor: '#fff5f5', borderRadius: 1.5, mt: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#991b1b' }}>
              Danger Zone (Reset Data)
            </Typography>
            <Typography variant="body2" sx={{ color: '#7f1d1d' }}>
              Wipe all transactional history and master data (products, sales, customers, suppliers, expenses, receivables/payables, warehouses, staff). This action is irreversible. <strong>Your user login account and store settings will be kept.</strong>
            </Typography>
            <Box>
              <Button
                variant="contained"
                color="error"
                onClick={() => setOpenClearDialog(true)}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
              >
                Clear All Data
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Clear Data Dialog */}
      <Dialog
        open={openClearDialog}
        onClose={() => !clearLoading && setOpenClearDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1, color: '#991b1b' }}>
          Are you absolutely sure?
        </DialogTitle>
        <Divider sx={{ mx: 3 }} />
        <DialogContent sx={{ py: 3 }}>
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ color: '#475569' }}>
              This will permanently delete all sales transactions, products, categories, customers, suppliers, expenses, staff, warehouses, and payables/receivables.
            </Typography>
            <Typography variant="body2" sx={{ color: '#7f1d1d', fontWeight: 600 }}>
              To confirm, please type "CLEAR" in the box below:
            </Typography>
            <TextField
              variant="outlined"
              size="small"
              fullWidth
              placeholder="CLEAR"
              value={confirmClearText}
              onChange={(e) => setConfirmClearText(e.target.value)}
              disabled={clearLoading}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => { setOpenClearDialog(false); setConfirmClearText(''); }}
            color="inherit"
            variant="outlined"
            disabled={clearLoading}
            sx={{ borderRadius: 1.5, textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleClearAllData}
            color="error"
            variant="contained"
            disabled={confirmClearText !== 'CLEAR' || clearLoading}
            sx={{ borderRadius: 1.5, textTransform: 'none', boxShadow: 'none', '&:hover': { boxShadow: 'none' } }}
          >
            {clearLoading ? 'Clearing Data...' : 'Permanently Wipe Data'}
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

export default Setting;
