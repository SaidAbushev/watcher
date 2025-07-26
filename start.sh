#!/bin/bash

echo "🚀 Запуск Log Monitor..."
echo "=========================="

# Проверка наличия Go
if ! command -v go &> /dev/null; then
    echo "❌ Go не установлен. Пожалуйста, установите Go 1.21+"
    exit 1
fi

# Проверка версии Go
GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
REQUIRED_VERSION="1.21"

if ! printf '%s\n' "$REQUIRED_VERSION" "$GO_VERSION" | sort -V -C; then
    echo "❌ Требуется Go версии $REQUIRED_VERSION или выше. Текущая версия: $GO_VERSION"
    exit 1
fi

echo "✅ Go версии $GO_VERSION найден"

# Создание директории web если её нет
if [ ! -d "web" ]; then
    echo "📁 Создание директории web..."
    mkdir -p web
fi

# Установка зависимостей
echo "📦 Установка зависимостей..."
go mod tidy

if [ $? -ne 0 ]; then
    echo "❌ Ошибка при установке зависимостей"
    exit 1
fi

echo "✅ Зависимости установлены"

# Создание примеров log файлов для демонстрации
echo "📝 Создание примеров файлов логов..."
mkdir -p logs

cat > logs/application.log << 'EOF'
2024-01-15 10:00:01 INFO Starting application
2024-01-15 10:00:02 INFO Database connection established
2024-01-15 10:00:03 INFO Server listening on port 8080
2024-01-15 10:05:01 INFO User authenticated: user123
2024-01-15 10:05:15 WARN Slow query detected: SELECT * FROM users
2024-01-15 10:10:30 ERROR Database connection lost
2024-01-15 10:10:31 INFO Attempting to reconnect...
2024-01-15 10:10:35 INFO Database connection restored
EOF

cat > logs/error.log << 'EOF'
2024-01-15 09:30:15 ERROR [HTTP-404] Page not found: /invalid-path
2024-01-15 09:45:22 ERROR [DB-001] Connection timeout to database
2024-01-15 10:15:45 ERROR [AUTH-003] Invalid credentials for user: admin
2024-01-15 10:20:11 ERROR [MEM-001] Memory usage exceeded 90%
2024-01-15 10:30:33 ERROR [NET-002] Network timeout while connecting to external API
EOF

cat > logs/access.log << 'EOF'
192.168.1.100 - - [15/Jan/2024:10:00:01 +0000] "GET / HTTP/1.1" 200 2326
192.168.1.101 - - [15/Jan/2024:10:00:15 +0000] "POST /api/login HTTP/1.1" 200 567
192.168.1.102 - - [15/Jan/2024:10:01:22 +0000] "GET /dashboard HTTP/1.1" 200 4521
192.168.1.100 - - [15/Jan/2024:10:02:33 +0000] "PUT /api/users/123 HTTP/1.1" 201 123
192.168.1.103 - - [15/Jan/2024:10:03:44 +0000] "DELETE /api/posts/456 HTTP/1.1" 204 0
EOF

echo "✅ Примеры файлов созданы в директории logs/"

# Запуск сервера
echo "🌐 Запуск веб-сервера..."
echo "=========================="
echo "📍 URL: http://localhost:8080"
echo "🛑 Для остановки нажмите Ctrl+C"
echo "=========================="

# Открытие браузера (если возможно)
if command -v xdg-open &> /dev/null; then
    echo "🔗 Открытие браузера..."
    sleep 2 && xdg-open http://localhost:8080 &
elif command -v open &> /dev/null; then
    echo "🔗 Открытие браузера..."
    sleep 2 && open http://localhost:8080 &
fi

# Запуск Go сервера
go run cmd/web-server/main.go