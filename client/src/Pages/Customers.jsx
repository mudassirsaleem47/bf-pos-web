import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Grid,
  Alert,
  Snackbar,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Tabs,
  Tab,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  People as PeopleIcon,
  Star as StarIcon,
  LocalActivity as PromoIcon,
  AttachMoney as MoneyIcon,
  AccountBalanceWallet as WalletIcon,
  ReceiptLong as ReceiptIcon,
  Payments as PaymentIcon,
  History as HistoryIcon,
  CheckCircle as CheckCircleIcon,
  TrendingDown as DebitIcon,
  TrendingUp as CreditIcon
} from '@mui/icons-material';
import DataTable from '../Components/DataTable';

const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') ? import.meta.env.VITE_API_URL : window.location.origin);

// Sub-component for rendering full Customer Khaata Ledger
const CustomerLedgerView = ({ customer, currency, onOpenPayment }) => {
  const [activeTab, setActiveTab] = useState(0);

  const sales = customer.sales || [];
  const explicitPayments = customer.payments || [];

  const totalBilled = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const totalPaid = sales.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
  const currentBalance = customer.balance || 0;

  // Build comprehensive list of all payments (both explicit CustomerPayment records + checkout / settled payments on sales)
  const allPaymentRecords = [...explicitPayments];
  const explicitLinkedSaleIds = new Set(
    explicitPayments.filter(p => p.receiptId).map(p => p.receiptId)
  );

  // If explicit payments total is less than totalPaid across sales, include the checkout/settled payments
  const explicitTotal = explicitPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  if (explicitTotal < totalPaid - 0.01) {
    for (const sale of sales) {
      if ((sale.paidAmount || 0) > 0.001 && !explicitLinkedSaleIds.has(sale.id)) {
        allPaymentRecords.push({
          id: `checkout-pay-${sale.id}`,
          createdAt: sale.createdAt,
          amount: sale.paidAmount,
          paymentMethod: 'Cash (Checkout / Settlement)',
          receiptId: sale.id,
          receiptNo: sale.receiptNo,
          notes: `Paid at sale checkout / settlement for ${sale.receiptNo}`
        });
      }
    }
  }

  // Sort payments newest first for the Payments tab
  allPaymentRecords.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Build unified chronological ledger entries
  const ledgerEntries = [];

  // 1. Add all sales as Debit entries
  for (const sale of sales) {
    const itemsStr = sale.items && sale.items.length > 0
      ? sale.items.map(item => `${item.name} (x${item.quantity})`).join(', ')
      : 'Sale Invoice';

    ledgerEntries.push({
      id: `sale-${sale.id}`,
      rawDate: new Date(sale.createdAt),
      dateStr: new Date(sale.createdAt).toLocaleString(),
      type: 'SALE',
      typeLabel: 'Sale Invoice',
      ref: sale.receiptNo,
      details: itemsStr,
      debit: sale.totalAmount,
      credit: 0,
      saleObj: sale
    });
  }

  // 2. Add all payment records as Credit entries
  for (const p of allPaymentRecords) {
    ledgerEntries.push({
      id: `pay-${p.id}`,
      rawDate: new Date(p.createdAt),
      dateStr: new Date(p.createdAt).toLocaleString(),
      type: 'PAYMENT',
      typeLabel: 'Payment Received',
      ref: p.receiptNo ? `Ref: ${p.receiptNo}` : 'Account Payment',
      details: p.notes ? `${p.paymentMethod || 'Cash'}: ${p.notes}` : (p.paymentMethod || 'Cash Payment'),
      debit: 0,
      credit: p.amount,
      paymentObj: p
    });
  }

  // Sort chronological (oldest to newest for accurate running balance calculation)
  ledgerEntries.sort((a, b) => a.rawDate - b.rawDate);

  // Compute running balance
  let running = 0;
  const ledgerWithBalance = ledgerEntries.map(entry => {
    running = running + (entry.debit || 0) - (entry.credit || 0);
    return {
      ...entry,
      balanceAfter: Math.max(0, running)
    };
  });

  // For display, reverse to show newest first
  const displayTimeline = [...ledgerWithBalance].reverse();

  return (
    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
      {/* Customer Header Summary inside Ledger */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2 }}>
        <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
          <Box>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>
              Total Billed (Udhar / Sales)
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
              {currency} {totalBilled.toFixed(2)}
            </Typography>
          </Box>

          <Divider orientation="vertical" flexItem sx={{ height: 32 }} />

          <Box>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>
              Total Paid (Wasooli / Credit)
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#16a34a' }}>
              {currency} {totalPaid.toFixed(2)}
            </Typography>
          </Box>

          <Divider orientation="vertical" flexItem sx={{ height: 32 }} />

          <Box>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block' }}>
              Current Khata Balance (Baqaya)
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: currentBalance > 0 ? '#b91c1c' : '#16a34a' }}>
              {currency} {currentBalance.toFixed(2)}
            </Typography>
          </Box>
        </Stack>

        {currentBalance > 0 && (
          <Button
            variant="contained"
            color="success"
            size="small"
            startIcon={<MoneyIcon />}
            onClick={() => onOpenPayment(customer)}
            sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 600 }}
          >
            Receive Payment
          </Button>
        )}
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          textColor="primary"
          indicatorColor="primary"
          sx={{ minHeight: 38 }}
        >
          <Tab
            icon={<HistoryIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={`Ledger History (${displayTimeline.length})`}
            sx={{ minHeight: 38, py: 0.5, fontSize: '0.85rem', fontWeight: 600, textTransform: 'none' }}
          />
          <Tab
            icon={<ReceiptIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={`Sales Invoices (${sales.length})`}
            sx={{ minHeight: 38, py: 0.5, fontSize: '0.85rem', fontWeight: 600, textTransform: 'none' }}
          />
          <Tab
            icon={<PaymentIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={`Payments Received (${allPaymentRecords.length})`}
            sx={{ minHeight: 38, py: 0.5, fontSize: '0.85rem', fontWeight: 600, textTransform: 'none' }}
          />
        </Tabs>
      </Box>

      {/* Tab 0: Full Unified Ledger Timeline */}
      {activeTab === 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: '#fff', borderRadius: 1.5 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f1f5f9' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Date & Time</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Ref / Invoice</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Particulars / Details</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#b91c1c' }}>Debit (+Billed)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#15803d' }}>Credit (-Paid)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#0f172a' }}>Khata Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayTimeline.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3, color: '#64748b', fontStyle: 'italic' }}>
                    No ledger entries found for this customer.
                  </TableCell>
                </TableRow>
              ) : (
                displayTimeline.map((item) => {
                  const isSale = item.type === 'SALE';
                  return (
                    <TableRow key={item.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      <TableCell sx={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {item.dateStr}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          icon={isSale ? <DebitIcon sx={{ fontSize: 14 }} /> : <CreditIcon sx={{ fontSize: 14 }} />}
                          label={isSale ? 'Sale Bill' : 'Payment Received'}
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            bgcolor: isSale ? '#fef2f2' : '#f0fdf4',
                            color: isSale ? '#b91c1c' : '#15803d',
                            border: `1px solid ${isSale ? '#fecaca' : '#bbf7d0'}`
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem', color: '#1e293b' }}>
                        {item.ref}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.82rem', color: '#475569', maxWidth: 350 }}>
                        {item.details}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.85rem', color: isSale ? '#b91c1c' : '#94a3b8' }}>
                        {isSale ? `${currency} ${item.debit.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.85rem', color: !isSale ? '#15803d' : '#94a3b8' }}>
                        {!isSale ? `${currency} ${item.credit.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>
                        {currency} {item.balanceAfter.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Tab 1: Sales Invoices */}
      {activeTab === 1 && (
        <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: '#fff', borderRadius: 1.5 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f1f5f9' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Receipt #</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Date & Time</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Items Purchased</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#334155' }}>Total Bill</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#15803d' }}>Paid Amount</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#b91c1c' }}>Due Balance</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: '#334155' }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3, color: '#64748b', fontStyle: 'italic' }}>
                    No sales invoices found.
                  </TableCell>
                </TableRow>
              ) : (
                sales.map((sale) => {
                  const due = Math.max(0, sale.totalAmount - sale.paidAmount);
                  const isFullyPaid = due <= 0.001;
                  const itemsStr = sale.items && sale.items.length > 0
                    ? sale.items.map(item => `${item.name} (x${item.quantity})`).join(', ')
                    : 'No items recorded';

                  return (
                    <TableRow key={sale.id} hover>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem', color: '#1e293b' }}>
                        {sale.receiptNo}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {new Date(sale.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.82rem', color: '#475569', maxWidth: 350 }}>
                        {itemsStr}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                        {currency} {sale.totalAmount.toFixed(2)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.85rem', color: sale.paidAmount > 0 ? '#15803d' : '#64748b' }}>
                        {currency} {sale.paidAmount.toFixed(2)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.85rem', color: due > 0 ? '#b91c1c' : '#15803d' }}>
                        {due > 0 ? `${currency} ${due.toFixed(2)}` : 'Paid (0.00)'}
                      </TableCell>
                      <TableCell align="center">
                        {due > 0 ? (
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            startIcon={<MoneyIcon sx={{ fontSize: 14 }} />}
                            onClick={() => onOpenPayment(customer, sale)}
                            sx={{ fontSize: '0.72rem', py: 0.3, px: 1, textTransform: 'none' }}
                          >
                            Pay Due
                          </Button>
                        ) : (
                          <Chip size="small" icon={<CheckCircleIcon sx={{ fontSize: 14 }} />} label="Settled" color="success" variant="outlined" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Tab 2: Payments History */}
      {activeTab === 2 && (
        <TableContainer component={Paper} variant="outlined" sx={{ bgcolor: '#fff', borderRadius: 1.5 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f1f5f9' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Date & Time Received</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Payment Method</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Applied To / Ref</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Notes / Remarks</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#15803d' }}>Amount Received</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allPaymentRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3, color: '#64748b', fontStyle: 'italic' }}>
                    No payment records found for this customer.
                  </TableCell>
                </TableRow>
              ) : (
                allPaymentRecords.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell sx={{ fontSize: '0.8rem', color: '#1e293b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {new Date(p.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={p.paymentMethod || 'Cash'}
                        sx={{ fontSize: '0.72rem', fontWeight: 700, bgcolor: '#f0fdf4', color: '#15803d' }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.82rem', color: '#475569' }}>
                      {p.receiptNo ? `Receipt ${p.receiptNo}` : 'All Dues (FIFO Allocated)'}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.82rem', color: '#64748b' }}>
                      {p.notes || '-'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.85rem', color: '#15803d' }}>
                      {currency} {p.amount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

const Customers = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [currency, setCurrency] = useState('Rs.');

  // Form Dialog States
  const [openDialog, setOpenDialog] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    loyaltyPoints: '0',
    balance: '0'
  });

  // Delete Dialog States
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deleteIds, setDeleteIds] = useState([]);

  // Payment Dialog States
  const [openPaymentDialog, setOpenPaymentDialog] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState('ALL');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentError, setPaymentError] = useState('');

  const handleOpenPayment = (customer, specificSale = null) => {
    setPaymentCustomer(customer);
    setPaymentError('');
    setPaymentMethod('Cash');
    setPaymentNotes('');
    
    // Set current local datetime formatted for datetime-local input
    const now = new Date();
    const localIso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    setPaymentDate(localIso);

    if (specificSale) {
      setSelectedReceiptId(specificSale.id);
      const due = Math.max(0, specificSale.totalAmount - specificSale.paidAmount);
      setPaymentAmount(String(due > 0 ? due : 0));
    } else {
      setSelectedReceiptId('ALL');
      setPaymentAmount(String(customer.balance || 0));
    }
    setOpenPaymentDialog(true);
  };

  const handleReceiptSelectionChange = (receiptId) => {
    setSelectedReceiptId(receiptId);
    if (!paymentCustomer) return;
    if (receiptId === 'ALL') {
      setPaymentAmount(String(paymentCustomer.balance || 0));
    } else {
      const target = (paymentCustomer.sales || []).find(s => s.id === receiptId);
      if (target) {
        const due = Math.max(0, target.totalAmount - target.paidAmount);
        setPaymentAmount(String(due));
      }
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setPaymentError('');

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setPaymentError('Please enter a valid amount greater than 0.');
      return;
    }

    if (amt > (paymentCustomer.balance || 0) + 0.01) {
      setPaymentError(`Payment amount cannot exceed the owed balance of ${currency}${(paymentCustomer.balance || 0).toFixed(2)}.`);
      return;
    }

    if (selectedReceiptId !== 'ALL') {
      const target = (paymentCustomer.sales || []).find(s => s.id === selectedReceiptId);
      if (target) {
        const due = Math.max(0, target.totalAmount - target.paidAmount);
        if (amt > due + 0.01) {
          setPaymentError(`Payment amount cannot exceed the receipt due of ${currency}${due.toFixed(2)}.`);
          return;
        }
      }
    }

    const token = getToken();
    if (!token) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/customers/${paymentCustomer.id}/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: amt,
          receiptId: selectedReceiptId,
          paymentMethod,
          notes: paymentNotes.trim(),
          date: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString()
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update payment');
      }

      setSuccessMsg(`Payment of ${currency}${amt.toFixed(2)} received and logged in customer ledger!`);
      setOpenPaymentDialog(false);
      fetchCustomers();
    } catch (err) {
      setPaymentError(err.message || 'Failed to submit payment details');
    } finally {
      setLoading(false);
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

  const fetchSettings = async () => {
    try {
      const token = getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.currency) setCurrency(data.currency);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/customers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch customers');

      setCustomers(Array.isArray(data) ? data : []);
      setSelected([]);
    } catch (err) {
      setError(err.message || 'Something went wrong fetching customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchSettings();
  }, []);

  const handleOpenAdd = () => {
    setFormData({ name: '', phone: '', email: '', address: '', loyaltyPoints: '0', balance: '0' });
    setIsEdit(false);
    setEditId(null);
    setError('');
    setOpenDialog(true);
  };

  const handleOpenEdit = (customer) => {
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      loyaltyPoints: String(customer.loyaltyPoints || 0),
      balance: String(customer.balance || 0)
    });
    setIsEdit(true);
    setEditId(customer.id);
    setError('');
    setOpenDialog(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    const token = getToken();
    if (!token) return;

    setLoading(true);
    try {
      const url = isEdit ? `${API_URL}/api/customers/${editId}` : `${API_URL}/api/customers`;
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          address: formData.address.trim(),
          loyaltyPoints: parseInt(formData.loyaltyPoints) || 0,
          balance: parseFloat(formData.balance) || 0
        })
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to save customer');

      setSuccessMsg(isEdit ? 'Customer details updated successfully!' : 'Customer added successfully!');
      fetchCustomers();
      setOpenDialog(false);
    } catch (err) {
      setError(err.message || 'Failed to submit customer details');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async (ids) => {
    const token = getToken();
    if (!token) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/customers`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids })
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to delete customer(s)');

      setSuccessMsg('Customer(s) deleted successfully!');
      fetchCustomers();
      setOpenDeleteDialog(false);
      setSelected([]);
    } catch (err) {
      setError(err.message || 'Failed to delete customer(s)');
    } finally {
      setLoading(false);
    }
  };

  // Stats calculation
  const totalCustomers = customers.length;
  const totalLoyaltyPoints = customers.reduce((sum, c) => sum + (c.loyaltyPoints || 0), 0);
  const totalCustomerSales = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
  const totalReceivable = customers.reduce((sum, c) => sum + (c.balance || 0), 0);
  const creditCustomersCount = customers.filter(c => (c.balance || 0) > 0).length;

  const columns = [
    { id: 'name', label: 'Customer Name', sortable: true, cellSx: { fontWeight: 600, color: '#0f172a' } },
    { id: 'phone', label: 'Phone Number', sortable: true },
    { id: 'email', label: 'Email', sortable: true },
    { id: 'address', label: 'Address', sortable: false },
    {
      id: 'loyaltyPoints',
      label: 'Loyalty Points',
      sortable: true,
      render: (row) => (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <StarIcon sx={{ color: '#eab308', fontSize: 16 }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.loyaltyPoints}</Typography>
        </Stack>
      )
    },
    {
      id: 'balance',
      label: 'Balance (Owed)',
      sortable: true,
      render: (row) => (
        <Typography 
          variant="body2" 
          sx={{ 
            fontWeight: 700, 
            color: (row.balance || 0) > 0 ? '#b91c1c' : '#16a34a' 
          }}
        >
          {currency} {(row.balance || 0).toFixed(2)}
        </Typography>
      )
    },
    {
      id: 'totalSpent',
      label: 'Total Purchased',
      sortable: true,
      render: (row) => `${currency} ${(row.totalSpent || 0).toFixed(2)}`
    },
    { 
      id: 'visits', 
      label: 'Visits', 
      sortable: true,
      render: (row) => row.visits !== undefined ? row.visits : (row.sales?.length || 0)
    },
    {
      id: 'actions',
      label: 'Actions',
      sortable: false,
      render: (row) => (
        <Stack direction="row" spacing={0.5} alignItems="center" onClick={(e) => e.stopPropagation()}>
          {(row.balance || 0) > 0 && (
            <IconButton
              onClick={() => handleOpenPayment(row)}
              size="small"
              sx={{ color: '#16a34a', '&:hover': { color: '#15803d', bgcolor: '#f0fdf4' } }}
              title="Receive Payment"
            >
              <MoneyIcon sx={{ fontSize: 18 }} />
            </IconButton>
          )}
          <IconButton
            onClick={() => handleOpenEdit(row)}
            size="small"
            sx={{ color: '#64748b', '&:hover': { color: '#2563eb' } }}
            title="Edit Customer"
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

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', display: 'flex', flexDirection: 'column', gap: 3, fontFamily: '"Inter", sans-serif' }}>
      
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
          Customer Records &amp; Ledger
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleOpenAdd}
          sx={{ borderRadius: 2 }}
        >
          Add Customer
        </Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Summary Cards */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: '20px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#eff6ff', borderRadius: 1.5, display: 'flex', color: '#2563eb' }}>
                <PeopleIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Total Customers
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#0f172a' }}>
                  {totalCustomers}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: '20px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#fef9c3', borderRadius: 1.5, display: 'flex', color: '#ca8a04' }}>
                <StarIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Loyalty Points Awarded
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#0f172a' }}>
                  {totalLoyaltyPoints}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: '20px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#ecfdf5', borderRadius: 1.5, display: 'flex', color: '#10b981' }}>
                <PromoIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Customer Valuation
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#10b981' }}>
                  {currency} {totalCustomerSales.toFixed(2)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: '20px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#fef2f2', borderRadius: 1.5, display: 'flex', color: '#ef4444' }}>
                <MoneyIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Total Receivable
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#ef4444' }}>
                  {currency} {totalReceivable.toFixed(2)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2.4}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 1.5 }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, py: '20px !important' }}>
              <Box sx={{ p: 1.5, bgcolor: '#faf5ff', borderRadius: 1.5, display: 'flex', color: '#a855f7' }}>
                <WalletIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                  Debtors (Khata Holders)
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color: '#a855f7' }}>
                  {creditCustomersCount}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Customers Table */}
      <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          data={customers}
          loading={loading}
          selected={selected}
          onSelectedChange={setSelected}
          bulkActions={bulkActions}
          searchPlaceholder="Search customers..."
          storageKey="customers_table"
          renderExpandedRow={(row) => (
            <CustomerLedgerView
              customer={row}
              currency={currency}
              onOpenPayment={handleOpenPayment}
            />
          )}
        />
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          {isEdit ? 'Edit Customer' : 'Add New Customer'}
        </DialogTitle>
        <Divider sx={{ mx: 3 }} />
        <form onSubmit={handleFormSubmit}>
          <DialogContent sx={{ py: 3 }}>
            <Stack spacing={3}>
              <TextField
                label="Customer Name"
                variant="standard"
                required
                fullWidth
                size="small"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <TextField
                label="Phone Number"
                variant="standard"
                fullWidth
                size="small"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
              <TextField
                label="Email Address"
                variant="standard"
                fullWidth
                type="email"
                size="small"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <TextField
                label="Home/Billing Address"
                variant="standard"
                fullWidth
                size="small"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
              <TextField
                label="Loyalty Program Points"
                variant="standard"
                fullWidth
                type="number"
                size="small"
                value={formData.loyaltyPoints}
                onChange={(e) => setFormData({ ...formData, loyaltyPoints: e.target.value })}
              />
              <TextField
                label="Balance Owed (Credit)"
                variant="standard"
                fullWidth
                type="number"
                size="small"
                value={formData.balance}
                onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setOpenDialog(false)}
              color="inherit"
              variant="outlined"
              sx={{ borderRadius: 1.5 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              sx={{ borderRadius: 1.5 }}
            >
              {isEdit ? 'Save Changes' : 'Add Customer'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

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
            Are you sure you want to delete {deleteIds.length} selected customer(s)? This action cannot be undone.
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
            sx={{ borderRadius: 1.5, boxShadow: 'none', '&:hover': { boxShadow: 'none' } }}
          >
            Delete Customer(s)
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pay Owed Balance Dialog */}
      <Dialog
        open={openPaymentDialog}
        onClose={() => setOpenPaymentDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 1 }}>
          <MoneyIcon /> Receive Customer Payment
        </DialogTitle>
        <Divider sx={{ mx: 3 }} />
        <form onSubmit={handlePaymentSubmit}>
          <DialogContent sx={{ py: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {paymentError && <Alert severity="error">{paymentError}</Alert>}
            {paymentCustomer && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ bgcolor: '#f8fafc', p: 2, borderRadius: 1.5, border: '1px solid #e2e8f0' }}>
                  <Typography variant="body2" sx={{ color: '#475569', mb: 0.5 }}>
                    Customer Name: <strong style={{ color: '#0f172a' }}>{paymentCustomer.name}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#475569' }}>
                    Total Owed Balance: <strong style={{ color: '#dc2626' }}>{currency}{(paymentCustomer.balance || 0).toFixed(2)}</strong>
                  </Typography>
                </Box>

                <FormControl fullWidth size="small">
                  <InputLabel id="payment-target-label">Apply Payment To</InputLabel>
                  <Select
                    labelId="payment-target-label"
                    value={selectedReceiptId}
                    label="Apply Payment To"
                    onChange={(e) => handleReceiptSelectionChange(e.target.value)}
                  >
                    <MenuItem value="ALL">
                      <em>All Outstanding Balance (Auto-allocate FIFO from oldest)</em>
                    </MenuItem>
                    {(paymentCustomer.sales || [])
                      .filter(s => (s.totalAmount - s.paidAmount) > 0.001)
                      .map(s => {
                        const due = s.totalAmount - s.paidAmount;
                        return (
                          <MenuItem key={s.id} value={s.id}>
                            Receipt {s.receiptNo} — Due: {currency}{due.toFixed(2)} (Total: {currency}{s.totalAmount.toFixed(2)})
                          </MenuItem>
                        );
                      })}
                  </Select>
                </FormControl>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Amount to Pay"
                      type="number"
                      variant="outlined"
                      required
                      fullWidth
                      size="small"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      slotProps={{
                        htmlInput: { min: 0.01, step: 0.01 }
                      }}
                    />
                    <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          if (selectedReceiptId === 'ALL') {
                            setPaymentAmount(String(paymentCustomer.balance || 0));
                          } else {
                            const target = (paymentCustomer.sales || []).find(s => s.id === selectedReceiptId);
                            if (target) setPaymentAmount(String(Math.max(0, target.totalAmount - target.paidAmount)));
                          }
                        }}
                        sx={{ fontSize: '0.72rem', py: 0.2 }}
                      >
                        Pay Full Due
                      </Button>
                    </Stack>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="payment-method-label">Payment Method</InputLabel>
                      <Select
                        labelId="payment-method-label"
                        value={paymentMethod}
                        label="Payment Method"
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      >
                        <MenuItem value="Cash">Cash (Naqad)</MenuItem>
                        <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
                        <MenuItem value="EasyPaisa">EasyPaisa</MenuItem>
                        <MenuItem value="JazzCash">JazzCash</MenuItem>
                        <MenuItem value="Card">Debit / Credit Card</MenuItem>
                        <MenuItem value="Cheque">Cheque</MenuItem>
                        <MenuItem value="Other">Other</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Payment Date &amp; Time"
                      type="datetime-local"
                      variant="outlined"
                      fullWidth
                      size="small"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Notes / Reference (Optional)"
                      placeholder="e.g. Bank slip #, counter ref"
                      variant="outlined"
                      fullWidth
                      size="small"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                    />
                  </Grid>
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setOpenPaymentDialog(false)}
              color="inherit"
              variant="outlined"
              sx={{ borderRadius: 1.5 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="success"
              disabled={loading}
              sx={{ borderRadius: 1.5 }}
            >
              {loading ? 'Processing...' : `Receive Payment (${currency}${parseFloat(paymentAmount || 0).toFixed(2)})`}
            </Button>
          </DialogActions>
        </form>
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

export default Customers;
