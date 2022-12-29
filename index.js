import 'dotenv/config.js';

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

// connect to MondgoDB with mongoose
import('./config/database.js');

// import routes
import { router as authRouter } from './routes/auth.js';
import { router as profilesRouter } from './routes/profiles.js';

// create the express app
const app = express();
const port = process.env.PORT;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  cors({
    origin: '*',
    optionsSuccessStatus: 200,
    methods: 'GET, PUT, POST',
  })
);
app.use;
app.use(bodyParser.json());

// router middleware
app.use('api/auth', authRouter);
app.use('api/profiles', profilesRouter);

// catch 404
app.use(function (req, res, next) {
  res.status(404).json({ err: 'Not found!' });
});

app.use(function (err, req, res, next) {
  res.status(err.status || 500).json({ err: err.message });
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => console.log(`Server is listening on port ${port}`));
