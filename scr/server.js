require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const { VoiceResponse } = require('twilio').twiml;
const app = express();
const http = require('http');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Conecta com o cliente
app.get('/connect-client', (req, res) => {
  const to = req.query.to;
  const twiml = new VoiceResponse();
  const dial = twiml.dial();
  dial.number(to);
  res.type('text/xml');
  res.send(twiml.toString());
});

// Faz a ligação para o técnico (from), depois conecta com o cliente (to)
app.post('/place-call', async (req, res) => {
  const { to, from } = req.body;

  if (!to || !from) {
    return res.status(400).send('❌ Campos "to" e "from" são obrigatórios');
  }

  const callbackUrl = req.protocol + '://' + req.get('host') + '/connect-client?to=' + encodeURIComponent(to);

  const client = require('twilio')(
    process.env.API_KEY,
    process.env.API_KEY_SECRET,
    { accountSid: process.env.ACCOUNT_SID }
  );

  try {
    const call = await client.calls.create({
      url: callbackUrl,
      to: from,         // técnico ou número fixo da empresa
      from: from        // caller ID (precisa ser verificado na Twilio)
    });
    console.log(`🔁 Ligando para técnico ${from}, depois conecta com cliente ${to}`);
    res.send(call.sid);
  } catch (error) {
    console.error('❌ Erro ao fazer a chamada:', error);
    res.status(500).send('Erro ao iniciar a chamada');
  }
});

const port = process.env.PORT || 3000;
http.createServer(app).listen(port, () => {
  console.log('✅ Servidor rodando na porta *:' + port);
});

