const { PrismaClient } = require('@prisma/client');
const { asyncLocalStorage } = require('../src/utils/storage');
const { logSync, getSyncing } = require('../src/utils/syncHelper');

const globalForPrisma = global;

const basePrisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = basePrisma;
}

const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const result = await query(args);

        if (getSyncing()) return result;

        const store = asyncLocalStorage.getStore();
        const userId = store ? store.userId : null;

        const writeActions = ['create', 'update', 'delete', 'deleteMany', 'updateMany', 'createMany'];
        if (writeActions.includes(operation) && userId) {
          if (operation === 'create' || operation === 'update') {
            if (result && result.id) {
              logSync(model, result.id, operation === 'create' ? 'create' : 'update', userId);
            }
          } else if (operation === 'delete') {
            if (result && result.id) {
              logSync(model, result.id, 'delete', userId);
            }
          } else if (operation === 'deleteMany') {
            const ids = args && args.where && args.where.id && args.where.id.in;
            if (ids && Array.isArray(ids)) {
              for (const id of ids) {
                logSync(model, id, 'delete', userId);
              }
            }
          }
        }

        return result;
      }
    }
  }
});

module.exports = prisma;