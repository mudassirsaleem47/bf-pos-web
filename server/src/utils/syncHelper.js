const prisma = require('../../lib/prisma');

// Global flag to prevent logging sync operations
let isSyncing = false;

const setSyncing = (val) => {
  isSyncing = val;
};

const logSync = async (modelName, recordId, action, userId = null) => {
  if (isSyncing) return;
  try {
    if (action === 'delete') {
      const existingCreate = await prisma.syncLog.findFirst({
        where: { modelName, recordId, action: 'create' }
      });
      
      if (existingCreate) {
        // Was created locally and not synced yet. Delete the create log.
        await prisma.syncLog.deleteMany({
          where: { modelName, recordId }
        });
      } else {
        // Was already synced or exists on cloud. Delete previous update logs and log the delete.
        await prisma.syncLog.deleteMany({
          where: { modelName, recordId }
        });
        await prisma.syncLog.create({
          data: { modelName, recordId, action, userId }
        });
      }
    } else {
      // For create/update, check if there's already a log
      const existing = await prisma.syncLog.findFirst({
        where: { modelName, recordId }
      });
      if (!existing) {
        await prisma.syncLog.create({
          data: { modelName, recordId, action, userId }
        });
      }
    }
  } catch (err) {
    console.error('Failed to log sync:', err);
  }
};

module.exports = {
  logSync,
  setSyncing,
  getSyncing: () => isSyncing
};
