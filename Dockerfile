# Dockerfile
FROM node:18

# Cria o diretório da aplicação
WORKDIR /usr/src/app

# Copia os arquivos do projeto
COPY package*.json ./
COPY . .

# Instala as dependências
RUN npm install

# Expõe a porta 3000
EXPOSE 3000

# Inicia a aplicação
CMD ["node", "index.js"]
