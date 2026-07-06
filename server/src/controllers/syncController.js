const prisma = require('../../lib/prisma');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const stateFilePath = path.join(__dirname, '../../../local_sync_state.json');

const getLocalSyncState = () => {
  if (fs.existsSync(stateFilePath)) {
    try {
      return JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
    } catch (e) {
      console.error("Error reading sync state file:", e);
    }
  }
  return { lastSyncTime: new Date(0).toISOString() };
};

const saveLocalSyncState = (state) => {
  fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2), 'utf8');
};

const runLocalSync = async () => {
  if (process.env.IS_ELECTRON !== 'true') return { message: "Sync client only runs on Electron" };

  const remoteUrl = process.env.REMOTE_API_URL || 'http://localhost:5000';
  
  try {
    // 1. Push Phase
    const localLogs = await prisma.syncLog.findMany({
      orderBy: { createdAt: 'asc' }
    });

    if (localLogs.length > 0) {
      console.log(`[Sync] Found ${localLogs.length} pending local logs to push.`);
      
      const payloadLogs = [];
      for (const log of localLogs) {
        const clientName = log.modelName.charAt(0).toLowerCase() + log.modelName.slice(1);
        let recordData = null;
        
        if (log.action === 'UPSERT') {
          let findArgs = { where: { id: log.recordId } };
          if (log.modelName === 'SaleTransaction' || log.modelName === 'SupplierInvoice') {
            findArgs.include = { items: true };
          }
          recordData = await prisma[clientName].findUnique(findArgs);
        }
        
        payloadLogs.push({
          id: log.id,
          modelName: log.modelName,
          recordId: log.recordId,
          action: log.action,
          data: recordData
        });
      }

      const pushRes = await axios.post(`${remoteUrl}/api/sync/push`, { logs: payloadLogs }, { timeout: 10000 });
      if (pushRes.data && pushRes.data.success) {
        const { processedLogIds } = pushRes.data;
        await prisma.syncLog.deleteMany({
          where: { id: { in: processedLogIds } }
        });
        console.log(`[Sync] Successfully pushed and cleared ${processedLogIds.length} logs.`);
      }
    }

    // 2. Pull Phase
    const syncState = getLocalSyncState();
    console.log(`[Sync] Pulling updates from remote server since: ${syncState.lastSyncTime}`);
    
    const pullRes = await axios.get(`${remoteUrl}/api/sync/pull`, {
      params: { since: syncState.lastSyncTime },
      timeout: 10000
    });

    if (pullRes.data) {
      const { updates, deletions, serverTime } = pullRes.data;
      
      global.isSyncing = true;
      
      try {
        // Apply deletions
        if (Array.isArray(deletions)) {
          for (const del of deletions) {
            const clientName = del.modelName.charAt(0).toLowerCase() + del.modelName.slice(1);
            const exists = await prisma[clientName].findUnique({ where: { id: del.recordId } });
            if (exists) {
              await prisma[clientName].delete({ where: { id: del.recordId } });
              console.log(`[Sync] Deleted local ${del.modelName} (ID: ${del.recordId})`);
            }
          }
        }

        // Apply updates
        for (const [clientName, records] of Object.entries(updates)) {
          const modelName = clientName.charAt(0).toUpperCase() + clientName.slice(1);
          for (const record of records) {
            if (modelName === 'SaleTransaction') {
              const { items, ...headerData } = record;
              await prisma.saleItem.deleteMany({ where: { saleId: record.id } });
              await prisma.saleTransaction.upsert({
                where: { id: record.id },
                create: {
                  ...headerData,
                  items: { create: (items || []).map(({ saleId, ...item }) => item) }
                },
                update: {
                  ...headerData,
                  items: { create: (items || []).map(({ saleId, ...item }) => item) }
                }
              });
            } else if (modelName === 'SupplierInvoice') {
              const { items, ...headerData } = record;
              await prisma.supplierInvoiceItem.deleteMany({ where: { invoiceId: record.id } });
              await prisma.supplierInvoice.upsert({
                where: { id: record.id },
                create: {
                  ...headerData,
                  items: { create: (items || []).map(({ invoiceId, ...item }) => item) }
                },
                update: {
                  ...headerData,
                  items: { create: (items || []).map(({ invoiceId, ...item }) => item) }
                }
              });
            } else {
              await prisma[clientName].upsert({
                where: { id: record.id },
                create: record,
                update: record
              });
            }
            console.log(`[Sync] Upserted local ${modelName} (ID: ${record.id})`);
          }
        }

        saveLocalSyncState({ lastSyncTime: serverTime });
        console.log(`[Sync] Completed pulling remote updates. Sync time updated to: ${serverTime}`);
      } finally {
        global.isSyncing = false;
      }
    }

    return { success: true };
  } catch (err) {
    console.error("[Sync] Sync failed:", err.message);
    throw err;
  }
};

const push = async (req, res) => {
  const { logs } = req.body;
  if (!Array.isArray(logs)) {
    return res.status(400).json({ message: "Invalid payload: 'logs' must be an array" });
  }

  const processedLogIds = [];
  global.isSyncing = true;

  try {
    for (const log of logs) {
      const { id: logId, modelName, recordId, action, data } = log;
      const clientName = modelName.charAt(0).toLowerCase() + modelName.slice(1);

      try {
        if (action === 'DELETE') {
          const exists = await prisma[clientName].findUnique({ where: { id: recordId } });
          if (exists) {
            await prisma[clientName].delete({ where: { id: recordId } });
          }
          await prisma.syncLog.create({
            data: { modelName, recordId, action: 'DELETE' }
          }).catch(err => console.error("Remote Sync delete logging failed:", err));

        } else if (action === 'UPSERT') {
          if (!data) continue;

          if (modelName === 'SaleTransaction') {
            const { items, ...headerData } = data;
            await prisma.saleItem.deleteMany({ where: { saleId: recordId } });
            await prisma.saleTransaction.upsert({
              where: { id: recordId },
              create: {
                ...headerData,
                items: {
                  create: items.map(item => ({
                    id: item.id,
                    productId: item.productId,
                    name: item.name,
                    barcode: item.barcode,
                    quantity: item.quantity,
                    price: item.price,
                    total: item.total
                  }))
                }
              },
              update: {
                ...headerData,
                items: {
                  create: items.map(item => ({
                    id: item.id,
                    productId: item.productId,
                    name: item.name,
                    barcode: item.barcode,
                    quantity: item.quantity,
                    price: item.price,
                    total: item.total
                  }))
                }
              }
            });
          } else if (modelName === 'SupplierInvoice') {
            const { items, ...headerData } = data;
            await prisma.supplierInvoiceItem.deleteMany({ where: { invoiceId: recordId } });
            await prisma.supplierInvoice.upsert({
              where: { id: recordId },
              create: {
                ...headerData,
                items: {
                  create: items.map(item => ({
                    id: item.id,
                    itemName: item.itemName,
                    quantity: item.quantity,
                    rate: item.rate,
                    total: item.total
                  }))
                }
              },
              update: {
                ...headerData,
                items: {
                  create: items.map(item => ({
                    id: item.id,
                    itemName: item.itemName,
                    quantity: item.quantity,
                    rate: item.rate,
                    total: item.total
                  }))
                }
              }
            });
          } else {
            await prisma[clientName].upsert({
              where: { id: recordId },
              create: data,
              update: data
            });
          }
        }
        processedLogIds.push(logId);
      } catch (err) {
        console.error(`Sync failed for log ${logId} (${modelName}):`, err);
      }
    }

    res.json({ success: true, processedLogIds });
  } catch (err) {
    console.error("Sync push error:", err);
    res.status(500).json({ message: "Sync push failed", error: err.message });
  } finally {
    global.isSyncing = false;
  }
};

const pull = async (req, res) => {
  const { since } = req.query;
  if (!since) {
    return res.status(400).json({ message: "Missing required query parameter: 'since'" });
  }

  const sinceDate = new Date(since);

  try {
    const syncableModels = [
      'user',
      'setting',
      'supplier',
      'category',
      'warehouse',
      'product',
      'saleTransaction',
      'supplierInvoice',
      'customer',
      'expense',
      'loan',
      'staff'
    ];

    const updates = {};

    for (const clientName of syncableModels) {
      let findArgs = {
        where: {
          updatedAt: {
            gt: sinceDate
          }
        }
      };

      if (clientName === 'saleTransaction') {
        findArgs.include = { items: true };
      } else if (clientName === 'supplierInvoice') {
        findArgs.include = { items: true };
      }

      const records = await prisma[clientName].findMany(findArgs);
      updates[clientName] = records;
    }

    const deletions = await prisma.syncLog.findMany({
      where: {
        action: 'DELETE',
        createdAt: {
          gt: sinceDate
        }
      }
    });

    res.json({
      updates,
      deletions,
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    console.error("Sync pull error:", err);
    res.status(500).json({ message: "Sync pull failed", error: err.message });
  }
};

const triggerSync = async (req, res) => {
  try {
    const result = await runLocalSync();
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Sync execution failed", error: err.message });
  }
};

const getStatus = async (req, res) => {
  try {
    const state = getLocalSyncState();
    const pendingCount = await prisma.syncLog.count();
    res.json({
      isElectron: process.env.IS_ELECTRON === 'true',
      lastSyncTime: state.lastSyncTime,
      pendingLocalChanges: pendingCount
    });
  } catch (err) {
    res.status(500).json({ message: "Status check failed", error: err.message });
  }
};

module.exports = {
  push,
  pull,
  triggerSync,
  getStatus,
  runLocalSync
};
