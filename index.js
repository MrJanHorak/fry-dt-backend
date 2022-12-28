const dotenv = require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { application } = require('express');
const mongoose = require('mongoose');
const app = express();
const mongoDB = process.env.MONGO_DB;
const port = process.env.PORT;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(bodyParser.json());

mongoose.set('strictQuery', true);
mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true });

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));

app.get('/', (rwq, res) => {
  res.send('Hello World!');
});

app.listen(port, () => console.log(`Server is listening on port ${port}`));
