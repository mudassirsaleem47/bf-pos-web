const prisma = require('../../lib/prisma');
const { ensurePaymentTableExists } = require('./customerController');
const { buildRepairPlan } = require('../utils/ledgerRepair');

// @desc  Preview the one-time customer ledger repair (no changes)
// @route GET /api/settings/ledger-repair
const previewLedgerRepair = async (req, res) => {
  try {
    await ensurePaymentTableExists();
    const plan = await buildRepairPlan(prisma, req.user.id);
    const salesCount = plan.reduce((sum, c) => sum + c.changes.length, 0);
    return res.status(200).json({ customers: plan, salesCount });
  } catch (error) {
    console.error('Ledger repair preview error:', error);
    return res.status(500).json({ message: 'Server error preparing ledger repair preview' });
  }
};

// @desc  Apply the one-time customer ledger repair
// @route POST /api/settings/ledger-repair
const applyLedgerRepair = async (req, res) => {
  try {
    await ensurePaymentTableExists();
    const userId = req.user.id;

    const salesCount = await prisma.$transaction(async (tx) => {
      // Build the plan inside the transaction so it matches what gets written
      const plan = await buildRepairPlan(tx, userId);
      let count = 0;
      for (const c of plan) {
        for (const ch of c.changes) {
          await tx.saleTransaction.update({
            where: { id: ch.saleId },
            data: { paidAmount: ch.newPaid }
          });
          count++;
        }
      }
      // Mark all of this user's payments as handled so the repair can never run twice
      await tx.$executeRawUnsafe(
        `UPDATE "CustomerPayment" SET "ledgerV2" = true WHERE "userId" = $1 AND "ledgerV2" = false`,
        userId
      );
      return count;
    }, { maxWait: 10000, timeout: 60000 });

    return res.status(200).json({
      message: salesCount > 0
        ? `Ledger repaired: ${salesCount} sale(s) updated.`
        : 'Nothing to repair. Ledger data is already up to date.',
      salesCount
    });
  } catch (error) {
    console.error('Ledger repair apply error:', error);
    return res.status(500).json({ message: 'Server error applying ledger repair' });
  }
};

module.exports = { previewLedgerRepair, applyLedgerRepair };
