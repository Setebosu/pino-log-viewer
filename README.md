# 📊 Pino Log Viewer

A simple web-based log viewer and dashboard built with Fastify and vanilla HTML/JS.

✅ Upload .zip files of logs
✅ Browse folders and view .log files
✅ Filter logs by level and time range
✅ Visualize log activity with charts (Chart.js)
✅ One-page UI with tab navigation

📁 Project Structure

```php
.
├── log/              # Uploaded and extracted log files
├── public/
│   └── index.html     # Frontend single-page app
└── server.js         # Fastify backend (ESM)
```

⚙️ Features

* 📂 Drag & drop .zip file uploads

* 🗂 Extracts and stores logs under /logs

* 🧭 File browser with nested folder support

* 🔍 Filter logs by level (debug, info, error, etc.), name, time etc.

* 📊 Dashboards

* 🌐 All in a single HTML file (index.html)

📦 API Overview

| Route                    | Description                   |
| ------------------------ | ----------------------------- |
| `POST /upload`   | Upload a `.zip` with logs to `/log` directory     |
| `GET /logs/*`   | List content/logs in `/log` directory |
| `DELETE /logs/*`       | Delete logs               |
