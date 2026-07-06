import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Stack
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Help as GuideIcon,
  ShoppingCart as POSIcon,
  Inventory as ProductsIcon,
  RemoveShoppingCart as ExpiredIcon,
  Report as DeadStockIcon,
  ReceiptLong as InvoiceIcon,
  Settings as SettingsIcon,
  BarChart as ReportsIcon
} from '@mui/icons-material';

const Documentation = () => {
  const guides = [
    {
      title: 'POS (Point of Sale) Cashier',
      icon: <POSIcon sx={{ color: '#2563eb' }} />,
      desc: 'Learn how to checkout customers, scan barcodes, and issue print-friendly PDF receipts.',
      details: 'The POS screen allows real-time cashier checkout. You can select products from the grid search or type barcodes directly. Add discount percentages, select payment terms, input cash paid, and the system automatically calculates the balance change. Click checkout to instantly generate a printable PDF receipt and update stock levels in the local database.'
    },
    {
      title: 'Products Inventory Management',
      icon: <ProductsIcon sx={{ color: '#10b981' }} />,
      desc: 'Add new items, track stock quantities, print barcode stickers, and set expiration dates.',
      details: 'Navigate to the Products page to perform inventory entries. You can add unique barcodes (or click Generate to create a random EAN code), set pricing, stock quantity, packaging unit (e.g., pcs, kg, boxes), and category. You can also specify an Expiration Date. Click "Sticker" on any product to view its Code 39 barcode rendering and print a custom barcode sticker.'
    },
    {
      title: 'Expired Product Disposal',
      icon: <ExpiredIcon sx={{ color: '#ef4444' }} />,
      desc: 'How the system flags expired items in stock and handles write-off disposal.',
      details: 'The Expired Products module automatically checks all items in stock where the Expiration Date has passed. It filters out items with 0 stock. It displays statistics on total valuation loss and allows you to "Dispose" (reset stock to 0) individually or in bulk to clear damaged stock from active retail shelves.'
    },
    {
      title: 'Dead Stock Clearance',
      icon: <DeadStockIcon sx={{ color: '#eab308' }} />,
      desc: 'Identify slow-moving stock that has no sales in 30 days and apply discount promotions.',
      details: 'The Dead Stock page compares product inventory listings against sales logs over the last 30 days. Items that remain in stock with zero sales are flagged. You can quickly apply a promotional discount (e.g. 20% or 50% Off) to help clear them out, or write them off by disposing the remaining stock.'
    },
    {
      title: 'Suppliers & Supplier Invoices',
      icon: <InvoiceIcon sx={{ color: '#0891b2' }} />,
      desc: 'Record stock acquisitions, upload invoices, and track due balances.',
      details: 'When acquiring fresh stock, log a Supplier Invoice. Select the Supplier, target Warehouse, and Invoice Date. You can upload an image/PDF file of the physical invoice for filing. Add items purchased with quantity and rate. The system calculates due balances and lets you mark invoices as "Full Paid" or pay partially.'
    },
    {
      title: 'Operating Expenses & Receivables/Payables',
      icon: <SettingsIcon sx={{ color: '#ea580c' }} />,
      desc: 'Log warehouse rent, utility bills, employee payroll, and borrow/lend transactions.',
      details: 'Keep track of store outflows in the Expenses page. You can categorize costs (Rent, Utility, Payroll, Inventory, etc.) and record billing dates. In the Receivables & Payables page, track cash borrowings (Payables) or loans/credits given out (Receivables) to monitor net liabilities.'
    },
    {
      title: 'Analytical Reports',
      icon: <ReportsIcon sx={{ color: '#7c3aed' }} />,
      desc: 'View gross revenue, total expense drivers, profit/loss calculations, and print audit summaries.',
      details: 'The Reports page combines sales invoices, product inventory assets, and operating expenses to calculate net profitability. It visualizes top selling products, primary expense category distributions, and category asset valuations. Click the "Executive Summary" button to print a high-quality consolidated PDF audit.'
    }
  ];

  return (
    <Box sx={{ width: '100%', maxWidth: 'none', display: 'flex', flexDirection: 'column', gap: 3, fontFamily: '"Inter", sans-serif' }}>

      {/* Header */}
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
          User Documentation & Guides
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Help resources, functional flows, and procedures for using the BF Makeup ERP system.
        </Typography>
      </Box>

      {/* Guide Cards */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 1.5, height: '100%' }}>
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <GuideIcon sx={{ color: '#2563eb', fontSize: 28 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
                  ERP System Manual
                </Typography>
              </Stack>
              <Divider />
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                Welcome to BF Makeup. This manual provides detailed instructions on operating the point of sale (POS) cash register, inventory catalogs, supplier procurement, expired/dead stock monitoring, operational expense logging, and printing executive summary reports.
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto', display: 'block', bgcolor: '#f8fafc', p: 1.5, borderRadius: 1, border: '1px solid #e2e8f0', fontWeight: 600 }}>
                💡 Tip: Set up your Store Name, Tax Rate, and Local Currency in Settings first to customize receipt templates.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', borderRadius: 1.5 }}>
            <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #e2e8f0' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                Frequently Asked Operations & Guide Topics
              </Typography>
            </Box>
            <CardContent sx={{ p: 2 }}>
              {guides.map((guide, idx) => (
                <Accordion
                  key={idx}
                  disableGutters
                  elevation={0}
                  sx={{
                    border: 'none',
                    '&:before': { display: 'none' },
                    borderBottom: idx === guides.length - 1 ? 'none' : '1px solid #f1f5f9'
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ px: 2, py: 1, '&.Mui-expanded': { minHeight: 0 } }}
                  >
                    <Stack direction="row" spacing={2} alignItems="center">
                      {guide.icon}
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                          {guide.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
                          {guide.desc}
                        </Typography>
                      </Box>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 7, pb: 2.5, pt: 0.5 }}>
                    <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.6 }}>
                      {guide.details}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Documentation;
