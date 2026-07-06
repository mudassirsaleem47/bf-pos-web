const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const warehouseRoutes = require('./routes/warehouseRoutes');
const supplierInvoiceRoutes = require('./routes/supplierInvoiceRoutes');
const { protect } = require('./middleware/authMiddleware');
const productRoutes = require('./routes/productRoutes');
const saleRoutes = require('./routes/saleRoutes');
const settingRoutes = require('./routes/settingRoutes');
const customerRoutes = require('./routes/customerRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const loanRoutes = require('./routes/loanRoutes');
const staffRoutes = require('./routes/staffRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');


const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded files statically
const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL; ``
const uploadsPath = isVercel
  ? path.join('/tmp', 'uploads')
  : path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/suppliers', protect, supplierRoutes);
app.use('/api/categories', protect, categoryRoutes);
app.use('/api/warehouses', protect, warehouseRoutes);
app.use('/api/supplier-invoices', protect, supplierInvoiceRoutes);
app.use('/api/products', protect, productRoutes);
app.use('/api/sales', protect, saleRoutes);
app.use('/api/settings', protect, settingRoutes);
app.use('/api/customers', protect, customerRoutes);
app.use('/api/expenses', protect, expenseRoutes);
app.use('/api/loans', protect, loanRoutes);
app.use('/api/staff', protect, staffRoutes);
app.use('/api/dashboard', protect, dashboardRoutes);


// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong on the server' });
});

module.exports = app;
