const prisma = require('./lib/prisma');

async function test() {
  try {
    // 1. Get a product
    const product = await prisma.product.findFirst();
    if (!product) {
      console.log('No product found, please add a product first');
      return;
    }
    console.log('Using Product:', product.name, 'ID:', product.id);

    // 2. Get a customer
    const customer = await prisma.customer.findFirst();
    if (!customer) {
      console.log('No customer found, please add a customer first');
      return;
    }
    console.log('Using Customer:', customer.name, 'ID:', customer.id);

    const total = 1000;
    const paid = 800;
    const receiptNo = 'T-' + Math.floor(Math.random() * 10000);

    console.log('Starting sequential updates...');

    // 1. Create Sale Transaction
    const createdSale = await prisma.saleTransaction.create({
      data: {
        receiptNo,
        totalAmount: total,
        paidAmount: paid,
        change: 0,
        discount: 0,
        tax: 0,
        customerId: customer.id,
        items: {
          create: [{
            productId: product.id,
            name: product.name,
            barcode: product.barcode,
            quantity: 1,
            price: total,
            total: total
          }]
        }
      },
      include: { items: true, customer: true }
    });
    console.log('SaleTransaction created successfully');

    // 2. Adjust Product Stock
    await prisma.product.update({
      where: { id: product.id },
      data: {
        stock: {
          decrement: 1
        }
      }
    });
    console.log('Product stock updated successfully');

    // 3. Update Customer balance if it is a credit sale
    if (customer.id && total > paid) {
      const creditAmount = total - paid;
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          balance: {
            increment: creditAmount
          }
        }
      });
      console.log('Customer balance updated successfully');
    }

    console.log('ALL UPDATES SUCCESS! Sale ID:', createdSale.id);
  } catch (err) {
    console.error('Operation FAILED with error:');
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
