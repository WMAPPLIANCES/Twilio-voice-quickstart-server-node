// twilio.js corrigido e mais robusto
const { VoiceResponse } = require('twilio').twiml;
const client = require('twilio')(
  process.env.API_KEY,
  process.env.API_KEY_SECRET,
  { accountSid: process.env.ACCOUNT_SID }
);

exports.placeCall = async (req, res) => {
  const fromNumber = req.body.from;
  const toNumber = req.body.to;

  console.log(`Iniciando chamada: ${fromNumber} -> ${toNumber}`);

  if (!fromNumber || !toNumber) {
    console.error('Erro: Parâmetros from ou to não fornecidos.');
    return res.status(400).send('Parâmetros "from" e "to" são obrigatórios.');
  }

  const callbackUrl = `${req.protocol}://${req.get('host')}/connect-client?to=${encodeURIComponent(toNumber)}`;

  try {
    const call = await client.calls.create({
      url: callbackUrl,
      to: fromNumber,
      from: fromNumber,
    });

    console.log('Chamada iniciada com sucesso, SID:', call.sid);
    res.status(200).json({ sid: call.sid });
  } catch (error) {
    console.error('Erro na criação da chamada:', error.message);
    res.status(500).send('Erro ao fazer chamada: ' + error.message);
  }
};

exports.connectClient = (req, res) => {
  const toNumber = req.query.to;
  const twiml = new VoiceResponse();
  const dial = twiml.dial();
  dial.number(toNumber);
  
  console.log(`Conectando ligação ao cliente: ${toNumber}`);

  res.type('text/xml');
  res.send(twiml.toString());
};
