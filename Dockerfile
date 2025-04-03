# Usa imagem oficial Node.js
FROM node:18

# Define diretório de trabalho
WORKDIR /app

# Copia os arquivos do projeto
COPY . .

# Instala as dependências
RUN npm install

# Expõe a porta 3000
EXPOSE 3000

# Inicia o servidor
CMD ["node", "src/server.js"]
