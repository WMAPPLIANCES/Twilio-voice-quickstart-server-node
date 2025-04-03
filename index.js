require('dotenv').config(); // use .config() em vez de .load()

const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const methods = require('./src/server.js');

const {
  tokenGenerator,
  makeCall,
  placeCall,
  incoming,
  welcome,
} = methods;

// Inicia a aplicação
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json()); // aceita JSON também

// Raiz (opcional)
app.get('/', (req, res) => res.send(welcome()));
app.post('/', (req, res) => res.send(welcome()));

// Token de acesso
app.get('/access-token', tokenGenerator);
app.post('/access-token', tokenGenerator);

// Faz a chamada (Twilio envia para isso)
app.get('/make-call', makeCall);
app.post('/make-call', makeCall);

// Cliente inicia chamada
app.get('/place-call', placeCall);
app.post('/place-call', placeCall);

// Recebe chamada
app.get('/incoming', (req, res) => res.send(incoming()));
app.post('/incoming', (req, res) => res.send(incoming()));

// Start servidor
http.createServer(app).listen(port, () => {
  console.log(`✅ Servidor rodando na porta ${port}`);
});
