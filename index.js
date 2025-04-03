require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { placeCall, connectClient } = require('./twilio');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => res.send('Servidor rodando corretamente.'));
app.post('/place-call', placeCall);
app.get('/connect-client', connectClient);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
