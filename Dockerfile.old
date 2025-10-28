# Используем официальный образ Node.js
FROM node:20-slim

# Рабочая директория внутри контейнера
WORKDIR /usr/src/app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install --production

# Копируем остальные исходные файлы
COPY . .

# Открываем порт (уточните, если нужен другой)
EXPOSE 3000

# Запуск сервиса
CMD ["npm", "start"]
