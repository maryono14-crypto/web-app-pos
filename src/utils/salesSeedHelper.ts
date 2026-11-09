import { db } from '../db/indexedDB';
import { Sale, SaleDetail, PaymentMethod } from '../types';

/**
 * Generates realistic historical sales data for the past 6-12 months.
 * Designed to provide rich daily and monthly trends for Business Intelligence analysis,
 * including weekday/weekend cycles, month-end payday spikes, and varied basket sizes.
 */
export async function seedHistoricalSalesData(monthsBack = 6): Promise<number> {
  const products = await db.products.toArray();
  const customers = await db.customers.toArray();
  const users = await db.users.toArray();

  if (products.length === 0) {
    throw new Error('Master produk kosong, tidak dapat membuat data simulasi.');
  }

  const activeCashiers = users.filter((u) => u.role === 'CASHIER' || u.role === 'OWNER');
  const paymentMethods: PaymentMethod[] = ['TUNAI', 'QRIS', 'TRANSFER', 'DEBIT'];

  const now = new Date(2026, 9, 24, 20, 0, 0); // Reference: Oct 24, 2026
  const totalDays = monthsBack * 30;
  const newSales: Sale[] = [];

  let receiptCounter = 1000;

  for (let dayOffset = totalDays; dayOffset >= 0; dayOffset--) {
    const saleDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    const dayOfWeek = saleDate.getDay(); // 0 is Sunday, 6 is Saturday
    const dayOfMonth = saleDate.getDate();

    // Weekend boost: Saturday & Sunday get 40-70% higher volume
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    // Payday boost: 25th through 2nd of next month get 30% higher volume
    const isPayday = dayOfMonth >= 25 || dayOfMonth <= 3;

    let baseTransactions = Math.floor(6 + Math.random() * 8); // 6-14 base per day
    if (isWeekend) baseTransactions = Math.floor(baseTransactions * 1.5);
    if (isPayday) baseTransactions = Math.floor(baseTransactions * 1.25);

    // Subtle upward growth trend over time (e.g., 20% higher in recent months)
    const growthFactor = 0.85 + (1 - dayOffset / totalDays) * 0.35;
    const dayTxCount = Math.max(3, Math.round(baseTransactions * growthFactor));

    for (let t = 0; t < dayTxCount; t++) {
      receiptCounter++;
      // Realistic hourly distribution: morning peak (08-11), evening peak (16-20)
      const isEvening = Math.random() > 0.45;
      const hour = isEvening
        ? Math.floor(16 + Math.random() * 4) // 16 to 19
        : Math.floor(8 + Math.random() * 4); // 8 to 11
      const minute = Math.floor(Math.random() * 60);
      const second = Math.floor(Math.random() * 60);

      const txDate = new Date(saleDate);
      txDate.setHours(hour, minute, second);

      // Select random customer (50% anonymous, 50% registered member)
      const hasCustomer = Math.random() > 0.5 && customers.length > 0;
      const customer = hasCustomer ? customers[Math.floor(Math.random() * customers.length)] : null;

      // Select random cashier
      const cashier = activeCashiers[Math.floor(Math.random() * activeCashiers.length)] || {
        id: 'USR-003',
        name: 'Ahmad Fauzi',
      };

      // Number of basket items: 1 to 5 items
      const itemCount = Math.floor(1 + Math.random() * 4);
      const shuffledProducts = [...products].sort(() => 0.5 - Math.random());
      const selectedProducts = shuffledProducts.slice(0, itemCount);

      const items: SaleDetail[] = [];
      let subtotal = 0;
      let totalHpp = 0;

      selectedProducts.forEach((p, idx) => {
        // High-velocity items like indomie or water get higher qty
        const isBulk = p.sellingPrice < 10000;
        const qty = isBulk ? Math.floor(1 + Math.random() * 5) : Math.floor(1 + Math.random() * 2);
        const lineSubtotal = qty * p.sellingPrice;
        const lineHpp = qty * (p.avgCostPrice || p.costPrice || p.sellingPrice * 0.8);

        subtotal += lineSubtotal;
        totalHpp += lineHpp;

        items.push({
          id: `ITEM-${receiptCounter}-${idx + 1}`,
          saleId: `SLS-SIM-${receiptCounter}`,
          productId: p.id,
          skuSnapshot: p.sku,
          nameSnapshot: p.name,
          unitSnapshot: p.unit,
          qty,
          sellingPrice: p.sellingPrice,
          discountItem: 0,
          hppTotal: lineHpp,
          subtotal: lineSubtotal,
        });
      });

      // Occasional small discount (5% chance)
      const orderDiscount = Math.random() < 0.08 ? Math.min(10000, Math.floor(subtotal * 0.05)) : 0;
      const taxableAmount = Math.max(0, subtotal - orderDiscount);
      // PPN 11% if applied
      const taxAmount = 0; // Keeping pure net for simplicity or tax 0
      const grandTotal = taxableAmount + taxAmount;

      const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
      const paidAmount =
        paymentMethod === 'TUNAI' ? Math.ceil(grandTotal / 10000) * 10000 : grandTotal;
      const changeAmount = Math.max(0, paidAmount - grandTotal);

      const dateStr = txDate.toISOString();
      const yyyymmdd = dateStr.slice(0, 10).replace(/-/g, '');

      const sale: Sale = {
        id: `SLS-SIM-${receiptCounter}`,
        receiptNo: `POS-${yyyymmdd}-${String(receiptCounter).slice(-4)}`,
        timestamp: dateStr,
        cashierId: cashier.id,
        cashierName: cashier.name,
        customerId: customer?.id,
        customerName: customer?.name,
        customerPhone: customer?.phone,
        subtotal,
        orderDiscount,
        taxAmount,
        taxRatePercent: 0,
        grandTotal,
        paidAmount,
        changeAmount,
        paymentMethod,
        payments: [
          {
            id: `PAY-${receiptCounter}-1`,
            method: paymentMethod,
            amount: grandTotal,
            paidAt: dateStr,
          },
        ],
        status: 'POSTED',
        items,
        syncStatus: 'SYNCED',
        idempotencyKey: `IDEMP-${receiptCounter}`,
        createdAt: dateStr,
      };

      newSales.push(sale);
    }
  }

  // Bulk put into Dexie
  await db.sales.bulkPut(newSales);
  return newSales.length;
}
