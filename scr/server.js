// Load environment variables from .env file ONLY in local development environment
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const twilio = require('twilio');
const crypto = require('crypto');
const cors = require('cors'); // <--- 1. Importar o pacote cors

// --- Validação Inicial das Variáveis de Ambiente Essenciais ---
// ... (código de validação continua o mesmo) ...
const requiredEnvVars = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_NUMBER_MASK',
];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('FATAL ERROR: Missing environment variables:', missingEnvVars.join(', '));
  console.error('Please configure these variables in your environment (Easypanel or local .env).');
  process.exit(1);
}

// --- Configuração das Credenciais (lidas do ambiente) ---
// ... (código das credenciais continua o mesmo) ...
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioMaskingNumber = process.env.TWILIO_NUMBER_MASK;

// --- Inicialização do Cliente Twilio (para API REST) ---
const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

// --- Inicialização do Express ---
const app = express();

// --- Configuração do CORS --- <--- 2. Configurar e usar o middleware CORS
const corsOptions = {
  // Permite requisições APENAS da origem do seu app FlutterFlow web
  origin: 'https://web.wmappliances.app',
  // Métodos HTTP permitidos (ajuste se precisar de outros)
  methods: 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
  // Cabeçalhos permitidos (ajuste se seu app enviar outros cabeçalhos customizados)
  allowedHeaders: 'Content-Type, Authorization', // Adicione 'Authorization' se usar tokens
  // Necessário para algumas requisições preflight
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};
app.use(cors(corsOptions)); // Aplicar o middleware CORS com as opções

// --- Outros Middlewares (devem vir DEPOIS do CORS se ele for global) ---
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- Constante com a URL Base do seu serviço ---
const BASE_URL = 'https://phone.wmappliances.cloud';

// --- Definição das Rotas (Endpoints) ---

// Rota de Health Check (Opcional, mas útil)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Endpoint de Gatilho (Chamado pelo FlutterFlow)
app.post('/start-masked-call', async (req, res) => {
  // ... (o código deste endpoint continua o mesmo) ...
  const { technicianNumber, customerNumber } = req.body;
  console.log(`Received request to connect Technician (${technicianNumber}) and Customer (${customerNumber})`);
  if (!technicianNumber || !customerNumber) {
    console.error('Error: Technician or customer number not provided.');
    return res.status(400).json({ success: false, message: 'Technician and customer numbers are required.' });
  }
  const conferenceName = `conf_${crypto.randomUUID()}`;
  console.log(`Using conference room: ${conferenceName}`);
  try {
    console.log(`Initiating call to Technician: ${technicianNumber}`);
    const callToTechnician = await twilioClient.calls.create({ /* ... opções ... */
        to: technicianNumber, from: twilioMaskingNumber,
        url: `${BASE_URL}/handle-technician-answer?confName=${encodeURIComponent(conferenceName)}`,
        method: 'POST'});
    console.log(`Call to Technician initiated, SID: ${callToTechnician.sid}`);
    console.log(`Initiating call to Customer: ${customerNumber}`);
    const callToCustomer = await twilioClient.calls.create({ /* ... opções ... */
        to: customerNumber, from: twilioMaskingNumber,
        url: `${BASE_URL}/handle-customer-answer?confName=${encodeURIComponent(conferenceName)}`,
        method: 'POST'});
    console.log(`Call to Customer initiated, SID: ${callToCustomer.sid}`);
    res.status(200).json({ /* ... resposta ... */
        success: true, message: 'Calls to technician and customer initiated.',
        conferenceName: conferenceName, technicianCallSid: callToTechnician.sid,
        customerCallSid: callToCustomer.sid });
  } catch (error) { /* ... tratamento de erro ... */
    console.error('Error initiating calls via Twilio API:', error);
    const errorMessage = error.message || 'Internal server error initiating calls.';
    const errorStatus = error.status || 500;
    res.status(errorStatus).json({ success: false, message: errorMessage });
  }
});

// Endpoint TwiML chamado quando o TÉCNICO atende
app.post('/handle-technician-answer', (req, res) => {
  // ... (o código deste endpoint continua o mesmo) ...
  const conferenceName = req.query.confName;
  const callSid = req.body.CallSid;
  console.log(`Technician answered (CallSid: ${callSid}). Connecting to conference: ${conferenceName}`);
  if (!conferenceName) { /* ... tratamento de erro ... */
      console.error("Error: Conference name not received in technician's TwiML.");
      const twimlError = new twilio.twiml.VoiceResponse();
      twimlError.say({ language: 'en-US' }, 'An error occurred while connecting. Please try again.');
      twimlError.hangup();
      res.type('text/xml'); return res.send(twimlError.toString());
  }
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say({ language: 'en-US' }, 'Connecting you to the customer. Please wait.');
  const dial = twiml.dial();
  dial.conference(conferenceName);
  res.type('text/xml'); res.send(twiml.toString());
});

// Endpoint TwiML chamado quando o CLIENTE atende
app.post('/handle-customer-answer', (req, res) => {
  // ... (o código deste endpoint continua o mesmo) ...
   const conferenceName = req.query.confName;
   const callSid = req.body.CallSid;
   console.log(`Customer answered (CallSid: ${callSid}). Connecting to conference: ${conferenceName}`);
   if (!conferenceName) { /* ... tratamento de erro ... */
      console.error("Error: Conference name not received in customer's TwiML.");
      const twimlError = new twilio.twiml.VoiceResponse();
      twimlError.say({ language: 'en-US' }, 'An error occurred while connecting. Please try again.');
      twimlError.hangup();
      res.type('text/xml'); return res.send(twimlError.toString());
   }
   const twiml = new twilio.twiml.VoiceResponse();
   const dial = twiml.dial();
   dial.conference(conferenceName);
   res.type('text/xml'); res.send(twiml.toString());
});

// --- Inicialização do Servidor ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // ... (log de inicialização continua o mesmo) ...
  console.log(`Twilio API Call Masking server started on port ${PORT}`);
  console.log(`Base URL for Webhooks: ${BASE_URL}`);
  console.log('Available Endpoints:');
  console.log(`  POST ${BASE_URL}/start-masked-call (FlutterFlow Trigger)`);
  console.log(`  POST ${BASE_URL}/handle-technician-answer (TwiML Webhook)`);
  console.log(`  POST ${BASE_URL}/handle-customer-answer (TwiML Webhook)`);
  console.log(`  GET ${BASE_URL}/health (Health Check)`);
});
