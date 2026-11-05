/*
 * One-time repair for old customer ledger data (per user).
 *
 * Old code split every "All Dues" / receipt payment across sale invoices (FIFO) by
 * increasing sale.paidAmount. The ledger then counted the same money twice.
 * The repair takes those amounts back out so sale.paidAmount again means
 * "amount paid at the counter for this bill".
 *
 * Safety:
 *  - CustomerPayment rows and customer.balance are never changed.
 *  - Only payments with "ledgerV2" = false (made by the old code) are considered.
 *    New payments are saved with ledgerV2 = true, and after the repair all of the
 *    user's payments are marked ledgerV2 = true, so running it again changes nothing.
 */

const EPS = 0.001;
const NEW_ONLY_METHODS = ['Opening Balance', 'Balance Adjustment'];

/*
 * Returns Map(saleId -> repaired paidAmount).
 * sales: one customer's sales sorted oldest first. payments: that customer's old positive payment rows.
 *
 *  - a receipt-specific payment comes out of that receipt;
 *  - "All Dues" payments come out of sales that were updated after they were created
 *    (only those can have received money later), newest first. FIFO fills older bills
 *    completely, so the newest touched bill holds the last, partial piece.
 * The exact split per bill cannot always be known; the per-customer total is always right.
 */
function computeRepairedPaid(sales, payments) {
  const newPaid = new Map(sales.map(s => [s.id, s.paidAmount || 0]));

  let allDuesTotal = 0;
  for (const p of payments) {
    const sale = p.receiptId ? sales.find(s => s.id === p.receiptId) : null;
    if (sale) {
      const cur = newPaid.get(sale.id);
      newPaid.set(sale.id, cur - Math.min(p.amount, Math.max(cur, 0)));
    } else {
      allDuesTotal += p.amount;
    }
  }

  let remaining = allDuesTotal;
  for (const s of [...sales].reverse()) {
    if (remaining <= EPS) break;
    if ((s.totalAmount || 0) <= 0) continue;
    if ((s.change || 0) > EPS) continue;
    const touchedLater = new Date(s.updatedAt) - new Date(s.createdAt) > 5000;
    if (!touchedLater) continue;
    const cur = newPaid.get(s.id);
    if (cur <= EPS) continue;
    const strip = Math.min(remaining, cur);
    newPaid.set(s.id, cur - strip);
    remaining -= strip;
  }
  return newPaid;
}

const round2 = (n) => Math.round(n * 100) / 100;

// Build the list of sale changes for one user (does not write anything)
async function buildRepairPlan(prisma, userId) {
  const customers = await prisma.customer.findMany({
    where: { userId },
    include: { sales: { orderBy: { createdAt: 'asc' } } },
    orderBy: { name: 'asc' }
  });

  const oldPayments = await prisma.$queryRawUnsafe(
    `SELECT * FROM "CustomerPayment" WHERE "userId" = $1 AND "ledgerV2" = false`,
    userId
  );

  const plan = [];
  for (const c of customers) {
    const custPayments = oldPayments.filter(p =>
      p.customerId === c.id && (p.amount || 0) > 0 && !NEW_ONLY_METHODS.includes(p.paymentMethod)
    );
    if (custPayments.length === 0) continue;

    const newPaid = computeRepairedPaid(c.sales, custPayments);
    const changes = c.sales
      .filter(s => Math.abs(newPaid.get(s.id) - (s.paidAmount || 0)) > EPS)
      .map(s => ({
        saleId: s.id,
        receiptNo: s.receiptNo,
        totalAmount: s.totalAmount,
        oldPaid: round2(s.paidAmount || 0),
        newPaid: round2(newPaid.get(s.id))
      }));

    if (changes.length > 0) {
      plan.push({ customerId: c.id, customerName: c.name, oldPaymentsCount: custPayments.length, changes });
    }
  }
  return plan;
}

module.exports = { computeRepairedPaid, buildRepairPlan };
