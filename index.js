// index.js atualizado
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { placeCall, connectClient } = require('./twilio');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/place-call', placeCall);
app.get('/connect-client', connectClient);

app.get('/', (req, res) => {
  res.send('Servidor Twilio funcionando.');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
