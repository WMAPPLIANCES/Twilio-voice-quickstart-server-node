// Carrega variáveis de ambiente do arquivo .env APENAS em ambiente de desenvolvimento local
// Em produção (Easypanel), as variáveis devem ser configuradas na plataforma.
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const twilio = require('twilio');
const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;
const VoiceResponse = twilio.twiml.VoiceResponse;

// --- Validação Inicial das Variáveis de Ambiente Essenciais ---
const requiredEnvVars = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_API_KEY_SID',
  'TWILIO_API_KEY_SECRET',
  'TWILIO_APP_SID',
  'TWILIO_NUMBER_MASK',
  // Adicione os SIDs de push se forem estritamente necessários para *todas* as operações
  // 'TWILIO_ANDROID_PUSH_CREDENTIAL_SID',
  // 'TWILIO_IOS_PUSH_CREDENTIAL_SID_DEBUG',
  // 'TWILIO_IOS_PUSH_CREDENTIAL_SID_RELEASE',
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('ERRO FATAL: Variáveis de ambiente ausentes:', missingEnvVars.join(', '));
  console.error('Por favor, configure essas variáveis no seu ambiente (Easypanel ou .env local).');
  process.exit(1); // Impede o servidor de iniciar sem configuração essencial
}

// --- Configuração das Credenciais (lidas do ambiente) ---
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN; // Usado pelo client Twilio se necessário, mas não para tokens JWT
const twilioApiKeySid = process.env.TWILIO_API_KEY_SID;
const twilioApiKeySecret = process.env.TWILIO_API_KEY_SECRET;
const twilioAppSid = process.env.TWILIO_APP_SID;
const twilioMaskingNumber = process.env.TWILIO_NUMBER_MASK;

// --- Inicialização do Express ---
const app = express();
// Middleware para parsear dados de formulário URL-encoded (usado pelo webhook do Twilio)
app.use(express.urlencoded({ extended: false }));
// Middleware para parsear JSON (útil se você tiver outros endpoints API)
app.use(express.json());

// --- Endpoint para Gerar Access Token (/generate-token) ---
app.get('/generate-token', (req, res) => {
  // Pega a identidade (ex: 'client:tecnico123') e plataforma do query param
  const identity = req.query.identity;
  const platform = req.query.platform; // 'ios', 'android', 'web', 'macos'
  // Verifica se o app está rodando em modo de produção (para selecionar o push credential correto do iOS)
  const isProduction = req.query.production === 'true';

  if (!identity) {
    console.warn('Requisição para /generate-token sem identity');
    return res.status(400).json({ error: 'Parâmetro "identity" é obrigatório.' });
  }
  if (!platform) {
    console.warn(`Requisição para /generate-token para ${identity} sem platform`);
    return res.status(400).json({ error: 'Parâmetro "platform" é obrigatório (ios, android, web, macos).' });
  }

  console.log(`Gerando token para identity: ${identity}, platform: ${platform}, production: ${isProduction}`);

  try {
    const pushCredentialSid = getPushCredentialSid(platform, isProduction);

    if (!pushCredentialSid && (platform === 'ios' || platform === 'android')) {
       console.error(`ERRO: Push Credential SID não encontrado/configurado para platform=${platform}, production=${isProduction}. Verifique as variáveis de ambiente.`);
       // Decide se quer retornar erro ou gerar token sem push (não receberá chamadas em background)
       // return res.status(500).json({ error: 'Configuração de Push Credential ausente no servidor.' });
    }

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twilioAppSid,
      // Inclui o push credential SID apenas se encontrado (essencial para Android/iOS background)
      ...(pushCredentialSid && { pushCredentialSid: pushCredentialSid })
    });

    // TTL (Time To Live) do token em segundos (1 hora = 3600) - Máximo 24h (86400)
    const tokenTTL = 3600;

    const token = new AccessToken(
      twilioAccountSid,
      twilioApiKeySid,
      twilioApiKeySecret,
      { identity: identity, ttl: tokenTTL }
    );

    token.addGrant(voiceGrant);
    const jwtToken = token.toJwt();

    console.log(`Token gerado com sucesso para ${identity}`);
    res.json({
        token: jwtToken,
        identity: identity,
        // Opcional: retornar expiração para o cliente saber quando renovar
        // expires_in: tokenTTL * 1000 // Em milissegundos
     });

  } catch (error) {
    console.error(`Erro ao gerar token para ${identity}:`, error);
    res.status(500).json({ error: 'Falha ao gerar o token de acesso.' });
  }
});

// --- Endpoint para Webhook de Chamada do Twilio (/make-call) ---
app.post('/make-call', (req, res) => {
  const from = req.body.From; // Quem está originando (ex: 'client:tecnico123' ou número se for chamada direta)
  const to = req.body.To;     // Para quem o Twilio foi instruído a ligar (ex: '+55119xxxxxxx')
  // Você pode pegar parâmetros extras passados pelo app aqui: const customParam = req.body.MeuParametroExtra;

  console.log(`Webhook /make-call recebido: From=${from}, To=${to}`);
  console.log(`Usando número de máscara: ${twilioMaskingNumber}`);

  const twiml = new VoiceResponse();

  // Verifica se o destino 'To' foi fornecido
  if (!to) {
    console.error('Webhook /make-call: Destino (To) não fornecido na requisição.');
    twiml.say({ language: 'pt-BR' }, 'Desculpe, o número de destino não foi fornecido.');
  } else {
    // Configura os atributos da discagem (Dial)
    const dialAttributes = {
      callerId: twilioMaskingNumber, // ESSENCIAL para o mascaramento
      // Outros atributos opcionais:
      // timeout: 30, // Tempo limite para atender (segundos)
      // record: 'record-from-answer-dual', // Gravar a chamada (verifique custos e privacidade)
      // trim: 'trim-silence', // Remover silêncio do início/fim da gravação
      // action: '/handle-dial-status', // URL para receber status da chamada (atendida, ocupada, etc.)
      // method: 'POST'
    };

    // Cria a instrução Dial
    const dial = twiml.dial(dialAttributes);

    // Determina se 'to' é um número de telefone (formato E.164) ou um client SIP/WebRTC
    // Para o caso de uso "técnico liga para cliente", 'to' geralmente será um número.
    if (to.startsWith('+') && to.length > 10) { // Validação básica de número E.164
      console.log(`Discando para NÚMERO: ${to}`);
      dial.number(to);
    } else if (to.startsWith('client:')) {
      console.log(`Discando para CLIENT: ${to}`);
      dial.client(to);
    } else {
      console.warn(`Webhook /make-call: Formato de destino (To) não reconhecido: ${to}`);
      twiml.say({ language: 'pt-BR' }, 'Desculpe, o formato do destino é inválido.');
    }
  }

  // Define o tipo de conteúdo da resposta como XML
  res.type('text/xml');
  // Envia a resposta TwiML gerada
  res.send(twiml.toString());
});

// --- Função Auxiliar para Obter Push Credential SID ---
function getPushCredentialSid(platform, isProduction) {
  platform = platform?.toLowerCase(); // Garante minúsculas

  if (platform === 'android') {
    return process.env.TWILIO_ANDROID_PUSH_CREDENTIAL_SID;
  } else if (platform === 'ios') {
    if (isProduction) {
      // Usa o de Release, ou o de Debug se o de Release não estiver configurado (fallback)
      return process.env.TWILIO_IOS_PUSH_CREDENTIAL_SID_RELEASE || process.env.TWILIO_IOS_PUSH_CREDENTIAL_SID_DEBUG;
    } else {
      // Usa o de Debug, ou o de Release se o de Debug não estiver configurado (fallback)
      return process.env.TWILIO_IOS_PUSH_CREDENTIAL_SID_DEBUG || process.env.TWILIO_IOS_PUSH_CREDENTIAL_SID_RELEASE;
    }
  }
  // Web e macOS (usando twilio.js) não usam Push Credential SIDs para receber chamadas via SDK JS
  // Eles usam WebSockets ou mecanismos similares gerenciados pelo SDK JS.
  return undefined;
}

// --- Rota de Health Check (Opcional, mas útil) ---
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// --- Inicialização do Servidor ---
const PORT = process.env.PORT || 3000; // Usa a porta definida pelo Easypanel ou 3000 como padrão
app.listen(PORT, () => {
  console.log(`Servidor Twilio Call Masking iniciado na porta ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log('Endpoints disponíveis:');
  console.log(`  GET /generate-token?identity=<client_id>&platform=<platform>&production=<true|false>`);
  console.log(`  POST /make-call (Webhook Twilio)`);
  console.log(`  GET /health (Health Check)`);
});
