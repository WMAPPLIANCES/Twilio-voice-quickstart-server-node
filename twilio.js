const { VoiceResponse } = require('twilio').twiml;
const client = require('twilio')(
  process.env.API_KEY,
  process.env.API_KEY_SECRET,
  { accountSid: process.env.ACCOUNT_SID }
);

exports.placeCall = async (req, res) => {
  const fromNumber = req.body.from;
  const toNumber = req.body.to;

  if (!fromNumber || !toNumber) {
    console.error('Parâmetros "from" ou "to" estão faltando.');
    return res.status(400).send('Parâmetros "from" e "to" são obrigatórios.');
  }

  const callbackUrl = `${req.protocol}://${req.get('host')}/connect-client?to=${encodeURIComponent(toNumber)}`;

  try {
    const call = await client.calls.create({
      url: callbackUrl,
      to: fromNumber,
      from: fromNumber,
    });
    res.status(200).send({ sid: call.sid });
    console.log(`Chamada iniciada com sucesso: ${call.sid}`);
  } catch (error) {
    console.error('Erro ao fazer a chamada:', error.message);
    res.status(500).send(`Erro: ${error.message}`);
  }
};

exports.connectClient = (req, res) => {
  const toNumber = req.query.to;
  const twiml = new VoiceResponse();
  const dial = twiml.dial();
  dial.number(toNumber);

  res.type('text/xml');
  res.send(twiml.toString());
  console.log(`Conectando cliente: ${toNumber}`);
};
