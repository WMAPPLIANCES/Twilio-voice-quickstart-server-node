const { VoiceResponse } = require('twilio').twiml;
const AccessToken = require('twilio').jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

const defaultIdentity = 'alice';

function welcome() {
  const voiceResponse = new VoiceResponse();
  voiceResponse.say("Welcome to Twilio");
  return voiceResponse.toString();
}

function incoming() {
  const voiceResponse = new VoiceResponse();
  voiceResponse.say("Congratulations! You have received your first inbound call!");
  return voiceResponse.toString();
}

function tokenGenerator(request, response) {
  const identity = request.body.identity || request.query.identity || defaultIdentity;

  const token = new AccessToken(
    process.env.ACCOUNT_SID,
    process.env.API_KEY,
    process.env.API_KEY_SECRET
  );

  token.identity = identity;

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: process.env.APP_SID,
    pushCredentialSid: process.env.PUSH_CREDENTIAL_SID,
  });

  token.addGrant(voiceGrant);
  response.send(token.toJwt());
}

module.exports = { tokenGenerator, welcome, incoming };
