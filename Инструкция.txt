================================================================
  ИНСТРУКЦИЯ ПО ЗАПУСКУ МЕССЕНДЖЕРА "REPA"
  Стек: FastAPI (Python) + React (TypeScript) + Vite + SQLite
================================================================

СТРУКТУРА ПРОЕКТА:
  backend/   — серверная часть (Python / FastAPI)
  frontend/  — клиентская часть (React / Vite)
  Mess/      — эта папка с инструкцией

================================================================
  ЧТО НУЖНО УСТАНОВИТЬ ЗАРАНЕЕ
================================================================

1. Python 3.12 или новее
   Скачать: https://www.python.org/downloads/
   Windows: при установке поставьте галочку "Add Python to PATH"

2. Node.js 18 или новее (включает npm)
   Скачать: https://nodejs.org/

3. PyCharm (Community или Professional)
   Скачать: https://www.jetbrains.com/pycharm/download/

================================================================
  ПЕРВЫЙ ЗАПУСК — УСТАНОВКА ЗАВИСИМОСТЕЙ
================================================================

--- BACKEND (выполнить один раз) ---

Откройте терминал в папке "backend":
  PyCharm → правый клик на папку backend → Open In → Terminal

# Mac / Linux:
  python3 -m venv .venv
  source .venv/bin/activate
  pip install fastapi uvicorn[standard] sqlalchemy bcrypt python-jose[cryptography] python-multipart websockets

# Windows (PowerShell):
  python -m venv .venv
  .venv\Scripts\Activate.ps1
  pip install fastapi uvicorn[standard] sqlalchemy bcrypt python-jose[cryptography] python-multipart websockets

  Если PowerShell запрещает скрипты, выполните сначала:
  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

--- FRONTEND (выполнить один раз) ---

Откройте терминал в папке "frontend":
  PyCharm → правый клик на папку frontend → Open In → Terminal

# Mac / Linux / Windows:
  npm install

================================================================
  ЗАПУСК (каждый раз)
================================================================

Нужно запустить ДВА процесса одновременно — бэкенд и фронтенд.
Откройте два отдельных терминала в PyCharm:
  View → Tool Windows → Terminal → "+" (новая вкладка)

--- Терминал 1: BACKEND ---

# Mac / Linux:
  cd backend
  source .venv/bin/activate
  uvicorn app.main:app --reload

# Windows:
  cd backend
  .venv\Scripts\Activate.ps1
  uvicorn app.main:app --reload

Бэкенд запустится на: http://127.0.0.1:8000

--- Терминал 2: FRONTEND ---

# Mac / Linux / Windows (команды одинаковые):
  cd frontend
  npm run dev

Фронтенд запустится на: http://localhost:5173

--- Откройте в браузере ---

  http://localhost:5173

================================================================
  НАСТРОЙКА PYCHARM (РЕКОМЕНДУЕТСЯ)
================================================================

Чтобы запускать одной кнопкой через Run Configurations:

1. Меню: Run → Edit Configurations → "+" → Shell Script

   Конфигурация 1 — Backend:
     Name: Backend
     Script path: (укажите полный путь до папки backend)
     Script text (Mac/Linux):
       source .venv/bin/activate && uvicorn app.main:app --reload
     Script text (Windows):
       .venv\Scripts\activate && uvicorn app.main:app --reload
     Working directory: <путь до папки backend>

   Конфигурация 2 — Frontend:
     Name: Frontend
     Script text: npm run dev
     Working directory: <путь до папки frontend>

2. Запустите обе конфигурации кнопкой ▶

================================================================
  НАСТРОЙКА ИНТЕРПРЕТАТОРА PYTHON В PYCHARM
================================================================

File → Settings (Mac: PyCharm → Preferences)
  → Project → Python Interpreter
  → Add Interpreter → Add Local Interpreter
  → Existing → выберите файл:
      Mac/Linux: backend/.venv/bin/python
      Windows:   backend\.venv\Scripts\python.exe

================================================================
  ВОЗМОЖНЫЕ ПРОБЛЕМЫ
================================================================

Проблема: "uvicorn: command not found" / "uvicorn не распознан"
Решение:  Убедитесь, что активировали виртуальное окружение (.venv)

Проблема: "npm: command not found"
Решение:  Установите Node.js с сайта nodejs.org, перезапустите PyCharm

Проблема: Сайт не открывается, хотя оба сервера запущены
Решение:  Убедитесь, что открываете http://localhost:5173 (не 8000)
          Порт 8000 — это API, не сайт

Проблема: "Address already in use" / порт занят
Решение:
  Mac/Linux: lsof -ti:8000 | xargs kill -9
             lsof -ti:5173 | xargs kill -9
  Windows:   netstat -ano | findstr :8000
             taskkill /PID <номер> /F

Проблема: Ошибка CORS в браузере
Решение:  Убедитесь, что фронтенд открыт на http://localhost:5173
          (именно localhost, не 127.0.0.1)

================================================================
  АДРЕСА ПО УМОЛЧАНИЮ
================================================================

  Сайт (фронтенд):    http://localhost:5173
  API  (бэкенд):      http://127.0.0.1:8000
  Документация API:   http://127.0.0.1:8000/docs

================================================================
