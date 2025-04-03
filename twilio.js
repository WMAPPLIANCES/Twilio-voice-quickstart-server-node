const twilio = require('twilio');
const { VoiceResponse } = twilio.twiml;

const accountSid = process.env.ACCOUNT_SID;
const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_KEY_SECRET;

const client = twilio(apiKey, apiSecret, { accountSid });

/**
 * Gera um token de acesso para uso com Twilio Client (não obrigatório para chamadas normais).
 */
function tokenGenerator(request, response) {
  response.send({ token: 'Token generation not implemented here.' });
}

/**
 * Mensagem de boas-vindas simples.
 */
function welcome() {
  return '🟢 Servidor Twilio ativo.';
}

/**
 * Resposta de voz de teste para chamadas recebidas.
 */
function incoming() {
  const twiml = new VoiceResponse();
  twiml.say('Você está conectado à WM Appliances. Obrigado pela sua ligação.');
  return twiml.toString();
}

/**
 * Inicia a ligação: primeiro para o técnico/empresa (campo `from`), depois conecta ao cliente (`to`).
 */
async function placeCall(request, response) {
  const from = request.body.from;
  const to = request.body.to;

  if (!from || !to) {
    return response.status(400).send('Parâmetros "from" e "to" são obrigatórios.');
  }

  const callbackUrl = `${request.protocol}://${request.get('host')}/connect-client?to=${encodeURIComponent(to)}`;

  try {
    const call = await client.calls.create({
      url: callbackUrl,
      to: from,         // primeiro liga para a empresa/técnico
      from: from        // caller ID verificado (igual ao "to")
    });

    console.log(`🔁 Ligando para ${from}, depois conectando com ${to}`);
    response.send({ data: call.sid });
  } catch (err) {
    console.error('❌ Erro ao ligar:', err.message);
    response.status(500).send('Erro ao fazer chamada.');
  }
}

/**
 * Quando a empresa/técnico atende, conecta com o cliente.
 */
function connectClient(request, response) {
  const to = request.query.to;

  if (!to) {
    return response.status(400).send('Parâmetro "to" é obrigatório.');
  }

  const twiml = new VoiceResponse();
  const dial = twiml.dial();
  dial.number(to);

  response.type('text/xml');
  response.send(twiml.toString());
}

module.exports = {
  tokenGenerator,
  welcome,
  incoming,
  placeCall,
  connectClient,
};
