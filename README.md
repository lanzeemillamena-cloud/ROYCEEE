# EMJ Advertising Service - Time In/Time Out System

Real-time employee time tracking system built with **Supabase** backend and vanilla HTML/CSS/JS frontend.

## Setup (Supabase - 2 steps lang)

### 1. Create tables sa Supabase (isang beses lang)
1. Pumunta sa Supabase Dashboard > SQL Editor > New Query
2. Buksan ang file na `supabase-schema.sql`, i-copy lahat, i-paste, i-click **Run**
3. Dapat may 3 tables: `employees`, `timeEntries`, `breaks`

### 2. Run ang app
```bash
npm install
npx serve . -l 3000
```
O kaya double-click `setup.bat`.

### 3. Open sa browser
- **Main Page**: http://localhost:3000/attendence.html
- **Admin Panel**: http://localhost:3000/admin.html (password: itanong sa developer)

> Frontend direktang kumakausap sa Supabase via `config.js` (walang backend na kailangan).
> Ang `server.js` ay optional lang kung gusto mo pa rin gumamit ng `/api/*` endpoints:
> `node server.js`

## Admin Panel Features

- Dashboard with real-time stats (present, absent, on break)
- Department overview
- Add new employees
- View time logs with date/department filters
- Export to Excel
- Auto-refresh every 60 seconds

## Frontend API (config.js → Supabase direkta)

| Function | Description |
|----------|-------------|
| `API.getEntries(date, dept?)` | Get time entries |
| `API.timeIn(data)` | Record time in |
| `API.timeOut(data)` | Record time out |
| `API.startBreak(data)` | Start a break |
| `API.endBreak(data)` | End a break |
| `API.getBreaks(date, type?)` | Get break logs |
| `API.getAdminSummary()` | Admin dashboard data |
| `API.getEmployees()` | List employees |
| `API.addEmployee(data)` | Add employee |
| `API.clearEntries({date, department?})` | Clear entries |
| `API.getDepartments()` | Get departments |

Optional REST server (`node server.js`) exposes the same as `/api/*`.

## Configuration

Edit `config.js` to change:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon/publishable key
- `ADMIN_PASSWORD` - Admin panel password
- `DEPARTMENTS` - Department list
- `BREAK_TYPES` - Break types

Kopyahin `.env.example` kung gagamitin ang `server.js`:
```bash
copy .env.example .env
```

## File Structure

```
In-Out-main/
├── attendence.html      # Main time in/out page
├── admin.html           # Admin dashboard
├── section.html         # Navigation hub
├── login.html           # View login entries
├── breakm.html          # Morning break view
├── lunch.html           # Lunch break view
├── breake.html          # Evening break view
├── config.js            # Supabase config & API helpers
├── styles.css           # Professional UI styles
├── server.js            # Optional Express + Supabase API server
├── supabase-schema.sql  # Database tables (i-run once sa Supabase)
├── package.json
└── setup.bat            # Quick start script
```
