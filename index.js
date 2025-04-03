// index.js

const express = require('express');
const bodyParser = require('body-parser');
const { VoiceResponse } = require('twilio').twiml;
const twilio = require('twilio');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Rota principal de teste
app.get('/', (req, res) => res.send('Servidor ativo'));

// Rota para conectar com o cliente
app.get('/connect-client', (req, res) => {
  const to = req.query.to;
  const twiml = new VoiceResponse();
  const dial = twiml.dial();
  dial.number(to);
  res.type('text/xml');
  res.send(twiml.toString());
});

// Rota para iniciar a chamada: liga para a empresa e conecta ao cliente
app.post('/place-call', async (req, res) => {
  const clientNumber = req.body.to || req.query.to;
  const technicianNumber = req.body.from || process.env.CALLER_NUMBER;
  const callbackUrl = req.protocol + '://' + req.get('host') + '/connect-client?to=' + encodeURIComponent(clientNumber);

  const client = twilio(
    process.env.API_KEY,
    process.env.API_KEY_SECRET,
    { accountSid: process.env.ACCOUNT_SID }
  );

  try {
    const call = await client.calls.create({
      url: callbackUrl,
      to: technicianNumber,
      from: technicianNumber
    });
    res.send(call.sid);
  } catch (error) {
    console.error('Erro ao fazer a chamada:', error);
    res.status(500).send('Erro ao iniciar a chamada');
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`\u2705 Servidor rodando na porta ${port}`);
});

