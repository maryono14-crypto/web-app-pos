import { db } from '../db/indexedDB';
import {
  CartItem,
  CostingMethod,
  FifoBatch,
  InventoryLog,
  Product,
  SaleDetail,
  StockMovementType,
} from '../types';

export interface ProcessCheckoutResult {
  saleDetails: SaleDetail[];
  totalHpp: number;
}

/**
 * Deduct inventory and calculate HPP according to FIFO or Moving Average
 */
export async function processSaleStockDeduction(
  items: CartItem[],
  saleId: string,
  userId: string,
  userName: string,
  method: CostingMethod
): Promise<ProcessCheckoutResult> {
  const saleDetails: SaleDetail[] = [];
  let grandHpp = 0;

  for (const item of items) {
    const product = await db.products.get(item.productId);
    if (!product) {
      throw new Error(`Produk tidak ditemukan: ${item.product.name}`);
    }

    if (product.currentStock < item.qty) {
      throw new Error(
        `Stok tidak mencukupi untuk "${product.name}". Stok tersedia: ${product.currentStock}, diminta: ${item.qty}`
      );
    }

    let lineHpp = 0;
    const batchesUsed: { batchId: string; qty: number; costPerUnit: number }[] = [];

    if (method === 'FIFO') {
      // Fetch active batches sorted by oldest date
      const activeBatches = await db.fifoBatches
        .where('productId')
        .equals(product.id)
        .filter((b) => b.status === 'ACTIVE' && b.remainingQty > 0)
        .sortBy('dateReceived');

      let neededQty = item.qty;

      for (const batch of activeBatches) {
        if (neededQty <= 0) break;

        const takeQty = Math.min(batch.remainingQty, neededQty);
        const batchCost = takeQty * batch.costPerUnit;
        lineHpp += batchCost;
        neededQty -= takeQty;

        batchesUsed.push({
          batchId: batch.id,
          qty: takeQty,
          costPerUnit: batch.costPerUnit,
        });

        const newRemaining = batch.remainingQty - takeQty;
        await db.fifoBatches.update(batch.id, {
          remainingQty: newRemaining,
          status: newRemaining === 0 ? 'DEPLETED' : 'ACTIVE',
        });
      }

      // If batches were exhausted but product currentStock had more (fallback)
      if (neededQty > 0) {
        const fallbackCost = neededQty * product.costPrice;
        lineHpp += fallbackCost;
      }
    } else {
      // Moving Average Method
      lineHpp = item.qty * (product.avgCostPrice || product.costPrice);
    }

    grandHpp += lineHpp;

    const newStock = product.currentStock - item.qty;
    await db.products.update(product.id, {
      currentStock: newStock,
      updatedAt: new Date().toISOString(),
    });

    // Record Inventory Log
    const log: InventoryLog = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      timestamp: new Date().toISOString(),
      type: 'PENJUALAN',
      qtyIn: 0,
      qtyOut: item.qty,
      balanceAfter: newStock,
      costValue: lineHpp,
      referenceId: saleId,
      userId,
      userName,
      note: `Penjualan kasir (${item.qty} ${product.unit})`,
    };
    await db.inventoryLogs.add(log);

    const subtotal = item.qty * item.sellingPrice - item.discountItem;

    saleDetails.push({
      id: `DTL-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      saleId,
      productId: product.id,
      skuSnapshot: product.sku,
      nameSnapshot: product.name,
      unitSnapshot: product.unit,
      qty: item.qty,
      sellingPrice: item.sellingPrice,
      discountItem: item.discountItem,
      hppTotal: lineHpp,
      subtotal,
      batchesUsed: batchesUsed.length > 0 ? batchesUsed : undefined,
    });
  }

  return { saleDetails, totalHpp: grandHpp };
}

/**
 * Handle receiving goods from a Purchase Order (FR-05 & FR-06)
 * Updates stock ONLY when goods receipt is posted!
 */
export async function receivePurchaseGoods(
  purchaseId: string,
  receivedItems: { productId: string; qtyReceived: number; costPerUnit: number }[],
  userId: string,
  userName: string,
  activeCostingMethod: CostingMethod
) {
  const purchase = await db.purchases.get(purchaseId);
  if (!purchase) throw new Error('Purchase Order tidak ditemukan.');

  for (const item of receivedItems) {
    if (item.qtyReceived <= 0) continue;

    const product = await db.products.get(item.productId);
    if (!product) continue;

    const oldStock = product.currentStock;
    const newStock = oldStock + item.qtyReceived;

    // 1. Moving Average calculation:
    // (OldStock * OldAvg + NewQty * NewCost) / (OldStock + NewQty)
    const oldAvg = product.avgCostPrice || product.costPrice;
    const newAvgCost =
      oldStock <= 0
        ? item.costPerUnit
        : Math.round((oldStock * oldAvg + item.qtyReceived * item.costPerUnit) / newStock);

    await db.products.update(product.id, {
      currentStock: newStock,
      costPrice: item.costPerUnit,
      avgCostPrice: newAvgCost,
      updatedAt: new Date().toISOString(),
    });

    // 2. Add FIFO Batch
    const newBatch: FifoBatch = {
      id: `BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: product.id,
      purchaseRefId: purchase.purchaseNo,
      dateReceived: new Date().toISOString(),
      initialQty: item.qtyReceived,
      remainingQty: item.qtyReceived,
      costPerUnit: item.costPerUnit,
      status: 'ACTIVE',
    };
    await db.fifoBatches.add(newBatch);

    // 3. Log mutation
    const log: InventoryLog = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      timestamp: new Date().toISOString(),
      type: 'PEMBELIAN',
      qtyIn: item.qtyReceived,
      qtyOut: 0,
      balanceAfter: newStock,
      costValue: item.qtyReceived * item.costPerUnit,
      referenceId: purchase.purchaseNo,
      userId,
      userName,
      note: `Penerimaan barang PO ${purchase.purchaseNo} (${item.qtyReceived} ${product.unit} @ Rp ${item.costPerUnit.toLocaleString('id-ID')})`,
    };
    await db.inventoryLogs.add(log);
  }

  // Mark purchase as RECEIVED
  await db.purchases.update(purchaseId, {
    status: 'RECEIVED',
    receivedDate: new Date().toISOString(),
  });

  // Audit log
  await db.auditLogs.add({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId,
    userName,
    action: 'RECEIVE_PURCHASE',
    category: 'INVENTORY',
    details: `Penerimaan barang untuk PO ${purchase.purchaseNo} berhasil diposting.`,
  });
}

/**
 * Handle stock adjustments / stock opname
 */
export async function adjustProductStock(
  productId: string,
  actualQty: number,
  reasonType: StockMovementType,
  notes: string,
  userId: string,
  userName: string
) {
  const product = await db.products.get(productId);
  if (!product) throw new Error('Produk tidak ditemukan');

  const diff = actualQty - product.currentStock;
  if (diff === 0) return;

  const isIncrease = diff > 0;
  const qtyIn = isIncrease ? diff : 0;
  const qtyOut = isIncrease ? 0 : Math.abs(diff);

  await db.products.update(productId, {
    currentStock: actualQty,
    updatedAt: new Date().toISOString(),
  });

  if (isIncrease) {
    // Add batch for increase
    await db.fifoBatches.add({
      id: `BATCH-ADJ-${Date.now()}`,
      productId,
      purchaseRefId: 'PENYESUAIAN',
      dateReceived: new Date().toISOString(),
      initialQty: qtyIn,
      remainingQty: qtyIn,
      costPerUnit: product.avgCostPrice || product.costPrice,
      status: 'ACTIVE',
    });
  } else {
    // Reduce from oldest batches if FIFO
    let needReduce = qtyOut;
    const batches = await db.fifoBatches
      .where('productId')
      .equals(productId)
      .filter((b) => b.status === 'ACTIVE' && b.remainingQty > 0)
      .sortBy('dateReceived');

    for (const b of batches) {
      if (needReduce <= 0) break;
      const reduceThis = Math.min(b.remainingQty, needReduce);
      const remaining = b.remainingQty - reduceThis;
      needReduce -= reduceThis;
      await db.fifoBatches.update(b.id, {
        remainingQty: remaining,
        status: remaining === 0 ? 'DEPLETED' : 'ACTIVE',
      });
    }
  }

  // Log
  await db.inventoryLogs.add({
    id: `LOG-ADJ-${Date.now()}`,
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    timestamp: new Date().toISOString(),
    type: reasonType,
    qtyIn,
    qtyOut,
    balanceAfter: actualQty,
    costValue: Math.abs(diff) * (product.avgCostPrice || product.costPrice),
    referenceId: `ADJ-${Date.now()}`,
    userId,
    userName,
    note: notes || `Penyesuaian stok (${isIncrease ? '+' : ''}${diff} ${product.unit})`,
  });

  await db.auditLogs.add({
    id: `AUD-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId,
    userName,
    action: 'STOCK_ADJUSTMENT',
    category: 'INVENTORY',
    details: `Penyesuaian stok produk ${product.name}: dari ${product.currentStock} menjadi ${actualQty} (${reasonType}). Alasan: ${notes}`,
  });
}
