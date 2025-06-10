# Используем официальный Node.js образ
FROM node:18-alpine

# Создаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем проект
RUN npm run build

# В качестве результата — папка .next (или build/dist для других фреймворков)


