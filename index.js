import 'dotenv/config.js';

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

// connect to MondgoDB with mongoose
import('./config/database.js');

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

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => console.log(`Server is listening on port ${port}`));
