import 'dotenv/config.js';

import express from 'express';
import logger from 'morgan';
import cors from 'cors';

// import routes
import { router as authRouter } from './routes/auth.js';
import { router as profilesRouter } from './routes/profiles.js';

// connect to MondgoDB with mongoose
import('./config/database.js');

// create the express app
const app = express();

app.use(
  cors({
    origin: '*',
    optionsSuccessStatus: 200,
    methods: 'GET, PUT, POST',
  })
);
app.use(logger('dev'));
app.use(express.json());

// routes
app.use("/api/auth", authRouter);
app.use("/api/profiles", profilesRouter);

// catch 404
app.use(function (req, res, next) {
  res.status(404).json({ err: 'Not found!' });
});

app.use(function (err, req, res, next) {
  res.status(err.status || 500).json({ err: err.message });
});

export { app };
