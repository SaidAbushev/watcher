// Global state
let isMonitoring = false;
let activeFiles = [];
let activityLogs = [];
let elkConfig = {
    elasticsearch: {
        url: 'http://localhost:9200',
        index: 'logs-*',
        username: '',
        password: ''
    },
    logstash: {
        url: 'http://localhost:5044',
        input: 'beats',
        format: 'json'
    },
    kibana: {
        url: 'http://localhost:5601',
        space: 'default',
        dashboard: 'logs-dashboard'
    }
};

// DOM Elements
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.section');
const startMonitoringBtn = document.getElementById('startMonitoring');
const pauseMonitoringBtn = document.getElementById('pauseMonitoring');
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const activeFilesContainer = document.getElementById('activeFiles');
const activityLogContainer = document.getElementById('activityLog');
const clearLogsBtn = document.getElementById('clearLogs');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    initializeFileUpload();
    initializeTabs();
    initializeMonitoring();
    loadMockData();
    updateStatus();
    
    // Start periodic updates
    setInterval(updateRealTimeData, 5000);
    setInterval(updateStatus, 10000);
});

// Navigation
function initializeNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSection = e.target.getAttribute('href').substring(1);
            showSection(targetSection);
            
            // Update active nav link
            navLinks.forEach(l => l.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
}

function showSection(sectionId) {
    sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === sectionId) {
            section.classList.add('active');
            section.classList.add('fade-in');
        }
    });
}

// File Upload
function initializeFileUpload() {
    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', handleDragOver);
    uploadZone.addEventListener('dragleave', handleDragLeave);
    uploadZone.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);
}

function handleDragOver(e) {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    processFiles(files);
}

function processFiles(files) {
    files.forEach(file => {
        if (isValidLogFile(file)) {
            addFileToMonitoring(file);
            showNotification('success', `Файл ${file.name} добавлен для мониторинга`);
        } else {
            showNotification('error', `Файл ${file.name} не поддерживается`);
        }
    });
}

function isValidLogFile(file) {
    const validExtensions = ['.log', '.txt', '.json'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    return validExtensions.includes(fileExtension);
}

function addFileToMonitoring(file) {
    const fileData = {
        id: Date.now() + Math.random(),
        name: file.name,
        size: formatFileSize(file.size),
        status: 'monitoring',
        lastModified: new Date(),
        elkStatus: 'pending'
    };
    
    activeFiles.push(fileData);
    updateActiveFiles();
    addActivityLog('info', `Файл ${file.name} добавлен в мониторинг`);
}

// Tabs
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update active tab panel
            tabPanels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === tabId) {
                    panel.classList.add('active');
                }
            });
        });
    });
}

// Monitoring
function initializeMonitoring() {
    startMonitoringBtn.addEventListener('click', startMonitoring);
    pauseMonitoringBtn.addEventListener('click', pauseMonitoring);
    clearLogsBtn.addEventListener('click', clearActivityLogs);
}

function startMonitoring() {
    isMonitoring = true;
    startMonitoringBtn.style.display = 'none';
    pauseMonitoringBtn.style.display = 'inline-flex';
    
    addActivityLog('success', 'Мониторинг запущен');
    updateSystemStatus('Мониторинг активен');
    
    // Start simulated monitoring
    simulateFileChanges();
}

function pauseMonitoring() {
    isMonitoring = false;
    startMonitoringBtn.style.display = 'inline-flex';
    pauseMonitoringBtn.style.display = 'none';
    
    addActivityLog('warning', 'Мониторинг приостановлен');
    updateSystemStatus('Мониторинг приостановлен');
}

function simulateFileChanges() {
    if (!isMonitoring) return;
    
    // Simulate file changes every 3-8 seconds
    const delay = Math.random() * 5000 + 3000;
    
    setTimeout(() => {
        if (activeFiles.length > 0) {
            const randomFile = activeFiles[Math.floor(Math.random() * activeFiles.length)];
            simulateFileUpdate(randomFile);
            simulateELKSend(randomFile);
        }
        
        simulateFileChanges(); // Continue simulation
    }, delay);
}

function simulateFileUpdate(file) {
    file.lastModified = new Date();
    file.elkStatus = 'processing';
    
    addActivityLog('info', `Обновление файла ${file.name}`);
    updateActiveFiles();
    updateStats();
}

function simulateELKSend(file) {
    setTimeout(() => {
        file.elkStatus = 'sent';
        addActivityLog('success', `Данные из ${file.name} отправлены в ELK`);
        updateActiveFiles();
        updateStats();
    }, 2000);
}

// Activity Logs
function addActivityLog(type, message) {
    const log = {
        id: Date.now(),
        type,
        message,
        timestamp: new Date()
    };
    
    activityLogs.unshift(log);
    
    // Keep only last 50 logs
    if (activityLogs.length > 50) {
        activityLogs = activityLogs.slice(0, 50);
    }
    
    updateActivityLogs();
}

function updateActivityLogs() {
    if (!activityLogContainer) return;
    
    activityLogContainer.innerHTML = activityLogs.map(log => `
        <div class="log-item">
            <div class="log-info">
                <div class="log-message">${log.message}</div>
                <div class="log-time">${formatTime(log.timestamp)}</div>
            </div>
            <div class="log-status ${log.type}">
                <i class="fas ${getLogIcon(log.type)}"></i>
            </div>
        </div>
    `).join('');
}

function clearActivityLogs() {
    activityLogs = [];
    updateActivityLogs();
    showNotification('success', 'Логи активности очищены');
}

function getLogIcon(type) {
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    return icons[type] || 'fa-info-circle';
}

// Update Active Files
function updateActiveFiles() {
    if (!activeFilesContainer) return;
    
    activeFilesContainer.innerHTML = activeFiles.map(file => `
        <div class="file-item">
            <div class="file-info">
                <div class="file-status ${file.elkStatus}"></div>
                <div>
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${file.size} • ${formatTime(file.lastModified)}</div>
                </div>
            </div>
            <div class="file-elk-status ${file.elkStatus}">
                ${getELKStatusText(file.elkStatus)}
            </div>
        </div>
    `).join('');
}

function getELKStatusText(status) {
    const statusTexts = {
        pending: 'Ожидание',
        monitoring: 'Мониторинг',
        processing: 'Обработка',
        sent: 'Отправлено'
    };
    return statusTexts[status] || 'Неизвестно';
}

// Statistics
function updateStats() {
    const totalFilesEl = document.getElementById('totalFiles');
    const uploadedTodayEl = document.getElementById('uploadedToday');
    
    if (totalFilesEl) {
        totalFilesEl.textContent = activeFiles.length;
    }
    
    if (uploadedTodayEl) {
        const sentToday = activeFiles.filter(f => 
            f.elkStatus === 'sent' && 
            isToday(f.lastModified)
        ).length;
        uploadedTodayEl.textContent = sentToday;
    }
}

function isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

// Real-time data updates
function updateRealTimeData() {
    if (!isMonitoring) return;
    
    // Simulate some random data updates
    const avgProcessTimeEl = document.getElementById('avgProcessTime');
    if (avgProcessTimeEl) {
        const randomTime = (Math.random() * 2 + 1).toFixed(1);
        avgProcessTimeEl.textContent = randomTime + 's';
    }
    
    updateLastUpdateTime();
}

function updateLastUpdateTime() {
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl) {
        lastUpdateEl.textContent = formatTime(new Date());
    }
}

function updateSystemStatus(status) {
    const systemStatusEl = document.getElementById('systemStatus');
    if (systemStatusEl) {
        systemStatusEl.textContent = status;
    }
}

function updateStatus() {
    updateLastUpdateTime();
    updateStats();
}

// ELK Configuration
function initializeELKConfig() {
    // Test connection buttons
    const testElasticBtn = document.getElementById('testElasticConnection');
    const testLogstashBtn = document.getElementById('testLogstashConnection');
    const openKibanaBtn = document.getElementById('openKibana');
    
    if (testElasticBtn) {
        testElasticBtn.addEventListener('click', testElasticsearchConnection);
    }
    
    if (testLogstashBtn) {
        testLogstashBtn.addEventListener('click', testLogstashConnection);
    }
    
    if (openKibanaBtn) {
        openKibanaBtn.addEventListener('click', openKibana);
    }
}

function testElasticsearchConnection() {
    showNotification('info', 'Тестирование соединения с Elasticsearch...');
    
    // Simulate connection test
    setTimeout(() => {
        const success = Math.random() > 0.3; // 70% success rate
        if (success) {
            showNotification('success', 'Соединение с Elasticsearch установлено');
            document.getElementById('elkStatus').textContent = 'Активен';
        } else {
            showNotification('error', 'Не удалось подключиться к Elasticsearch');
            document.getElementById('elkStatus').textContent = 'Недоступен';
        }
    }, 2000);
}

function testLogstashConnection() {
    showNotification('info', 'Тестирование соединения с Logstash...');
    
    setTimeout(() => {
        const success = Math.random() > 0.2; // 80% success rate
        if (success) {
            showNotification('success', 'Соединение с Logstash установлено');
        } else {
            showNotification('error', 'Не удалось подключиться к Logstash');
        }
    }, 1500);
}

function openKibana() {
    const kibanaUrl = document.getElementById('kibanaUrl').value || 'http://localhost:5601';
    window.open(kibanaUrl, '_blank');
}

// Utility Functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(date) {
    return date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function showNotification(type, message) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Load mock data for demonstration
function loadMockData() {
    const mockFiles = [
        {
            id: 1,
            name: 'application.log',
            size: '2.5 MB',
            status: 'monitoring',
            lastModified: new Date(Date.now() - 300000), // 5 minutes ago
            elkStatus: 'sent'
        },
        {
            id: 2,
            name: 'error.log',
            size: '1.8 MB',
            status: 'monitoring',
            lastModified: new Date(Date.now() - 120000), // 2 minutes ago
            elkStatus: 'processing'
        },
        {
            id: 3,
            name: 'access.log',
            size: '5.2 MB',
            status: 'monitoring',
            lastModified: new Date(Date.now() - 60000), // 1 minute ago
            elkStatus: 'sent'
        }
    ];
    
    activeFiles = mockFiles;
    updateActiveFiles();
    
    // Add some mock activity logs
    addActivityLog('info', 'Система инициализирована');
    addActivityLog('success', 'Загружены файлы для мониторинга');
    addActivityLog('success', 'Соединение с ELK Stack установлено');
    
    updateStats();
}

// Settings management
function initializeSettings() {
    const saveSettingsBtn = document.querySelector('.settings-actions .btn-primary');
    const resetSettingsBtn = document.querySelector('.settings-actions .btn-secondary');
    
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
    }
    
    if (resetSettingsBtn) {
        resetSettingsBtn.addEventListener('click', resetSettings);
    }
}

function saveSettings() {
    // Collect settings from form
    const settings = {
        emailNotifications: document.getElementById('emailNotifications')?.checked,
        soundNotifications: document.getElementById('soundNotifications')?.checked,
        checkInterval: document.getElementById('checkInterval')?.value,
        maxFiles: document.getElementById('maxFiles')?.value,
        apiKey: document.getElementById('apiKey')?.value,
        connectionTimeout: document.getElementById('connectionTimeout')?.value
    };
    
    // Save to localStorage
    localStorage.setItem('logMonitorSettings', JSON.stringify(settings));
    showNotification('success', 'Настройки сохранены');
}

function resetSettings() {
    if (confirm('Вы уверены, что хотите сбросить все настройки к значениям по умолчанию?')) {
        localStorage.removeItem('logMonitorSettings');
        location.reload(); // Reload to reset form
    }
}

// Initialize additional components
document.addEventListener('DOMContentLoaded', function() {
    initializeELKConfig();
    initializeSettings();
});

// WebSocket connection simulation (for real implementation)
function initializeWebSocket() {
    // This would be used in a real implementation to connect to the Go backend
    // const ws = new WebSocket('ws://localhost:8080/ws');
    
    // ws.onmessage = function(event) {
    //     const data = JSON.parse(event.data);
    //     handleRealtimeUpdate(data);
    // };
}

function handleRealtimeUpdate(data) {
    switch(data.type) {
        case 'file_updated':
            addActivityLog('info', `Файл ${data.filename} обновлен`);
            break;
        case 'elk_sent':
            addActivityLog('success', `Данные отправлены в ELK: ${data.filename}`);
            break;
        case 'error':
            addActivityLog('error', data.message);
            break;
    }
}

// Export functions for potential use by other scripts
window.LogMonitor = {
    startMonitoring,
    pauseMonitoring,
    addFileToMonitoring,
    updateStats,
    showNotification
};