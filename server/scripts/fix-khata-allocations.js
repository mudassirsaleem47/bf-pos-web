/*
 * One-time repair for customer khata data.
 *
 * Old code split every "All Dues" / receipt payment across sale invoices (FIFO) by
 * increasing sale.paidAmount. That made the ledger count the same money twice.
 * This script removes those allocations so sale.paidAmount again means
 * "amount paid at the counter for this bill".
 *
 * Nothing else changes: CustomerPayment rows and customer.balance are NOT touched.
 *
 * Usage (from the server folder):
 *   node scripts/fix-khata-allocations.js           -> preview only (no changes)
 *   node scripts/fix-khata-allocations.js --apply   -> write the changes
 */
const path = require('path');

let prisma;
const APPLY = process.argv.includes('--apply');
const EPS = 0.001;

/*
 * Returns Map(saleId -> repaired paidAmount).
 * sales: one customer's sales sorted oldest first. payments: that customer's positive payment rows.
 *
 * The old code added each payment into sale.paidAmount. We take those amounts back out:
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

const counterPaid = (s) => Math.min(Math.max(s.paidAmount || 0, 0), Math.max(s.totalAmount || 0, 0));

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
  const customers = await prisma.customer.findMany({
    include: { sales: { orderBy: { createdAt: 'asc' } } },
    orderBy: { name: 'asc' }
  });

  let payments = [];
  try {
    payments = await prisma.$queryRawUnsafe(`SELECT * FROM "CustomerPayment"`);
  } catch (err) {
    console.log('No CustomerPayment table found, nothing to repair.');
    return;
  }

  let changedSales = 0;

  for (const c of customers) {
    const custPayments = payments.filter(p => p.customerId === c.id && (p.amount || 0) > 0);
    if (custPayments.length === 0) continue;

    const newPaid = computeRepairedPaid(c.sales, custPayments);

    // Report
    const changes = c.sales.filter(s => Math.abs(newPaid.get(s.id) - (s.paidAmount || 0)) > EPS);
    const ledgerBalance =
      c.sales.reduce((sum, s) => sum + (s.totalAmount || 0) - counterPaid({ ...s, paidAmount: newPaid.get(s.id) }), 0) -
      payments.filter(p => p.customerId === c.id).reduce((sum, p) => sum + (p.amount || 0), 0);
    const diff = (c.balance || 0) - ledgerBalance;

    if (changes.length === 0 && Math.abs(diff) < 0.01) continue;

    console.log(`\n=== ${c.name} (balance ${c.balance.toFixed(2)}) ===`);
    for (const s of changes) {
      console.log(`  ${s.receiptNo}: paidAmount ${(s.paidAmount || 0).toFixed(2)} -> ${newPaid.get(s.id).toFixed(2)} (bill ${s.totalAmount.toFixed(2)})`);
    }
    if (Math.abs(diff) >= 0.01) {
      console.log(`  NOTE: ledger total differs from saved balance by ${diff.toFixed(2)} (opening balance / old adjustment). The ledger will show it as an "Opening Balance / Adjustment" line.`);
    }

    if (APPLY) {
      for (const s of changes) {
        await prisma.saleTransaction.update({
          where: { id: s.id },
          data: { paidAmount: Math.round(newPaid.get(s.id) * 100) / 100 }
        });
      }
    }
    changedSales += changes.length;
  }

  console.log(`\n${APPLY ? 'Updated' : 'Would update'} ${changedSales} sale(s).`);
  if (!APPLY) console.log('Preview only. Run again with --apply to save these changes.');
}

if (require.main === module) {
  main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma && prisma.$disconnect());
}

module.exports = { computeRepairedPaid };
