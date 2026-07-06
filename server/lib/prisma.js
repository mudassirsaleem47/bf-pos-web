const { PrismaClient } = require('@prisma/client');

const basePrisma = new PrismaClient();
let prisma = basePrisma;

if (process.env.IS_ELECTRON === 'true') {
  prisma = basePrisma.$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          const result = await query(args);
          if (model !== 'SyncLog' && !global.isSyncing) {
            const clientName = model.charAt(0).toLowerCase() + model.slice(1);
            await basePrisma.syncLog.create({
              data: {
                modelName: model,
                recordId: result.id,
                action: 'UPSERT'
              }
            }).catch(err => console.error("Prisma Sync Logging error (create):", err));
          }
          return result;
        },
        async update({ model, args, query }) {
          const result = await query(args);
          if (model !== 'SyncLog' && !global.isSyncing) {
            await basePrisma.syncLog.create({
              data: {
                modelName: model,
                recordId: result.id,
                action: 'UPSERT'
              }
            }).catch(err => console.error("Prisma Sync Logging error (update):", err));
          }
          return result;
        },
        async delete({ model, args, query }) {
          if (model !== 'SyncLog' && !global.isSyncing) {
            const clientName = model.charAt(0).toLowerCase() + model.slice(1);
            try {
              const record = await basePrisma[clientName].findUnique({ where: args.where });
              if (record) {
                await basePrisma.syncLog.create({
                  data: {
                    modelName: model,
                    recordId: record.id,
                    action: 'DELETE'
                  }
                });
              }
            } catch (err) {
              console.error("Prisma Sync Logging error (delete):", err);
            }
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (model !== 'SyncLog' && !global.isSyncing) {
            const clientName = model.charAt(0).toLowerCase() + model.slice(1);
            try {
              const records = await basePrisma[clientName].findMany({ where: args.where });
              for (const record of records) {
                await basePrisma.syncLog.create({
                  data: {
                    modelName: model,
                    recordId: record.id,
                    action: 'DELETE'
                  }
                });
              }
            } catch (err) {
              console.error("Prisma Sync Logging error (deleteMany):", err);
            }
          }
          return query(args);
        }
      }
    }
  });
}

const globalForPrisma = global;
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}

module.exports = globalForPrisma.prisma;
