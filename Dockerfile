# Usa imagem oficial do Node.js
FROM node:18

# Define diretório de trabalho
WORKDIR /app

# Copia os arquivos
COPY . .

# Instala dependências
RUN npm install

# Expõe a porta do app (altere se necessário)
EXPOSE 3000

# Comando para rodar o servidor
CMD ["node", "src/server.js"]
