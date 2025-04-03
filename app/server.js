// Carrega variáveis de ambiente do arquivo .env APENAS em ambiente de desenvolvimento local
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const twilio = require('twilio');
const crypto = require('crypto'); // Para gerar IDs únicos para a conferência

// --- Validação Inicial das Variáveis de Ambiente Essenciais ---
// Para este fluxo, precisamos apenas do Account SID, Auth Token e o Número de Máscara
const requiredEnvVars = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_NUMBER_MASK',
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('ERRO FATAL: Variáveis de ambiente ausentes:', missingEnvVars.join(', '));
  console.error('Por favor, configure essas variáveis no seu ambiente (Easypanel ou .env local).');
  process.exit(1);
}

// --- Configuração das Credenciais (lidas do ambiente) ---
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN; // ESSENCIAL para a API REST
const twilioMaskingNumber = process.env.TWILIO_NUMBER_MASK; // Seu número Twilio comprado

// --- Inicialização do Cliente Twilio (para API REST) ---
const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

// --- Inicialização do Express ---
const app = express();
// Middleware para parsear JSON (para o endpoint de gatilho /iniciar-chamada-mascarada)
app.use(express.json());
// Middleware para parsear dados de formulário URL-encoded (usado pelos webhooks TwiML do Twilio)
app.use(express.urlencoded({ extended: false }));

// --- Constante com a URL Base do seu serviço ---
// Certifique-se que esta é a URL pública correta do seu serviço no Easypanel
const BASE_URL = 'https://phone.wmappliances.cloud';

// --- Endpoint de Gatilho (Chamado pelo FlutterFlow) ---
app.post('/iniciar-chamada-mascarada', async (req, res) => {
  const { tecnicoNumero, clienteNumero } = req.body;

  console.log(`Recebida solicitação para conectar Técnico (${tecnicoNumero}) e Cliente (${clienteNumero})`);

  // Validação básica dos números (adicione validações mais robustas se necessário)
  if (!tecnicoNumero || !clienteNumero) {
    console.error('Erro: Números do técnico ou cliente não fornecidos.');
    return res.status(400).json({ success: false, message: 'Números do técnico e cliente são obrigatórios.' });
  }
  // Adicione aqui validação de formato E.164 se desejar (ex: /^\+[1-9]\d{1,14}$/)

  // Gera um nome único para a sala de conferência desta sessão
  const conferenceName = `conf_${crypto.randomUUID()}`;
  console.log(`Usando sala de conferência: ${conferenceName}`);

  try {
    // 1. Iniciar chamada para o TÉCNICO
    console.log(`Iniciando chamada para o Técnico: ${tecnicoNumero}`);
    const callToTecnico = await twilioClient.calls.create({
      to: tecnicoNumero,
      from: twilioMaskingNumber,
      // URL que o Twilio chamará QUANDO o técnico atender
      // Passamos o nome da conferência como query parameter
      url: `${BASE_URL}/handle-tecnico-answer?confName=${encodeURIComponent(conferenceName)}`,
      method: 'POST', // Método que o Twilio usará para chamar a URL acima
      // Você pode adicionar um statusCallback para saber o status da chamada (ringing, answered, completed, etc.)
      // statusCallback: `${BASE_URL}/call-status`,
      // statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      // statusCallbackMethod: 'POST',
    });
    console.log(`Chamada para Técnico iniciada, SID: ${callToTecnico.sid}`);

    // 2. Iniciar chamada para o CLIENTE
    console.log(`Iniciando chamada para o Cliente: ${clienteNumero}`);
    const callToCliente = await twilioClient.calls.create({
      to: clienteNumero,
      from: twilioMaskingNumber, // IMPORTANTE: Usar o mesmo número de máscara
      // URL que o Twilio chamará QUANDO o cliente atender
      url: `${BASE_URL}/handle-cliente-answer?confName=${encodeURIComponent(conferenceName)}`,
      method: 'POST',
      // statusCallback: `${BASE_URL}/call-status`,
      // statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      // statusCallbackMethod: 'POST',
    });
    console.log(`Chamada para Cliente iniciada, SID: ${callToCliente.sid}`);

    // Responde ao FlutterFlow que as chamadas foram iniciadas
    res.status(200).json({
      success: true,
      message: 'Chamadas para técnico e cliente iniciadas.',
      conferenceName: conferenceName, // Opcional: retornar o nome da conferência
      tecnicoCallSid: callToTecnico.sid, // Opcional: retornar SIDs
      clienteCallSid: callToCliente.sid,
    });

  } catch (error) {
    console.error('Erro ao iniciar chamadas via API Twilio:', error);
    // Tenta pegar a mensagem de erro específica do Twilio, se disponível
    const errorMessage = error.message || 'Erro interno do servidor ao iniciar chamadas.';
    const errorStatus = error.status || 500;
    res.status(errorStatus).json({ success: false, message: errorMessage });
  }
});

// --- Endpoint TwiML chamado quando o TÉCNICO atende ---
app.post('/handle-tecnico-answer', (req, res) => {
  const conferenceName = req.query.confName; // Pega o nome da conferência do query param
  const callSid = req.body.CallSid; // SID da chamada do técnico

  console.log(`Técnico atendeu (CallSid: ${callSid}). Conectando à conferência: ${conferenceName}`);

  if (!conferenceName) {
      console.error("Erro: Nome da conferência não recebido no TwiML do técnico.");
      // Responde com erro, mas evita que a chamada caia imediatamente
      const twimlError = new twilio.twiml.VoiceResponse();
      twimlError.say({ language: 'pt-BR' }, 'Ocorreu um erro ao conectar. Por favor, tente novamente.');
      twimlError.hangup();
      res.type('text/xml');
      return res.send(twimlError.toString());
  }

  const twiml = new twilio.twiml.VoiceResponse();
  // Mensagem opcional para o técnico
  twiml.say({ language: 'pt-BR' }, 'Conectando você ao cliente. Por favor, aguarde.');

  // Conecta o técnico à conferência especificada
  const dial = twiml.dial();
  dial.conference(conferenceName);
  // Você pode adicionar atributos à conferência aqui, se necessário
  // Ex: startConferenceOnEnter=true, endConferenceOnExit=true (cuidado com este último)
  // dial.conference({ startConferenceOnEnter: true }, conferenceName);

  res.type('text/xml');
  res.send(twiml.toString());
});

// --- Endpoint TwiML chamado quando o CLIENTE atende ---
app.post('/handle-cliente-answer', (req, res) => {
  const conferenceName = req.query.confName; // Pega o nome da conferência do query param
  const callSid = req.body.CallSid; // SID da chamada do cliente

  console.log(`Cliente atendeu (CallSid: ${callSid}). Conectando à conferência: ${conferenceName}`);

   if (!conferenceName) {
      console.error("Erro: Nome da conferência não recebido no TwiML do cliente.");
      const twimlError = new twilio.twiml.VoiceResponse();
      twimlError.say({ language: 'pt-BR' }, 'Ocorreu um erro ao conectar. Por favor, tente novamente.');
      twimlError.hangup();
      res.type('text/xml');
      return res.send(twimlError.toString());
  }

  const twiml = new twilio.twiml.VoiceResponse();
  // NÃO coloque 'say' aqui, pois o cliente não deve ouvir nada antes de conectar

  // Conecta o cliente à MESMA conferência
  const dial = twiml.dial();
  dial.conference(conferenceName);
  // dial.conference({ startConferenceOnEnter: true }, conferenceName);

  res.type('text/xml');
  res.send(twiml.toString());
});

// --- Endpoint Opcional para Status da Chamada ---
// Descomente se precisar rastrear o status (precisa configurar statusCallback nas chamadas API)
/*
app.post('/call-status', (req, res) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus; // completed, busy, failed, no-answer, canceled
  const direction = req.body.Direction; // outbound-api (para este caso)
  const to = req.body.To;
  const duration = req.body.CallDuration; // Duração em segundos (se 'completed')

  console.log(`Status da Chamada (SID: ${callSid}, Direção: ${direction}, Para: ${to}): ${callStatus}`);
  if (callStatus === 'completed') {
    console.log(`  Duração: ${duration} segundos`);
  }

  // Adicione lógica aqui se precisar (ex: registrar no banco de dados)

  res.sendStatus(200); // Apenas confirma o recebimento para o Twilio
});
*/

// --- Rota de Health Check (Opcional, mas útil) ---
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// --- Inicialização do Servidor ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Twilio API Call Masking iniciado na porta ${PORT}`);
  console.log(`URL Base para Webhooks: ${BASE_URL}`);
  console.log('Endpoints disponíveis:');
  console.log(`  POST ${BASE_URL}/iniciar-chamada-mascarada (Gatilho FlutterFlow)`);
  console.log(`  POST ${BASE_URL}/handle-tecnico-answer (Webhook TwiML)`);
  console.log(`  POST ${BASE_URL}/handle-cliente-answer (Webhook TwiML)`);
  // console.log(`  POST ${BASE_URL}/call-status (Webhook Status Opcional)`);
  console.log(`  GET ${BASE_URL}/health (Health Check)`);
});
