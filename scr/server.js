// Load environment variables from .env file ONLY in local development environment
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const twilio = require('twilio');
const crypto = require('crypto'); // To generate unique IDs for the conference

// --- Initial Validation of Essential Environment Variables ---
// For this flow, we only need Account SID, Auth Token, and the Masking Number
const requiredEnvVars = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_NUMBER_MASK',
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('FATAL ERROR: Missing environment variables:', missingEnvVars.join(', '));
  console.error('Please configure these variables in your environment (Easypanel or local .env).');
  process.exit(1); // Stop the server if essential config is missing
}

// --- Credential Configuration (read from environment) ---
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN; // ESSENTIAL for REST API
const twilioMaskingNumber = process.env.TWILIO_NUMBER_MASK; // Your purchased Twilio number

// --- Initialize Twilio Client (for REST API) ---
const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

// --- Initialize Express ---
const app = express();
// Middleware to parse JSON (for the trigger endpoint /start-masked-call)
app.use(express.json());
// Middleware to parse URL-encoded form data (used by Twilio TwiML webhooks)
app.use(express.urlencoded({ extended: false }));

// --- Constant with the Base URL of your service ---
// Make sure this is the correct public URL of your service on Easypanel
const BASE_URL = 'https://phone.wmappliances.cloud';

// --- Trigger Endpoint (Called by FlutterFlow) ---
app.post('/start-masked-call', async (req, res) => {
  // Use English variable names from request body
  const { technicianNumber, customerNumber } = req.body;

  console.log(`Received request to connect Technician (${technicianNumber}) and Customer (${customerNumber})`);

  // Basic number validation (add more robust validation if needed)
  if (!technicianNumber || !customerNumber) {
    console.error('Error: Technician or customer number not provided.');
    return res.status(400).json({ success: false, message: 'Technician and customer numbers are required.' });
  }
  // Add E.164 format validation here if desired (e.g., /^\+[1-9]\d{1,14}$/)

  // Generate a unique name for the conference room for this session
  const conferenceName = `conf_${crypto.randomUUID()}`;
  console.log(`Using conference room: ${conferenceName}`);

  try {
    // 1. Initiate call to the TECHNICIAN
    console.log(`Initiating call to Technician: ${technicianNumber}`);
    const callToTechnician = await twilioClient.calls.create({
      to: technicianNumber,
      from: twilioMaskingNumber,
      // URL Twilio will call WHEN the technician answers
      // Pass the conference name as a query parameter
      // Use the English endpoint name here
      url: `${BASE_URL}/handle-technician-answer?confName=${encodeURIComponent(conferenceName)}`,
      method: 'POST', // Method Twilio will use to call the URL above
      // You can add a statusCallback to know the call status (ringing, answered, completed, etc.)
      // statusCallback: `${BASE_URL}/call-status`,
      // statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      // statusCallbackMethod: 'POST',
    });
    console.log(`Call to Technician initiated, SID: ${callToTechnician.sid}`);

    // 2. Initiate call to the CUSTOMER
    console.log(`Initiating call to Customer: ${customerNumber}`);
    const callToCustomer = await twilioClient.calls.create({
      to: customerNumber,
      from: twilioMaskingNumber, // IMPORTANT: Use the same masking number
      // URL Twilio will call WHEN the customer answers
      // Use the English endpoint name here
      url: `${BASE_URL}/handle-customer-answer?confName=${encodeURIComponent(conferenceName)}`,
      method: 'POST',
      // statusCallback: `${BASE_URL}/call-status`,
      // statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      // statusCallbackMethod: 'POST',
    });
    console.log(`Call to Customer initiated, SID: ${callToCustomer.sid}`);

    // Respond to FlutterFlow that calls have been initiated
    res.status(200).json({
      success: true,
      message: 'Calls to technician and customer initiated.',
      conferenceName: conferenceName, // Optional: return conference name
      technicianCallSid: callToTechnician.sid, // Optional: return SIDs
      customerCallSid: callToCustomer.sid,
    });

  } catch (error) {
    console.error('Error initiating calls via Twilio API:', error);
    // Try to get the specific Twilio error message, if available
    const errorMessage = error.message || 'Internal server error initiating calls.';
    const errorStatus = error.status || 500;
    res.status(errorStatus).json({ success: false, message: errorMessage });
  }
});

// --- TwiML Endpoint called when the TECHNICIAN answers ---
app.post('/handle-technician-answer', (req, res) => {
  const conferenceName = req.query.confName; // Get conference name from query param
  const callSid = req.body.CallSid; // SID of the technician's call leg

  console.log(`Technician answered (CallSid: ${callSid}). Connecting to conference: ${conferenceName}`);

  if (!conferenceName) {
      console.error("Error: Conference name not received in technician's TwiML.");
      // Respond with error, but prevent the call from dropping immediately
      const twimlError = new twilio.twiml.VoiceResponse();
      // Use English for the voice message
      twimlError.say({ language: 'en-US' }, 'An error occurred while connecting. Please try again.');
      twimlError.hangup();
      res.type('text/xml');
      return res.send(twimlError.toString());
  }

  const twiml = new twilio.twiml.VoiceResponse();
  // Optional message for the technician
  // Use English for the voice message
  twiml.say({ language: 'en-US' }, 'Connecting you to the customer. Please wait.');

  // Connect the technician to the specified conference
  const dial = twiml.dial();
  dial.conference(conferenceName);
  // You can add attributes to the conference here if needed
  // Ex: startConferenceOnEnter=true, endConferenceOnExit=true (be careful with the latter)
  // dial.conference({ startConferenceOnEnter: true }, conferenceName);

  res.type('text/xml');
  res.send(twiml.toString());
});

// --- TwiML Endpoint called when the CUSTOMER answers ---
app.post('/handle-customer-answer', (req, res) => {
  const conferenceName = req.query.confName; // Get conference name from query param
  const callSid = req.body.CallSid; // SID of the customer's call leg

  console.log(`Customer answered (CallSid: ${callSid}). Connecting to conference: ${conferenceName}`);

   if (!conferenceName) {
      console.error("Error: Conference name not received in customer's TwiML.");
      const twimlError = new twilio.twiml.VoiceResponse();
      // Use English for the voice message
      twimlError.say({ language: 'en-US' }, 'An error occurred while connecting. Please try again.');
      twimlError.hangup();
      res.type('text/xml');
      return res.send(twimlError.toString());
  }

  const twiml = new twilio.twiml.VoiceResponse();
  // DO NOT put 'say' here, as the customer shouldn't hear anything before connecting

  // Connect the customer to the SAME conference
  const dial = twiml.dial();
  dial.conference(conferenceName);
  // dial.conference({ startConferenceOnEnter: true }, conferenceName);

  res.type('text/xml');
  res.send(twiml.toString());
});

// --- Optional Endpoint for Call Status ---
// Uncomment if you need to track status (requires configuring statusCallback in API calls)
/*
app.post('/call-status', (req, res) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus; // completed, busy, failed, no-answer, canceled
  const direction = req.body.Direction; // outbound-api (for this case)
  const to = req.body.To;
  const duration = req.body.CallDuration; // Duration in seconds (if 'completed')

  console.log(`Call Status (SID: ${callSid}, Direction: ${direction}, To: ${to}): ${callStatus}`);
  if (callStatus === 'completed') {
    console.log(`  Duration: ${duration} seconds`);
  }

  // Add logic here if needed (e.g., log to database)

  res.sendStatus(200); // Just acknowledge receipt to Twilio
});
*/

// --- Health Check Route (Optional, but useful) ---
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// --- Server Initialization ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Twilio API Call Masking server started on port ${PORT}`);
  console.log(`Base URL for Webhooks: ${BASE_URL}`);
  console.log('Available Endpoints:');
  // Use English endpoint names here
  console.log(`  POST ${BASE_URL}/start-masked-call (FlutterFlow Trigger)`);
  console.log(`  POST ${BASE_URL}/handle-technician-answer (TwiML Webhook)`);
  console.log(`  POST ${BASE_URL}/handle-customer-answer (TwiML Webhook)`);
  // console.log(`  POST ${BASE_URL}/call-status (Optional Status Webhook)`);
  console.log(`  GET ${BASE_URL}/health (Health Check)`);
});
