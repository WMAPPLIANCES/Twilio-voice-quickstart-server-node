require('dotenv').config(); // Carrega variáveis do .env localmente
const express = require('express');
const twilio = require('twilio');
const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const VoiceResponse = twilio.twiml.VoiceResponse;

const app = express();
app.use(express.urlencoded({ extended: false })); // Para parsear dados do Twilio webhook

const PORT = process.env.PORT || 3000; // Easypanel define a PORTA

// --- Endpoint para Gerar Access Token ---
app.get('/generate-token', (req, res) => {
    // Idealmente, você validaria o usuário/técnico aqui antes de gerar
    const identity = req.query.identity; // Ex: 'client:tecnico123' passado pelo app
    const platform = req.query.platform; // 'ios' ou 'android' passado pelo app
    const isProduction = req.query.production === 'true'; // 'true' ou 'false' passado pelo app

    if (!identity || !platform) {
        return res.status(400).send('Missing identity or platform query parameter');
    }

    const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: process.env.TWILIO_APP_SID,
        // Define o Push Credential SID correto baseado na plataforma/ambiente
        pushCredentialSid: getPushCredentialSid(platform, isProduction)
    });

    const token = new AccessToken(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_API_KEY_SID,
        process.env.TWILIO_API_KEY_SECRET,
        { identity: identity, ttl: 3600 } // Token válido por 1 hora (ajuste conforme necessário)
    );

    token.addGrant(voiceGrant);

    console.log(`Generated token for ${identity} on ${platform}`);
    res.json({ token: token.toJwt() });
});

// --- Endpoint para o Webhook de Chamada do Twilio (Call Masking) ---
app.post('/make-call', (req, res) => {
    const twiml = new VoiceResponse();
    const callerId = process.env.TWILIO_NUMBER_MASK; // O número Twilio a ser exibido
    const to = req.body.To; // O número do cliente para quem ligar

    console.log(`Received call request from ${req.body.From} to ${to}`);
    console.log(`Masking with callerId: ${callerId}`);

    if (!to) {
        twiml.say('Desculpe, não foi fornecido um número de destino.');
    } else {
        // Verifica se 'to' é um número de telefone ou um client
        const dialAttributes = {
            callerId: callerId,
            // Outros atributos como 'timeout', 'record' podem ser adicionados aqui
            // Ex: record: "record-from-answer-dual"
        };

        const dial = twiml.dial(dialAttributes);

        // Assumindo que 'to' será sempre um número de telefone neste fluxo
        if (to.startsWith('+') || /^\d+$/.test(to)) {
             dial.number(to);
        } else {
             // Se pudesse ser um client: dial.client({}, to);
             twiml.say('Formato de destino inválido.'); // Ou lide com o erro de outra forma
        }
    }

    res.type('text/xml');
    res.send(twiml.toString());
});

// Função auxiliar para obter o Push Credential SID correto
function getPushCredentialSid(platform, isProduction) {
    if (platform === 'android') {
        return process.env.TWILIO_ANDROID_PUSH_CREDENTIAL_SID;
    } else if (platform === 'ios') {
        return isProduction
            ? process.env.TWILIO_IOS_PUSH_CREDENTIAL_SID_RELEASE
            : process.env.TWILIO_IOS_PUSH_CREDENTIAL_SID_DEBUG;
    }
    return undefined; // Ou lance um erro se a plataforma for desconhecida
}


app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
