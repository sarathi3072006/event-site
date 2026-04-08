# Event Management System — Flask + SQLite Backend

## Setup & Run (First Time)

1. **Install Python** (3.8+ required — already installed on most systems)

2. **Install Flask:**
   ```
   pip install flask
   ```
   On some systems:
   ```
   pip3 install flask
   ```

3. **Run the server:**
   ```
   python app.py
   ```
   Or:
   ```
   python3 app.py
   ```

4. **Open in browser:**
   ```
   http://localhost:5000
   ```

---

## Project Structure

```
event_app/
├── app.py              ← Flask backend (all API routes)
├── index.html          ← Main HTML page
├── events.db           ← SQLite database (auto-created on first run)
├── requirements.txt    ← Python dependencies
└── static/
    ├── styles.css      ← Styles (unchanged)
    └── script.js       ← Frontend JS (now uses fetch() API)
```

---

## Admin Login
- Username: `admin`
- Password: `admin123`

---

## How It Works

- All data is stored in **SQLite** (`events.db`) on the server.
- The frontend (`script.js`) makes **HTTP fetch()** calls to the Flask API.
- **Any device** on the same network can open `http://<your-ip>:5000` and see live data.
- The **admin** logs in from their computer and manages everything.
- **Guests** see the same data in real time.

---

## Running on a Network (Admin can see everyone's registrations)

To allow other computers to access your server:
```
python app.py
```
Then others on the same WiFi/LAN can visit:
```
http://<your-computer-ip>:5000
```
Find your IP: run `ipconfig` (Windows) or `ifconfig` / `ip addr` (Linux/Mac)

---

## API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| POST | /api/auth/login | Admin login |
| GET/POST | /api/events | List / Create events |
| PUT/DELETE | /api/events/<id> | Update / Delete event |
| GET/POST | /api/schedules | List / Create schedules |
| PUT/DELETE | /api/schedules/<id> | Update / Delete schedule |
| GET/POST | /api/registrations | List / Create registrations |
| DELETE | /api/registrations/<id> | Delete registration |
| GET/POST | /api/notices | List / Create notices |
| DELETE | /api/notices/<id> | Delete notice |
| GET/POST | /api/feedbacks | List / Create feedbacks |
| DELETE | /api/feedbacks/<id> | Delete feedback |
| GET/POST | /api/brochures | List / Create brochures |
| PUT/DELETE | /api/brochures/<id> | Update / Delete brochure |
| GET/POST | /api/moments | List / Create moments |
| PUT/DELETE | /api/moments/<id> | Update / Delete moment |
| GET/POST | /api/certificates | List / Create certificates |
| PUT/DELETE | /api/certificates/<id> | Update / Delete certificate |
| GET/POST | /api/payment-settings | Get / Save payment settings |
