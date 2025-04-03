require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const { VoiceResponse } = require('twilio').twiml;
const { tokenGenerator, welcome, incoming } = require('./src/server');
const app = express();
const http = require('http');

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Rotas básicas
app.get('/', (req, res) => res.send(welcome()));
app.post('/', (req, res) => res.send(welcome()));

app.get('/accessToken', tokenGenerator);
app.post('/accessToken', tokenGenerator);

app.get('/incoming', (req, res) => res.send(incoming()));
app.post('/incoming', (req, res) => res.send(incoming()));

// Rota para conectar com o cliente ao atender
function connectClient(req, res) {
  const to = req.query.to;
  const twiml = new VoiceResponse();
  const dial = twiml.dial();
  dial.number(to);
  res.type('text/xml');
  res.send(twiml.toString());
}
app.get('/connect-client', connectClient);

// Função separada para exportar corretamente
async function placeCall(req, res) {
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
}
app.post('/place-call', placeCall);

// Iniciar servidor
const port = process.env.PORT || 3000;
http.createServer(app).listen(port, () => {
  console.log('Servidor rodando na porta *:' + port);
});

// Exportações para testes ou reuso
exports.placeCall = placeCall;
exports.connectClient = connectClient;
exports.incoming = incoming;
exports.welcome = welcome;
