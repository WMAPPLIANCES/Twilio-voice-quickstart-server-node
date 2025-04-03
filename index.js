// Carrega variáveis de ambiente
require('dotenv').config();

const http = require('http');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const methods = require('./src/server.js');

const {
  tokenGenerator,
  makeCall,
  placeCall,
  incoming,
  welcome
} = methods;

// Criação do app Express
const app = express();

// Ativa CORS para evitar erros no Flutter Web
app.use(cors());

// Parser para formulário
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json()); // Adicionado para aceitar JSON

// Rotas
app.get('/', (req, res) => res.send(welcome()));
app.post('/', (req, res) => res.send(welcome()));

app.get('/accessToken', tokenGenerator);
app.post('/accessToken', tokenGenerator);

app.get('/makeCall', makeCall);
app.post('/makeCall', makeCall);

app.get('/placeCall', placeCall);
app.post('/placeCall', placeCall);

app.get('/incoming', (req, res) => res.send(incoming()));
app.post('/incoming', (req, res) => res.send(incoming()));

// Inicia o servidor
const port = process.env.PORT || 3000;
const server = http.createServer(app);
server.listen(port, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
});
