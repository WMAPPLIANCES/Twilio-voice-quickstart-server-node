const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const placeCall = require('../twilio');

dotenv.config();

const app = express();
app.use(bodyParser.json());

app.post('/place-call', async (req, res) => {
  try {
    const { from, to } = req.body;

    if (!from || !to) {
      return res.status(400).json({ error: 'Missing "from" or "to" number' });
    }

    const call = await placeCall(from, to);
    res.status(200).json({ data: call.sid });
  } catch (err) {
    console.error('Erro ao ligar:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
