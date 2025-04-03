require('dotenv').config(); // CORRIGIDO: ".load()" era inválido para dotenv

const { jwt: { AccessToken }, twiml: { VoiceResponse } } = require('twilio');
const VoiceGrant = AccessToken.VoiceGrant;

const defaultIdentity = 'alice';

// Use um número de telefone verificado na sua conta Twilio
const callerId = 'client:quick_start';
const callerNumber = process.env.CALLER_NUMBER || '+15103933334'; // Twilio test number ou seu número verificado

function tokenGenerator(request, response) {
  const identity = request.method === 'POST'
    ? request.body.identity || defaultIdentity
    : request.query.identity || defaultIdentity;

  const accountSid = process.env.ACCOUNT_SID;
  const apiKey = process.env.API_KEY;
  const apiSecret = process.env.API_KEY_SECRET;
  const outgoingApplicationSid = process.env.APP_SID;
  const pushCredSid = process.env.PUSH_CREDENTIAL_SID; // Pode estar vazio, se não usar Push

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid,
    pushCredentialSid: pushCredSid
  });

  const token = new AccessToken(accountSid, apiKey, apiSecret);
  token.addGrant(voiceGrant);
  token.identity = identity;

  console.log('Token:', token.toJwt());
  return response.send(token.toJwt());
}

function makeCall(request, response) {
  const to = request.method === 'POST' ? request.body.to : request.query.to;
  const voiceResponse = new VoiceResponse();

  if (!to) {
    voiceResponse.say("Congratulations! You have made your first call! Good bye.");
  } else if (isNumber(to)) {
    const dial = voiceResponse.dial({ callerId: callerNumber });
    dial.number(to);
  } else {
    const dial = voiceResponse.dial({ callerId });
    dial.client(to);
  }

  console.log('Response:', voiceResponse.toString());
  return response.send(voiceResponse.toString());
}

async function placeCall(request, response) {
  const to = request.method === 'POST' ? request.body.to : request.query.to;

  const url = `${request.protocol}://${request.get('host')}/incoming`;

  const accountSid = process.env.ACCOUNT_SID;
  const apiKey = process.env.API_KEY;
  const apiSecret = process.env.API_KEY_SECRET;
  const client = require('twilio')(apiKey, apiSecret, { accountSid });

  let call;

  try {
    if (!to) {
      call = await client.calls.create({
        url,
        to: `client:${defaultIdentity}`,
        from: callerId,
      });
    } else if (isNumber(to)) {
      call = await client.calls.create({
        url,
        to,
        from: callerNumber,
      });
    } else {
      call = await client.calls.create({
        url,
        to: `client:${to}`,
        from: callerId,
      });
    }

    console.log("Call SID:", call.sid);
    return response.send(call.sid);
  } catch (error) {
    console.error("Call Error:", error);
    return response.status(500).send(error.message);
  }
}

function incoming() {
  const voiceResponse = new VoiceResponse();
  voiceResponse.say("Congratulations! You have received your first inbound call! Goodbye.");
  console.log('Incoming Response:', voiceResponse.toString());
  return voiceResponse.toString();
}

function welcome() {
  const voiceResponse = new VoiceResponse();
  voiceResponse.say("Welcome to Twilio Voice App");
  console.log('Welcome Response:', voiceResponse.toString());
  return voiceResponse.toString();
}

function isNumber(to) {
  if (!to) return false;

  if (to.length === 1 && !isNaN(to)) return true;

  if (String(to).charAt(0) === '+') {
    return !isNaN(to.substring(1));
  }

  return !isNaN(to);
}

module.exports = {
  tokenGenerator,
  makeCall,
  placeCall,
  incoming,
  welcome
};

exports.placeCall = placeCall;
exports.incoming = incoming;
exports.welcome = welcome;
