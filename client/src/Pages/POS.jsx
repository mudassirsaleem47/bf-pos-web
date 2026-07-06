import React, { useState, useEffect, useRef } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Snackbar,
  Autocomplete,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import { Delete as DeleteIcon, Print as PrintIcon, Clear as ClearIcon, AssignmentReturn as ReturnIcon, CheckCircle as CheckCircleIcon, Usb as UsbIcon, Add as AddIcon } from '@mui/icons-material';
import Barcode from 'react-barcode';
import { usbPrinter } from '../utils/usbPrinter';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') ? import.meta.env.VITE_API_URL : window.location.origin);

const POS = () => {
  const navigate = useNavigate();
  const productInputRef = useRef(null);
  const quantityInputRef = useRef(null);

  // POS State
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [cart, setCart] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productInputValue, setProductInputValue] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [cash, setCash] = useState('');
  const [settings, setSettings] = useState({
    storeName: 'My Store',
    currency: 'Rs.',
    receiptFooter: 'Thank you! Come again',
  });

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [lastSale, setLastSale] = useState(null);

  // Add Customer Dialog States
  const [openAddCustomerDialog, setOpenAddCustomerDialog] = useState(false);
  const [addCustomerFormData, setAddCustomerFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    loyaltyPoints: '0',
    balance: '0'
  });
  const [addCustomerError, setAddCustomerError] = useState('');
  const [addCustomerLoading, setAddCustomerLoading] = useState(false);

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

  // Return / Refund States
  const [openReturnDialog, setOpenReturnDialog] = useState(false);
  const [returnReceiptNo, setReturnReceiptNo] = useState('');
  const [selectedReturnSale, setSelectedReturnSale] = useState(null);
  const [returnItems, setReturnItems] = useState({});
  const [returnError, setReturnError] = useState('');
  const [processingReturn, setProcessingReturn] = useState(false);

  const handleAddCustomerSubmit = async (e) => {
    e.preventDefault();
    setAddCustomerError('');

    if (!addCustomerFormData.name.trim()) {
      setAddCustomerError('Name is required');
      return;
    }

    const token = getToken();
    if (!token) return;

    setAddCustomerLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: addCustomerFormData.name.trim(),
          phone: addCustomerFormData.phone.trim(),
          email: addCustomerFormData.email.trim(),
          address: addCustomerFormData.address.trim(),
          loyaltyPoints: parseInt(addCustomerFormData.loyaltyPoints) || 0,
          balance: parseFloat(addCustomerFormData.balance) || 0
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to save customer');

      setSuccessMsg('Customer added successfully!');
      // Refetch customer list
      await fetchCustomers();
      // Set the newly created customer as selected
      setSelectedCustomer(data);
      // Close dialog
      setOpenAddCustomerDialog(false);
      // Reset form
      setAddCustomerFormData({
        name: '',
        phone: '',
        email: '',
        address: '',
        loyaltyPoints: '0',
        balance: '0'
      });
    } catch (err) {
      setAddCustomerError(err.message || 'Failed to submit customer details');
    } finally {
      setAddCustomerLoading(false);
    }
  };

  const handleFindSale = async () => {
    setReturnError('');
    setSelectedReturnSale(null);
    setReturnItems({});
    
    if (!returnReceiptNo.trim()) {
      setReturnError('Please enter a receipt number.');
      return;
    }

    try {
      const token = getToken();
      if (!token) return;
      const response = await fetch(`${API_URL}/api/sales`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch sales history.');
      }
      
      const sales = await response.json();
      const sale = sales.find(s => s.receiptNo.toLowerCase() === returnReceiptNo.trim().toLowerCase());
      
      if (!sale) {
        setReturnError(`Receipt "${returnReceiptNo}" not found.`);
        return;
      }
      
      setSelectedReturnSale(sale);
      
      // Initialize return items map
      const initialItems = {};
      sale.items.forEach(item => {
        // Exclude items that are already negative (returns)
        if (item.quantity > 0) {
          initialItems[item.id] = {
            selected: true,
            qty: item.quantity,
            maxQty: item.quantity,
            price: item.price,
            name: item.name,
            productId: item.productId,
            barcode: item.barcode
          };
        }
      });
      
      if (Object.keys(initialItems).length === 0) {
        setReturnError('This receipt does not have any items available for return.');
        setSelectedReturnSale(null);
        return;
      }
      
      setReturnItems(initialItems);
    } catch (err) {
      setReturnError(err.message || 'Error fetching sale.');
    }
  };

  const handleProcessReturn = async () => {
    setReturnError('');
    setProcessingReturn(true);
    
    const itemsToReturn = Object.values(returnItems).filter(item => item.selected && item.qty > 0);
    
    if (itemsToReturn.length === 0) {
      setReturnError('Please select at least one item to return.');
      setProcessingReturn(false);
      return;
    }
    
    // Calculate total return amount (negative values)
    const refundSubtotal = itemsToReturn.reduce((sum, item) => sum + (item.price * item.qty), 0);
    
    // Calculate proportionate discount if the original sale had a discount
    const originalTotal = selectedReturnSale.totalAmount + selectedReturnSale.discount;
    const discountRatio = originalTotal > 0 ? (selectedReturnSale.discount / originalTotal) : 0;
    const refundDiscount = refundSubtotal * discountRatio;
    const refundTotal = refundSubtotal - refundDiscount;
    
    try {
      const token = getToken();
      if (!token) return;
      
      const response = await fetch(`${API_URL}/api/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: itemsToReturn.map(item => ({
            productId: item.productId,
            name: `[RETURN] ${item.name}`,
            barcode: item.barcode,
            quantity: -item.qty, // Negative quantity
            price: item.price,
            total: -(item.price * item.qty), // Negative total
          })),
          totalAmount: -refundTotal, // Negative total amount
          paidAmount: -refundTotal,  // Paid amount matches refund
          discount: -refundDiscount, // Negative discount
          tax: 0,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to process return checkout.');
      }
      
      const returnedSale = await response.json();
      setSuccessMsg(`Return processed successfully! Refund Receipt: ${returnedSale.receiptNo}`);
      setOpenReturnDialog(false);
      
      // Clear states
      setReturnReceiptNo('');
      setSelectedReturnSale(null);
      setReturnItems({});
      
      // Auto print refund receipt
      setLastSale(returnedSale);
    } catch (err) {
      setReturnError(err.message || 'Failed to process return');
    } finally {
      setProcessingReturn(false);
    }
  };

  const getToken = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return null;
    }
    return token;
  };

  // Fetch Settings & Products
  const fetchSettings = async () => {
    try {
      const token = getToken();
      if (!token) return;
      const response = await fetch(`${API_URL}/api/settings`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data) setSettings(data);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  };

  const fetchProducts = async () => {
    try {
      const token = getToken();
      if (!token) return;
      const response = await fetch(`${API_URL}/api/products`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const token = getToken();
      if (!token) return;
      const response = await fetch(`${API_URL}/api/customers`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCustomers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchProducts();
    fetchCustomers();
    focusProductField();

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

  const focusProductField = () => {
    setTimeout(() => {
      if (productInputRef.current) {
        productInputRef.current.focus();
      }
    }, 200);
  };

  const handlePrintReceipt = async (saleToPrint = lastSale) => {
    if (!saleToPrint) return;
    if (printMethod === 'usb') {
      try {
        setError('');
        await usbPrinter.printReceipt(saleToPrint, settings, paperSize, printBarcode);
        setSuccessMsg('Receipt printed successfully via USB!');
      } catch (err) {
        console.error(err);
        setError('Direct USB printing failed: ' + err.message + '. Falling back to Browser Print.');
        window.print();
      }
    } else {
      window.print();
    }
  };

  // Auto-print receipt when checkout completes
  useEffect(() => {
    if (lastSale && autoPrint) {
      const timer = setTimeout(() => {
        handlePrintReceipt(lastSale);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [lastSale, autoPrint, printMethod, paperSize, printBarcode]);



  const addToCart = (product, qty = 1) => {
    const parsedQty = parseFloat(qty) || 1;
    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.id === product.id);
      if (existingIndex > -1) {
        const newCart = [...prevCart];
        const newQty = newCart[existingIndex].qty + parsedQty;
        newCart[existingIndex] = {
          ...newCart[existingIndex],
          qty: newQty,
          total: newQty * product.price,
        };
        return newCart;
      } else {
        return [
          ...prevCart,
          {
            id: product.id,
            name: product.name,
            barcode: product.barcode,
            price: product.price,
            qty: parsedQty,
            total: parsedQty * product.price,
          },
        ];
      }
    });
    focusProductField();
  };

  const handleAddItemToCart = (e) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return;

    addToCart(selectedProduct, qty);

    // Reset input fields
    setSelectedProduct(null);
    setProductInputValue('');
    setQuantity(1);

    // Refocus the Autocomplete input field
    focusProductField();
  };

  const handleQtyChange = (id, newQty) => {
    const qty = parseFloat(newQty);
    if (isNaN(qty) || qty <= 0) return;
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === id
          ? { ...item, qty, total: qty * item.price }
          : item
      )
    );
  };

  const handlePriceChange = (id, newPrice) => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) return;
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.id === id
          ? { ...item, price, total: item.qty * price }
          : item
      )
    );
  };

  const handleRemoveItem = (id) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
    focusProductField();
  };

  const handleClearCart = () => {
    setCart([]);
    setSelectedProduct(null);
    setProductInputValue('');
    setQuantity(1);
    setDiscountPercent(0);
    setCash('');
    setLastSale(null);
    setSelectedCustomer(null);
    setError('');
    focusProductField();
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const finalDiscount = subtotal * ((parseFloat(discountPercent) || 0) / 100);
  const total = Math.max(0, subtotal - finalDiscount);
  const paid = parseFloat(cash) || 0;
  const change = Math.max(0, paid - total);

  // Checkout Handler
  const handleCheckout = async () => {
    setError('');
    setSuccessMsg('');
    if (cart.length === 0) {
      setError('Cart is empty.');
      return;
    }
    if (paid < total && !selectedCustomer) {
      setError('Customer is required for credit transactions (Paid amount is less than total).');
      return;
    }

    setLoading(true);
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.id,
            name: item.name,
            barcode: item.barcode,
            quantity: item.qty,
            price: item.price,
            total: item.total,
          })),
          totalAmount: total,
          paidAmount: paid,
          discount: finalDiscount,
          tax: 0,
          customerId: selectedCustomer?.id || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Checkout failed');
      }

      const sale = await response.json();
      setLastSale(sale);
      const remainingCredit = total - paid;
      setSuccessMsg(
        `Checkout successful! Receipt: ${sale.receiptNo}${
          remainingCredit > 0 ? ` (Added Rs. ${remainingCredit.toFixed(2)} to ${selectedCustomer?.name || 'Customer'}'s khata)` : ''
        }`
      );
      setCart([]);
      setCash('');
      setDiscountPercent(0);
      setSelectedCustomer(null);
      focusProductField();
    } catch (err) {
      setError(err.message || 'Failed to process checkout');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    handlePrintReceipt(lastSale);
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', display: 'flex', flexDirection: 'column', gap: 3, fontFamily: '"Inter", sans-serif' }}>
      {/* Actual printed receipt layout hidden on screen */}
      <Box className={`thermal-receipt width-${paperSize}`}>
        <div className="thermal-receipt-center">
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', m: 0 }}>
            {settings.storeName.toUpperCase()}
          </Typography>
          {settings.address && <p style={{ margin: '2px 0' }}>{settings.address}</p>}
          {settings.phone && <p style={{ margin: '2px 0' }}>Tel: {settings.phone}</p>}
          <p style={{ margin: '2px 0' }}>Inventory POS System</p>
        </div>
        <div className="thermal-receipt-divider" />
        <div className="thermal-receipt-flex">
          <span>Date: {lastSale ? new Date(lastSale.createdAt).toLocaleString() : new Date().toLocaleString()}</span>
        </div>
        <div className="thermal-receipt-flex">
          <span>Receipt No: {lastSale?.receiptNo || 'R-XXXX'}</span>
        </div>
        {lastSale?.customer && (
          <div className="thermal-receipt-flex">
            <span>Customer: {lastSale.customer.name}</span>
          </div>
        )}
        <div className="thermal-receipt-divider" />

        {(lastSale ? lastSale.items : cart).map((item, idx) => (
          <div key={item.id || idx} style={{ margin: '6px 0' }}>
            <div style={{ fontWeight: 'bold' }}>{item.name}</div>
            <div className="thermal-receipt-flex" style={{ paddingLeft: '8px' }}>
              <span>{item.qty || item.quantity} x {settings.currency}{parseFloat(item.price).toFixed(2)}</span>
              <span>{settings.currency}{parseFloat(item.total).toFixed(2)}</span>
            </div>
          </div>
        ))}

        <div className="thermal-receipt-divider" />
        <div className="thermal-receipt-flex">
          <span>Subtotal:</span>
          <span>{settings.currency}{((lastSale ? (lastSale.totalAmount + lastSale.discount) : (total + finalDiscount))).toFixed(2)}</span>
        </div>
        {(lastSale ? lastSale.discount : finalDiscount) > 0 && (
          <div className="thermal-receipt-flex">
            <span>Discount:</span>
            <span>-{settings.currency}{(lastSale ? lastSale.discount : finalDiscount).toFixed(2)}</span>
          </div>
        )}
        <div className="thermal-receipt-flex" style={{ fontWeight: 'bold' }}>
          <span>Total Amount:</span>
          <span>{settings.currency}{(lastSale ? lastSale.totalAmount : total).toFixed(2)}</span>
        </div>
        <div className="thermal-receipt-flex">
          <span>Paid Cash:</span>
          <span>{settings.currency}{(lastSale ? lastSale.paidAmount : paid).toFixed(2)}</span>
        </div>
        {((lastSale ? lastSale.totalAmount : total) > (lastSale ? lastSale.paidAmount : paid)) ? (
          <div className="thermal-receipt-flex" style={{ fontWeight: 'bold' }}>
            <span>Remaining Due (Credit):</span>
            <span>{settings.currency}{(lastSale ? (lastSale.totalAmount - lastSale.paidAmount) : (total - paid)).toFixed(2)}</span>
          </div>
        ) : (
          <div className="thermal-receipt-flex">
            <span>Change Return:</span>
            <span>{settings.currency}{(lastSale ? lastSale.change : change).toFixed(2)}</span>
          </div>
        )}
        <div className="thermal-receipt-divider" />
        <div className="thermal-receipt-center" style={{ marginTop: '10px', marginBottom: '10px' }}>
          <p style={{ margin: '4px 0' }}>{settings.receiptFooter}</p>
          <p style={{ margin: '4px 0' }}>=============================</p>
        </div>

        {/* Scannable Barcode at bottom of printed receipt */}
        {printBarcode && lastSale?.receiptNo && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 2, mb: 1 }}>
            <Barcode 
              value={lastSale.receiptNo.toUpperCase()} 
              width={paperSize === '58mm' ? 1.0 : 1.3} 
              height={40} 
              fontSize={10}
              margin={0}
            />
          </Box>
        )}
      </Box>

      {/* Screen layout */}
      <Box className="no-print" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
            POS — Cashier
          </Typography>
        </Box>
        {error && <Alert severity="error">{error}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, width: '100%' }}>
          {/* Left Side: Scan & Cart */}
          <Box sx={{ width: { xs: '100%', md: 'calc(70% - 12px)' }, flexShrink: 0 }}>
            <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', p: 3 }}>
              {/* Product & Quantity Select input */}
              <Box 
                component="form" 
                onSubmit={handleAddItemToCart} 
                sx={{ 
                  mb: 3, 
                  display: 'flex', 
                  flexDirection: { xs: 'column', sm: 'row' }, 
                  gap: 2, 
                  alignItems: 'center' 
                }}
              >
                {/* Product Autocomplete */}
                <Autocomplete
                  options={products}
                  getOptionLabel={(option) => `${option.name} (${settings.currency}${parseFloat(option.price).toFixed(2)})`}
                  value={selectedProduct}
                  onChange={(event, newValue) => {
                    setSelectedProduct(newValue);
                    if (newValue) {
                      // Focus the quantity input field when product is selected (manual selection workflow)
                      setTimeout(() => {
                        if (quantityInputRef.current) {
                          quantityInputRef.current.focus();
                          quantityInputRef.current.select(); // Select current value to make typing easier
                        }
                      }, 50);
                    }
                  }}
                  inputValue={productInputValue}
                  onInputChange={(event, newInputValue, reason) => {
                    // Smart barcode scanning match
                    if (reason === 'input') {
                      const matched = products.find(p => p.barcode && p.barcode.toLowerCase() === newInputValue.toLowerCase().trim());
                      if (matched) {
                        // Hands-free instant barcode scan add-to-cart
                        addToCart(matched, 1);
                        setSelectedProduct(null);
                        setProductInputValue('');
                        return; // Done
                      }
                    }
                    setProductInputValue(newInputValue);
                  }}
                  filterOptions={(options, state) => {
                    const query = state.inputValue.toLowerCase().trim();
                    return options.filter(option => 
                      option.name.toLowerCase().includes(query) || 
                      (option.barcode && option.barcode.toLowerCase().includes(query))
                    );
                  }}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      inputRef={productInputRef}
                      label="Select Product" 
                      size="small" 
                      placeholder="Type product name or scan barcode..." 
                      autoFocus
                    />
                  )}
                  sx={{ flexGrow: 2, width: '100%' }}
                />

                {/* Quantity Spinner Field */}
                <TextField
                  inputRef={quantityInputRef}
                  label="Quantity"
                  type="number"
                  size="small"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  slotProps={{
                    htmlInput: { min: 1, step: 1 }
                  }}
                  sx={{ width: { xs: '100%', sm: 120 } }}
                />

                {/* Hidden submit button to allow form submission on Enter */}
                <button type="submit" style={{ display: 'none' }} />
              </Box>

              {/* Items Table */}
              <TableContainer component={Paper} sx={{ border: '1px solid #f1f5f9', borderRadius: 1, boxShadow: 'none' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell>Item Name</TableCell>
                      <TableCell>Price</TableCell>
                      <TableCell style={{ width: 110 }}>Qty</TableCell>
                      <TableCell>Total</TableCell>
                      <TableCell align="right" style={{ width: 60 }}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cart.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                          <Typography variant="body2" color="text.secondary">
                            Cart is empty. Scan a barcode or add an item manually.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      cart.map((item) => (
                        <TableRow key={item.id} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{item.name}</TableCell>
                          <TableCell style={{ width: 120 }}>
                            <TextField
                              type="number"
                              size="small"
                              value={item.price}
                              onChange={(e) => handlePriceChange(item.id, e.target.value)}
                              slotProps={{
                                htmlInput: { min: 0, step: 'any', style: { padding: '4px 8px' } }
                              }}
                            />
                          </TableCell>
                          <TableCell style={{ width: 110 }}>
                            <TextField
                              type="number"
                              size="small"
                              value={item.qty}
                              onChange={(e) => handleQtyChange(item.id, e.target.value)}
                              slotProps={{
                                htmlInput: { min: 1, step: 1, style: { padding: '4px 8px' } }
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{settings.currency}{parseFloat(item.total).toFixed(2)}</TableCell>
                          <TableCell align="right">
                            <IconButton size="small" color="error" onClick={() => handleRemoveItem(item.id)}>
                              <DeleteIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Clear & Return Buttons */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 2 }}>
                <Button 
                  variant="outlined" 
                  color="warning" 
                  onClick={() => setOpenReturnDialog(true)}
                  startIcon={<ReturnIcon />}
                  size="small"
                  sx={{ borderRadius: 1.5 }}
                >
                  Return Sale
                </Button>
                <Button 
                  variant="outlined" 
                  color="error" 
                  onClick={handleClearCart} 
                  startIcon={<ClearIcon />}
                  size="small"
                  sx={{ borderRadius: 1.5 }}
                >
                  Clear / New Sale
                </Button>
              </Box>
            </Card>
          </Box>

          {/* Right Side: Total & Checkout */}
          <Box sx={{ width: { xs: '100%', md: 'calc(30% - 12px)' }, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', p: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                Checkout Summary
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Stack spacing={2.5}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Autocomplete
                    options={customers}
                    getOptionLabel={(option) => `${option.name} ${option.phone ? `(${option.phone})` : ''}`}
                    value={selectedCustomer}
                    onChange={(event, newValue) => {
                      setSelectedCustomer(newValue);
                    }}
                    renderInput={(params) => (
                      <TextField 
                        {...params} 
                        label="Select Customer (Required for Credit)" 
                        size="small" 
                        placeholder="Search customer name/phone..." 
                      />
                    )}
                    sx={{ flexGrow: 1 }}
                  />
                  <IconButton 
                    color="primary" 
                    onClick={() => setOpenAddCustomerDialog(true)}
                    sx={{ 
                      border: '1px solid #e2e8f0', 
                      borderRadius: 1.5,
                      p: '8px',
                      '&:hover': { bgcolor: '#eff6ff', borderColor: '#bfdbfe' } 
                    }}
                  >
                    <AddIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Items Count:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{cart.reduce((sum, item) => sum + item.qty, 0)}</Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{settings.currency}{subtotal.toFixed(2)}</Typography>
                </Box>

                <TextField
                  label="Discount (%)"
                  type="number"
                  size="small"
                  fullWidth
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  slotProps={{
                    htmlInput: { min: 0, max: 100 }
                  }}
                />

                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Discount Amt:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#b91c1c' }}>
                    -{settings.currency}{finalDiscount.toFixed(2)}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: '1px solid #f1f5f9' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Total:</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1d4ed8' }}>
                    {settings.currency}{total.toFixed(2)}
                  </Typography>
                </Box>

                <TextField
                  label="Cash Received"
                  type="number"
                  size="small"
                  fullWidth
                  required
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                  inputProps={{ min: 0 }}
                  sx={{ mt: 1 }}
                />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1, bgcolor: '#f8fafc', px: 2, borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">Change:</Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#16a34a' }}>
                    {settings.currency}{change.toFixed(2)}
                  </Typography>
                </Box>

                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  disabled={loading || cart.length === 0 || (paid < total && !selectedCustomer)}
                  onClick={handleCheckout}
                  sx={{ py: 1.25, borderRadius: 2 }}
                >
                  {loading ? 'Processing...' : 'Pay / Checkout'}
                </Button>

                {lastSale && (
                  <Button
                    variant="outlined"
                    color="secondary"
                    fullWidth
                    startIcon={<PrintIcon />}
                    onClick={handlePrint}
                    sx={{ py: 1, borderRadius: 2 }}
                  >
                    Print Last Receipt
                  </Button>
                )}
              </Stack>
            </Card>


          </Box>
        </Box>
      </Box>

      {/* Return Sale Dialog */}
      <Dialog
        open={openReturnDialog}
        onClose={() => {
          if (!processingReturn) {
            setOpenReturnDialog(false);
            setReturnReceiptNo('');
            setSelectedReturnSale(null);
            setReturnItems({});
            setReturnError('');
          }
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          Return / Refund Sale
        </DialogTitle>
        <Divider sx={{ mx: 3 }} />
        <DialogContent sx={{ py: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {returnError && <Alert severity="error">{returnError}</Alert>}
          
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <TextField
              label="Receipt Number"
              placeholder="e.g. R-0001"
              size="small"
              value={returnReceiptNo}
              onChange={(e) => setReturnReceiptNo(e.target.value)}
              fullWidth
              disabled={processingReturn}
            />
            <Button 
              variant="contained" 
              onClick={handleFindSale}
              disabled={processingReturn || !returnReceiptNo.trim()}
              sx={{ height: 40 }}
            >
              Find
            </Button>
          </Box>

          {selectedReturnSale && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Sale Date: {new Date(selectedReturnSale.createdAt).toLocaleString()} | Original Total: {settings.currency}{selectedReturnSale.totalAmount.toFixed(2)}
              </Typography>
              
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 250, boxShadow: 'none' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" style={{ width: 40 }}></TableCell>
                      <TableCell>Item Name</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right" style={{ width: 100 }}>Return Qty</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedReturnSale.items.map((item) => {
                      const itemState = returnItems[item.id] || { selected: false, qty: 0 };
                      return (
                        <TableRow key={item.id} hover>
                          <TableCell padding="checkbox">
                            <input
                              type="checkbox"
                              checked={itemState.selected}
                              onChange={(e) => {
                                setReturnItems(prev => ({
                                  ...prev,
                                  [item.id]: {
                                    ...prev[item.id],
                                    selected: e.target.checked
                                  }
                                }));
                              }}
                              style={{ width: 18, height: 18, cursor: 'pointer' }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{item.name}</TableCell>
                          <TableCell align="right">{settings.currency}{item.price.toFixed(2)}</TableCell>
                          <TableCell align="right">
                            <TextField
                              type="number"
                              size="small"
                              value={itemState.qty}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setReturnItems(prev => ({
                                  ...prev,
                                  [item.id]: {
                                    ...prev[item.id],
                                    qty: Math.min(itemState.maxQty, Math.max(0, val))
                                  }
                                }));
                              }}
                              disabled={!itemState.selected}
                              slotProps={{
                                htmlInput: { min: 0, max: item.quantity, step: 1, style: { padding: '4px 8px', textAlign: 'right' } }
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, bgcolor: '#fef2f2', borderRadius: 1 }}>
                <Typography variant="subtitle2" color="error.main" sx={{ fontWeight: 700 }}>
                  Estimated Refund Total:
                </Typography>
                <Typography variant="h6" color="error.main" sx={{ fontWeight: 800 }}>
                  {settings.currency}
                  {Object.values(returnItems)
                    .filter(i => i.selected)
                    .reduce((sum, i) => sum + (i.price * i.qty), 0)
                    .toFixed(2)}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button 
            onClick={() => {
              setOpenReturnDialog(false);
              setReturnReceiptNo('');
              setSelectedReturnSale(null);
              setReturnItems({});
              setReturnError('');
            }} 
            color="inherit" 
            variant="outlined" 
            disabled={processingReturn}
            sx={{ borderRadius: 1.5 }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleProcessReturn} 
            variant="contained" 
            color="error"
            disabled={processingReturn || !selectedReturnSale || Object.values(returnItems).filter(i => i.selected && i.qty > 0).length === 0} 
            sx={{ borderRadius: 1.5 }}
          >
            {processingReturn ? 'Processing...' : 'Process Refund'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quick Add Customer Dialog */}
      <Dialog
        open={openAddCustomerDialog}
        onClose={() => {
          if (!addCustomerLoading) {
            setOpenAddCustomerDialog(false);
            setAddCustomerError('');
            setAddCustomerFormData({
              name: '',
              phone: '',
              email: '',
              address: '',
              loyaltyPoints: '0',
              balance: '0'
            });
          }
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          Add New Customer
        </DialogTitle>
        <Divider sx={{ mx: 3 }} />
        <form onSubmit={handleAddCustomerSubmit}>
          <DialogContent sx={{ py: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {addCustomerError && <Alert severity="error">{addCustomerError}</Alert>}
            <Stack spacing={3}>
              <TextField
                label="Customer Name"
                variant="standard"
                required
                fullWidth
                size="small"
                value={addCustomerFormData.name}
                onChange={(e) => setAddCustomerFormData({ ...addCustomerFormData, name: e.target.value })}
                disabled={addCustomerLoading}
              />
              <TextField
                label="Phone Number"
                variant="standard"
                fullWidth
                size="small"
                value={addCustomerFormData.phone}
                onChange={(e) => setAddCustomerFormData({ ...addCustomerFormData, phone: e.target.value })}
                disabled={addCustomerLoading}
              />
              <TextField
                label="Email Address"
                variant="standard"
                fullWidth
                type="email"
                size="small"
                value={addCustomerFormData.email}
                onChange={(e) => setAddCustomerFormData({ ...addCustomerFormData, email: e.target.value })}
                disabled={addCustomerLoading}
              />
              <TextField
                label="Home/Billing Address"
                variant="standard"
                fullWidth
                size="small"
                value={addCustomerFormData.address}
                onChange={(e) => setAddCustomerFormData({ ...addCustomerFormData, address: e.target.value })}
                disabled={addCustomerLoading}
              />
              <TextField
                label="Loyalty Program Points"
                variant="standard"
                fullWidth
                type="number"
                size="small"
                value={addCustomerFormData.loyaltyPoints}
                onChange={(e) => setAddCustomerFormData({ ...addCustomerFormData, loyaltyPoints: e.target.value })}
                disabled={addCustomerLoading}
              />
              <TextField
                label="Balance Owed (Credit)"
                variant="standard"
                fullWidth
                type="number"
                size="small"
                value={addCustomerFormData.balance}
                onChange={(e) => setAddCustomerFormData({ ...addCustomerFormData, balance: e.target.value })}
                disabled={addCustomerLoading}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => {
                setOpenAddCustomerDialog(false);
                setAddCustomerError('');
                setAddCustomerFormData({
                  name: '',
                  phone: '',
                  email: '',
                  address: '',
                  loyaltyPoints: '0',
                  balance: '0'
                });
              }}
              color="inherit"
              variant="outlined"
              disabled={addCustomerLoading}
              sx={{ borderRadius: 1.5 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={addCustomerLoading}
              sx={{ borderRadius: 1.5 }}
            >
              {addCustomerLoading ? 'Adding...' : 'Add Customer'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Global Cashier Notifications */}
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

export default POS;
