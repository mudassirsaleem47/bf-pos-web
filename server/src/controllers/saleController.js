const prisma = require('../../lib/prisma');

// Generate unique receipt number scoped to the user (handles deleted sales and collisions)
const generateReceiptNo = async (userId) => {
  const lastSales = await prisma.saleTransaction.findMany({
    where: { userId },
    select: { receiptNo: true }
  });

  let maxNum = 0;
  for (const s of lastSales) {
    if (s.receiptNo) {
      const match = s.receiptNo.match(/\d+$/);
      if (match) {
        const num = parseInt(match[0], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  let nextNum = maxNum + 1;
  while (true) {
    const candidate = `R-${String(nextNum).padStart(4, '0')}`;
    const exists = await prisma.saleTransaction.findUnique({
      where: {
        userId_receiptNo: {
          userId,
          receiptNo: candidate
        }
      }
    });
    if (!exists) {
      return candidate;
    }
    nextNum++;
  }
};

// @desc  Get all sales
// @route GET /api/sales
const getSales = async (req, res) => {
  try {
    const sales = await prisma.saleTransaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: { items: true, customer: true }
    });
    return res.status(200).json(sales);
  } catch (error) {
    console.error('Get sales error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Create a sale (POS checkout)
// @route POST /api/sales
const createSale = async (req, res) => {
  try {
    const { items, totalAmount, paidAmount, discount, tax, shipping, customerId, orderNo, notes } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items are required' });
    }

    const receiptNo = await generateReceiptNo(req.user.id);
    const total = parseFloat(totalAmount) || 0;
    const paid = parseFloat(paidAmount) || 0;
    const change = paid - total > 0 ? paid - total : 0;

    // Credit sale validation: requires a customer
    if (paid < total && !customerId) {
      return res.status(400).json({ message: 'Customer is required for credit transactions.' });
    }

    // Verify products belong to user and check stock availability
    for (const item of items) {
      if (item.productId) {
        const prod = await prisma.product.findFirst({
          where: { id: item.productId, userId: req.user.id }
        });
        if (!prod) {
          return res.status(400).json({ message: `Product not found or unauthorized: ${item.name}` });
        }
        const itemQty = parseFloat(item.quantity) || 0;
        // Only validate positive quantities (sales). Returns have negative quantities.
        if (itemQty > 0) {
          if (prod.stock <= 0) {
            return res.status(400).json({ message: `Product "${prod.name}" is out of stock (Available: 0). Cannot process sale.` });
          }
          if (prod.stock < itemQty) {
            return res.status(400).json({ message: `Insufficient stock for "${prod.name}". Available: ${prod.stock}, Requested: ${itemQty}.` });
          }
        }
      }
    }

    // Verify customer belongs to user if provided
    if (customerId) {
      const cust = await prisma.customer.findFirst({
        where: { id: customerId, userId: req.user.id }
      });
      if (!cust) {
        return res.status(400).json({ message: 'Customer not found or unauthorized.' });
      }
    }

    // Atomic transaction for sale creation, stock decrement, and customer khata update
    const sale = await prisma.$transaction(async (tx) => {
      // 1. Create Sale Transaction
      const newSale = await tx.saleTransaction.create({
        data: {
          receiptNo,
          orderNo: orderNo ? String(orderNo).trim() : null,
          notes: notes ? String(notes).trim() : null,
          totalAmount: total,
          paidAmount: paid,
          change,
          discount: parseFloat(discount) || 0,
          tax: parseFloat(tax) || 0,
          shipping: parseFloat(shipping) || 0,
          customerId: customerId || null,
          userId: req.user.id,
          items: {
            create: items.map(item => ({
              productId: item.productId || null,
              name: item.name,
              barcode: item.barcode || null,
              quantity: parseFloat(item.quantity) || 0,
              price: parseFloat(item.price) || 0,
              discount: parseFloat(item.discount) || 0,
              total: parseFloat(item.total) || 0,
            }))
          }
        },
        include: { items: true, customer: true }
      });

      // 2. Adjust Product Stock
      for (const item of items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                decrement: parseFloat(item.quantity) || 0
              }
            }
          });
        }
      }

      // 3. Update Customer balance if it is a credit sale
      if (customerId && total > paid) {
        const creditAmount = total - paid;
        await tx.customer.update({
          where: { id: customerId },
          data: {
            balance: {
              increment: creditAmount
            }
          }
        });
      }

      return newSale;
    }, { maxWait: 10000, timeout: 20000 });

    return res.status(201).json(sale);
  } catch (error) {
    console.error('Create sale error:', error);
    return res.status(500).json({ message: error.message || 'Server error creating sale' });
  }
};

// @desc  Bulk delete sales (void transactions, restore product stock & adjust customer balances)
// @route DELETE /api/sales
const deleteSales = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Sale IDs are required' });
    }

    // 1. Fetch sales with items to know which products and quantities to restore
    const salesToDelete = await prisma.saleTransaction.findMany({
      where: {
        id: { in: ids },
        userId: req.user.id
      },
      include: {
        items: true
      }
    });

    if (salesToDelete.length === 0) {
      return res.status(404).json({ message: 'No matching sales found to delete' });
    }

    await prisma.$transaction(async (tx) => {
      for (const sale of salesToDelete) {
        // 1. Restore product stock quantities
        for (const item of sale.items) {
          if (item.productId) {
            const product = await tx.product.findFirst({
              where: { id: item.productId, userId: req.user.id }
            });
            if (product) {
              const qty = parseFloat(item.quantity) || 0;
              await tx.product.update({
                where: { id: item.productId },
                data: {
                  stock: {
                    increment: qty
                  }
                }
              });
            }
          }
        }

        // 2. Adjust customer balance if this was a credit sale with unpaid due
        if (sale.customerId) {
          const dueAmount = Math.max(0, (sale.totalAmount || 0) - (sale.paidAmount || 0));
          if (dueAmount > 0.001) {
            const customer = await tx.customer.findFirst({
              where: { id: sale.customerId, userId: req.user.id }
            });
            if (customer) {
              const newBalance = Math.max(0, (customer.balance || 0) - dueAmount);
              await tx.customer.update({
                where: { id: sale.customerId },
                data: { balance: newBalance }
              });
            }
          }
        }

        // 3. Delete the sale transaction (items will cascade delete)
        await tx.saleTransaction.delete({
          where: { id: sale.id }
        });
      }
    }, { maxWait: 10000, timeout: 20000 });

    return res.status(200).json({ 
      message: `${salesToDelete.length} sale transaction(s) deleted and product stock restored successfully.` 
    });
  } catch (error) {
    console.error('Delete sales error:', error);
    return res.status(500).json({ message: 'Server error deleting sales' });
  }
};

// @desc  Process partial or full return for a sale
// @route POST /api/sales/:id/return
const returnSaleItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { returnedItems, refundMethod, notes } = req.body;

    if (!returnedItems || !Array.isArray(returnedItems) || returnedItems.length === 0) {
      return res.status(400).json({ message: 'Returned items are required' });
    }

    const sale = await prisma.saleTransaction.findFirst({
      where: { id, userId: req.user.id },
      include: { items: true, customer: true }
    });

    if (!sale) {
      return res.status(404).json({ message: 'Sale transaction not found' });
    }

    // Validate returned items against existing items
    let totalRefundAmount = 0;
    const itemsMap = new Map();
    for (const item of sale.items) {
      itemsMap.set(item.id, item);
    }

    for (const ret of returnedItems) {
      const orig = itemsMap.get(ret.saleItemId);
      if (!orig) {
        return res.status(400).json({ message: `Item not found in sale: ${ret.saleItemId}` });
      }
      const returnQty = parseFloat(ret.returnQuantity) || 0;
      if (returnQty <= 0) {
        continue;
      }
      if (returnQty > orig.quantity) {
        return res.status(400).json({ message: `Cannot return ${returnQty} of "${orig.name}". Only ${orig.quantity} purchased.` });
      }
      const unitPrice = orig.quantity > 0 ? (orig.total / orig.quantity) : orig.price;
      totalRefundAmount += unitPrice * returnQty;
    }

    if (totalRefundAmount <= 0) {
      return res.status(400).json({ message: 'No valid items or quantities selected for return' });
    }

    let updatedSale = null;

    await prisma.$transaction(async (tx) => {
      // 1. Process each returned item: restore stock and reduce saleItem qty
      for (const ret of returnedItems) {
        const orig = itemsMap.get(ret.saleItemId);
        const returnQty = parseFloat(ret.returnQuantity) || 0;
        if (returnQty <= 0) continue;

        // Restore product stock
        if (orig.productId) {
          await tx.product.update({
            where: { id: orig.productId },
            data: {
              stock: {
                increment: returnQty
              }
            }
          });
        }

        const unitPrice = orig.quantity > 0 ? (orig.total / orig.quantity) : orig.price;
        const itemRefund = unitPrice * returnQty;
        const remainingQty = orig.quantity - returnQty;
        const remainingTotal = Math.max(0, orig.total - itemRefund);

        if (remainingQty <= 0.0001) {
          // Entire item line returned
          await tx.saleItem.delete({
            where: { id: orig.id }
          });
        } else {
          // Partial item line returned
          await tx.saleItem.update({
            where: { id: orig.id },
            data: {
              quantity: remainingQty,
              total: remainingTotal
            }
          });
        }
      }

      // Check remaining items count in sale
      const remainingItems = await tx.saleItem.findMany({
        where: { saleId: sale.id }
      });

      const returnSummary = returnedItems
        .filter(r => (parseFloat(r.returnQuantity) || 0) > 0)
        .map(r => {
          const orig = itemsMap.get(r.saleItemId);
          return `${r.returnQuantity}x ${orig ? orig.name : 'item'}`;
        }).join(', ');

      const returnNote = `[Return on ${new Date().toLocaleDateString()}]: Returned ${returnSummary} (Refund: ${totalRefundAmount.toFixed(2)} via ${refundMethod || 'Cash'})${notes ? ` - ${notes}` : ''}`;

      if (remainingItems.length === 0) {
        // All items returned -> Sale is completely returned
        if (sale.customerId) {
          const dueAmount = Math.max(0, (sale.totalAmount || 0) - (sale.paidAmount || 0));
          if (dueAmount > 0) {
            const cust = await tx.customer.findFirst({ where: { id: sale.customerId } });
            if (cust) {
              const newBal = Math.max(0, (cust.balance || 0) - dueAmount);
              await tx.customer.update({
                where: { id: sale.customerId },
                data: { balance: newBal }
              });
            }
          }
        }

        // Delete sale transaction
        await tx.saleTransaction.delete({
          where: { id: sale.id }
        });

        updatedSale = { isFullyReturned: true, receiptNo: sale.receiptNo, totalRefundAmount };
      } else {
        // Partial sale remaining
        const newTotalAmount = Math.max(0, (sale.totalAmount || 0) - totalRefundAmount);
        
        let newPaidAmount = sale.paidAmount || 0;
        let customerBalanceAdjustment = 0;

        const originalDue = Math.max(0, (sale.totalAmount || 0) - (sale.paidAmount || 0));

        if (originalDue > 0 && sale.customerId) {
          // Was a credit/partial unpaid sale -> reduce customer debt
          const debtReduction = Math.min(originalDue, totalRefundAmount);
          customerBalanceAdjustment = debtReduction;
          const remainingRefund = totalRefundAmount - debtReduction;
          if (remainingRefund > 0 && refundMethod === 'cash') {
            newPaidAmount = Math.max(0, newPaidAmount - remainingRefund);
          }
        } else {
          // Was fully paid
          if (refundMethod === 'cash') {
            newPaidAmount = Math.max(0, (sale.paidAmount || 0) - totalRefundAmount);
          } else if (refundMethod === 'credit' && sale.customerId) {
            // Customer credit balance adjustment
            customerBalanceAdjustment = -totalRefundAmount;
          }
        }

        if (sale.customerId && customerBalanceAdjustment !== 0) {
          const cust = await tx.customer.findFirst({ where: { id: sale.customerId } });
          if (cust) {
            const newBal = Math.max(0, (cust.balance || 0) - customerBalanceAdjustment);
            await tx.customer.update({
              where: { id: sale.customerId },
              data: { balance: newBal }
            });
          }
        }

        const combinedNotes = sale.notes ? `${sale.notes}\n${returnNote}` : returnNote;

        updatedSale = await tx.saleTransaction.update({
          where: { id: sale.id },
          data: {
            totalAmount: newTotalAmount,
            paidAmount: Math.min(newPaidAmount, newTotalAmount),
            notes: combinedNotes
          },
          include: { items: true, customer: true }
        });
      }
    }, { maxWait: 10000, timeout: 20000 });

    return res.status(200).json({
      message: 'Return processed successfully',
      refundAmount: totalRefundAmount,
      sale: updatedSale
    });
  } catch (error) {
    console.error('Process return error:', error);
    return res.status(500).json({ message: error.message || 'Server error processing return' });
  }
};

module.exports = { getSales, createSale, deleteSales, returnSaleItems };
