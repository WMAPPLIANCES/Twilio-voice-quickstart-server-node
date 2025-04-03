require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { VoiceResponse } = require('twilio').twiml;
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send("Servidor ativo ✅");
});

app.post('/place-call', async (req, res) => {
  const { technicianNumber, customerNumber } = req.body;

  if (!technicianNumber || !customerNumber) {
    return res.status(400).send("Números faltando");
  }

  const client = require('twilio')(
    process.env.API_KEY,
    process.env.API_KEY_SECRET,
    { accountSid: process.env.ACCOUNT_SID }
  );

  const twimlUrl = `${req.protocol}://${req.get('host')}/connect-call?customerNumber=${encodeURIComponent(customerNumber)}`;

  try {
    const call = await client.calls.create({
      url: twimlUrl,
      to: technicianNumber,  // Liga para o técnico primeiro
      from: process.env.CALLER_NUMBER
    });

    console.log("Ligação iniciada:", call.sid);
    res.send({ callSid: call.sid });
  } catch (error) {
    console.error("Erro ao iniciar chamada:", error);
    res.status(500).send("Erro ao fazer chamada.");
  }
});

app.post('/connect-call', (req, res) => {
  const customerNumber = req.query.customerNumber;
  const twiml = new VoiceResponse();
  twiml.dial(customerNumber); // Conecta com o cliente após técnico atender
  res.type('text/xml');
  res.send(twiml.toString());
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
