const express = require('express');
const router = express.Router();
const { VoiceResponse } = require('twilio').twiml;

router.get('/connect-client', (req, res) => {
  const to = req.query.to;
  const twiml = new VoiceResponse();
  const dial = twiml.dial();
  dial.number(to);
  res.type('text/xml');
  res.send(twiml.toString());
});

router.post('/place-call', async (req, res) => {
  const to = req.body.to || req.query.to;
  const technicianNumber = req.body.from || process.env.CALLER_NUMBER;

  const callbackUrl = `${req.protocol}://${req.get('host')}/connect-client?to=${encodeURIComponent(to)}`;

  const client = require('twilio')(
    process.env.API_KEY,
    process.env.API_KEY_SECRET,
    { accountSid: process.env.ACCOUNT_SID }
  );

  try {
    const call = await client.calls.create({
      url: callbackUrl,
      to: technicianNumber,
      from: process.env.CALLER_NUMBER,
    });
    res.send(call.sid);
  } catch (error) {
    console.error('Erro ao ligar:', error);
    res.status(500).send('Erro ao fazer chamada.');
  }
});

module.exports = router;
