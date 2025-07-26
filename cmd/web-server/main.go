package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow connections from any origin
	},
}

type LogMonitor struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan []byte
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
}

type LogEvent struct {
	Type      string    `json:"type"`
	Filename  string    `json:"filename"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
}

func NewLogMonitor() *LogMonitor {
	return &LogMonitor{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
	}
}

func (lm *LogMonitor) run() {
	for {
		select {
		case client := <-lm.register:
			lm.clients[client] = true
			log.Println("Новый клиент подключен")

		case client := <-lm.unregister:
			if _, ok := lm.clients[client]; ok {
				delete(lm.clients, client)
				client.Close()
				log.Println("Клиент отключен")
			}

		case message := <-lm.broadcast:
			for client := range lm.clients {
				err := client.WriteMessage(websocket.TextMessage, message)
				if err != nil {
					log.Printf("Ошибка отправки сообщения: %v", err)
					client.Close()
					delete(lm.clients, client)
				}
			}
		}
	}
}

func (lm *LogMonitor) broadcastEvent(event LogEvent) {
	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("Ошибка маршалинга события: %v", err)
		return
	}
	
	select {
	case lm.broadcast <- data:
	default:
		// Channel is full, skip this message
	}
}

func main() {
	monitor := NewLogMonitor()
	go monitor.run()

	// Симуляция мониторинга файлов
	go simulateFileMonitoring(monitor)

	router := mux.NewRouter()

	// Статические файлы
	router.PathPrefix("/").Handler(http.FileServer(http.Dir("./web/")))

	// WebSocket endpoint
	router.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		handleWebSocket(monitor, w, r)
	})

	// API endpoints
	api := router.PathPrefix("/api").Subrouter()
	api.HandleFunc("/files", handleFiles).Methods("GET")
	api.HandleFunc("/files", handleUploadFile).Methods("POST")
	api.HandleFunc("/elk/test", handleTestELK).Methods("POST")
	api.HandleFunc("/stats", handleStats).Methods("GET")

	// Добавляем CORS middleware
	router.Use(corsMiddleware)

	port := ":8080"
	fmt.Printf("Сервер запущен на порту %s\n", port)
	fmt.Printf("Откройте http://localhost%s в браузере\n", port)
	
	log.Fatal(http.ListenAndServe(port, router))
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		
		next.ServeHTTP(w, r)
	})
}

func handleWebSocket(monitor *LogMonitor, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Ошибка установки WebSocket соединения: %v", err)
		return
	}
	defer conn.Close()

	monitor.register <- conn

	// Отправляем приветственное сообщение
	welcomeEvent := LogEvent{
		Type:      "connected",
		Message:   "Соединение с сервером установлено",
		Timestamp: time.Now(),
	}
	monitor.broadcastEvent(welcomeEvent)

	// Ожидаем закрытия соединения
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			monitor.unregister <- conn
			break
		}
	}
}

func simulateFileMonitoring(monitor *LogMonitor) {
	files := []string{"application.log", "error.log", "access.log", "debug.log"}
	
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		// Симулируем обновление случайного файла
		filename := files[time.Now().Unix()%int64(len(files))]
		
		event := LogEvent{
			Type:      "file_updated",
			Filename:  filename,
			Message:   fmt.Sprintf("Файл %s обновлен", filename),
			Timestamp: time.Now(),
		}
		monitor.broadcastEvent(event)

		// Симулируем отправку в ELK через 2 секунды
		time.Sleep(2 * time.Second)
		elkEvent := LogEvent{
			Type:      "elk_sent",
			Filename:  filename,
			Message:   fmt.Sprintf("Данные из %s отправлены в ELK", filename),
			Timestamp: time.Now(),
		}
		monitor.broadcastEvent(elkEvent)
	}
}

type FileInfo struct {
	Name         string    `json:"name"`
	Size         int64     `json:"size"`
	ModTime      time.Time `json:"modTime"`
	Status       string    `json:"status"`
	ELKStatus    string    `json:"elkStatus"`
}

func handleFiles(w http.ResponseWriter, r *http.Request) {
	// Поиск log файлов в текущей директории
	files := []FileInfo{}
	
	err := filepath.Walk(".", func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		
		if !info.IsDir() && filepath.Ext(path) == ".log" {
			files = append(files, FileInfo{
				Name:      info.Name(),
				Size:      info.Size(),
				ModTime:   info.ModTime(),
				Status:    "monitoring",
				ELKStatus: "sent",
			})
		}
		return nil
	})
	
	if err != nil {
		http.Error(w, "Ошибка чтения файлов", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(files)
}

func handleUploadFile(w http.ResponseWriter, r *http.Request) {
	err := r.ParseMultipartForm(10 << 20) // 10 MB limit
	if err != nil {
		http.Error(w, "Ошибка парсинга файла", http.StatusBadRequest)
		return
	}

	file, handler, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Ошибка получения файла", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Здесь можно добавить логику сохранения файла и добавления в мониторинг
	log.Printf("Загружен файл: %s", handler.Filename)

	response := map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("Файл %s успешно загружен", handler.Filename),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

type ELKTestRequest struct {
	URL      string `json:"url"`
	Username string `json:"username"`
	Password string `json:"password"`
}

func handleTestELK(w http.ResponseWriter, r *http.Request) {
	var req ELKTestRequest
	err := json.NewDecoder(r.Body).Decode(&req)
	if err != nil {
		http.Error(w, "Неверный формат запроса", http.StatusBadRequest)
		return
	}

	// Симуляция проверки соединения с ELK
	time.Sleep(1 * time.Second) // Имитация времени проверки
	
	// Простая проверка URL
	success := req.URL != "" && (req.URL == "http://localhost:9200" || req.URL == "http://localhost:5044")
	
	response := map[string]interface{}{
		"success": success,
		"message": func() string {
			if success {
				return "Соединение установлено"
			}
			return "Не удалось подключиться"
		}(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

type Stats struct {
	TotalFiles     int `json:"totalFiles"`
	UploadedToday  int `json:"uploadedToday"`
	ActiveMonitors int `json:"activeMonitors"`
	ELKStatus      string `json:"elkStatus"`
}

func handleStats(w http.ResponseWriter, r *http.Request) {
	stats := Stats{
		TotalFiles:     15,
		UploadedToday:  8,
		ActiveMonitors: 3,
		ELKStatus:     "active",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}