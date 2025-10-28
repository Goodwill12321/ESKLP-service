# Используем официальный образ Node.js
FROM node:20-slim

# Рабочая директория внутри контейнера
WORKDIR /usr/src/app

# Устанавливаем PM2 глобально
RUN npm install -g pm2

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем только production-зависимости
RUN npm install --production

# Копируем остальные исходные файлы
COPY . .

# Открываем порт приложения (при необходимости поменяй)
EXPOSE 3000

# Запуск приложения через PM2
# --max-memory-restart=450M — перезапуск при утечке
# --node-args="--max-old-space-size=400" — ограничение heap внутри Node.js
CMD ["pm2-runtime", "npm", "--", "start", "--node-args=--max-old-space-size=2500", "--max-memory-restart=2750M"]
