const { VoiceResponse } = require('twilio').twiml;

function welcome() {
  return '🎉 Twilio Voice Server está rodando!';
}

function incoming() {
  const twiml = new VoiceResponse();
  twiml.say('Chamada recebida. Obrigado por ligar.');
  return twiml.toString();
}

function connectClient(req, res) {
  const to = req.query.to;
  const twiml = new VoiceResponse();
  const dial = twiml.dial();
  dial.number(to);
  res.type('text/xml');
  res.send(twiml.toString());
}

async function placeCall(req, res) {
  const to = req.body.to || req.query.to;
  const fromNumber = process.env.CALLER_NUMBER;

  const callbackUrl =
    req.protocol + '://' + req.get('host') + '/connect-client?to=' + encodeURIComponent(to);

  const client = require('twilio')(
    process.env.API_KEY,
    process.env.API_KEY_SECRET,
    { accountSid: process.env.ACCOUNT_SID }
  );

  try {
    const call = await client.calls.create({
      url: callbackUrl,
      to: fromNumber,
      from: fromNumber,
    });
    console.log(`📞 Ligando para técnico: ${fromNumber} -> Cliente: ${to}`);
    res.send(call.sid);
  } catch (err) {
    console.error('Erro ao ligar:', err);
    res.status(500).send('Erro ao fazer chamada.');
  }
}

module.exports = { welcome, incoming, connectClient, placeCall };
