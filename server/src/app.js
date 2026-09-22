const express = require('express');
const cors = require('cors');
const config = require('./config');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');

// CORS: allow the configured client origins (comma separated CLIENT_URL). Also allows tools without an Origin header.
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || config.clientUrls.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: false,
  })
);
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' });
  next();
});

app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
