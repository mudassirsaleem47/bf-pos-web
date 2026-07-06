const prisma = require('./lib/prisma');

async function clearDB() {
  try {
    console.log('Clearing database records...');
    
    const deletedSaleItems = await prisma.saleItem.deleteMany({});
    console.log('Deleted SaleItem records:', deletedSaleItems.count);
    
    const deletedSales = await prisma.saleTransaction.deleteMany({});
    console.log('Deleted SaleTransaction records:', deletedSales.count);
    
    const deletedProducts = await prisma.product.deleteMany({});
    console.log('Deleted Product records:', deletedProducts.count);
    
    const deletedCategories = await prisma.category.deleteMany({});
    console.log('Deleted Category records:', deletedCategories.count);
    
    const deletedCustomers = await prisma.customer.deleteMany({});
    console.log('Deleted Customer records:', deletedCustomers.count);

    const deletedExpenses = await prisma.expense.deleteMany({});
    console.log('Deleted Expense records:', deletedExpenses.count);

    console.log('Database records cleared successfully.');
  } catch (err) {
    console.error('Failed to clear database:', err);
  } finally {
    await prisma.$disconnect();
  }
}

clearDB();
