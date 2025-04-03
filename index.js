require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const { connectClient, placeCall, welcome, incoming } = require('./twilio');

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Rotas principais
app.get('/', (req, res) => res.send(welcome()));
app.post('/', (req, res) => res.send(welcome()));
app.get('/incoming', (req, res) => res.send(incoming()));
app.post('/incoming', (req, res) => res.send(incoming()));
app.get('/accessToken', (req, res) => res.send('Token route'));
app.post('/accessToken', (req, res) => res.send('Token route'));

// Rota para conectar cliente após técnico atender
app.get('/connect-client', connectClient);

// Rota que liga primeiro para o técnico
app.post('/place-call', placeCall);

// Start server
const port = process.env.PORT || 3000;
http.createServer(app).listen(port, () => {
  console.log(`🚀 Servidor rodando na porta ${port}`);
});
