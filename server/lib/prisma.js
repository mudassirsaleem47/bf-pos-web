const { PrismaClient } = require('@prisma/client');
const { asyncLocalStorage } = require('../src/utils/storage');
const { logSync, getSyncing } = require('../src/utils/syncHelper');

const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Add middleware to log syncs automatically on all write queries
prisma.$use(async (params, next) => {
  const result = await next(params);

  // If we are currently in the middle of a sync pull, do not log
  if (getSyncing()) return result;

  const store = asyncLocalStorage.getStore();
  const userId = store ? store.userId : null;

  const writeActions = ['create', 'update', 'delete', 'deleteMany', 'updateMany', 'createMany'];
  if (writeActions.includes(params.action) && userId) {
    const model = params.model;
    const action = params.action;

    if (action === 'create' || action === 'update') {
      if (result && result.id) {
        logSync(model, result.id, action === 'create' ? 'create' : 'update', userId);
      }
    } else if (action === 'delete') {
      if (result && result.id) {
        logSync(model, result.id, 'delete', userId);
      }
    } else if (action === 'deleteMany') {
      const ids = params.args && params.args.where && params.args.where.id && params.args.where.id.in;
      if (ids && Array.isArray(ids)) {
        for (const id of ids) {
          logSync(model, id, 'delete', userId);
        }
      }
    }
  }

  return result;
});

module.exports = prisma;