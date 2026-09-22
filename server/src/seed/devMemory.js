/**
 * Zero-install dev mode: starts an in-memory MongoDB, seeds it and runs the API.
 * Data is lost on exit. Useful when no local MongoDB / Atlas is available.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('digital_heroes');
  const { connectDb } = require('../config/db');
  const { seed } = require('./seed');
  const app = require('../app');
  const config = require('../config');
  await connectDb(process.env.MONGODB_URI);
  await seed();
  app.listen(config.port, () => console.log(`API (in-memory DB) listening on :${config.port}`));
  const stop = async () => {
    await mongod.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
