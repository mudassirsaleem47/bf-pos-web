const path = require('path');
const dotenv = require('dotenv');
// Load environment variables before importing app
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = require('./app');

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    
    // Start local sync daemon if running in Electron wrapper
    if (process.env.IS_ELECTRON === 'true') {
      console.log("[Sync] Local database detected, starting synchronization daemon.");
      const { runLocalSync } = require('./controllers/syncController');
      // Run sync every 30 seconds
      setInterval(async () => {
        try {
          await runLocalSync();
        } catch (err) {
          // Silent catch to prevent crashing local server on connection errors
        }
      }, 30000);
      // Run initial sync after 5 seconds
      setTimeout(async () => {
        runLocalSync().catch(() => {});
      }, 5000);
    }
  });
}

module.exports = app;