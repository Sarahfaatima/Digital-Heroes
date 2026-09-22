const app = require('./app');
const config = require('./config');
const { connectDb } = require('./config/db');
const { ensureUpcomingDraw } = require('./services/drawService');

async function main() {
  await connectDb();
  console.log('MongoDB connected');
  await ensureUpcomingDraw();
  app.listen(config.port, () => console.log(`API listening on :${config.port}`));
}

main().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
