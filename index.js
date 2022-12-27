const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { application } = require('express');
const app = express();
const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());
app.use(bodyParser.json());

app.get('/', (rwq, res) => {
  res.send('Hello World!');
});

app.listen(port, () => console.log(`Server is listening on port ${port}`));
