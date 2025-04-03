// server.js
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const { VoiceResponse } = require('twilio').twiml;
const { tokenGenerator, welcome, incoming } = require('./src/server');
const app = express();
const http = require('http');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', (req, res) => res.send(welcome()));
app.post('/', (req, res) => res.send(welcome()));

app.get('/accessToken', tokenGenerator);
app.post('/accessToken', tokenGenerator);

app.get('/incoming', (req, res) => res.send(incoming()));
app.post('/incoming', (req, res) => res.send(incoming()));

// Nova rota: conecta com cliente ao atender
app.get('/connect-client', (req, res) => {
  const to = req.query.to;
  const twiml = new VoiceResponse();
  const dial = twiml.dial();
  dial.number(to);
  res.type('text/xml');
  res.send(twiml.toString());
});

// Nova rota: inicia chamada ligando para empresa
app.post('/place-call', async (req, res) => {
  const to = req.body.to || req.query.to;
  const fromNumber = process.env.CALLER_NUMBER;
  const callbackUrl = req.protocol + '://' + req.get('host') + '/connect-client?to=' + encodeURIComponent(to);

  const client = require('twilio')(
    process.env.API_KEY,
    process.env.API_KEY_SECRET,
    { accountSid: process.env.ACCOUNT_SID }
  );

  try {
    const call = await client.calls.create({
      url: callbackUrl,
      to: fromNumber,
      from: fromNumber
    });
    res.send(call.sid);
  } catch (error) {
    console.error('Erro ao fazer a chamada:', error);
    res.status(500).send('Erro ao iniciar a chamada');
  }
});

const port = process.env.PORT || 3000;
http.createServer(app).listen(port, () => {
  console.log('Servidor rodando na porta *:' + port);
});


exports.placeCall = placeCall;
exports.incoming = incoming;
exports.welcome = welcome;
