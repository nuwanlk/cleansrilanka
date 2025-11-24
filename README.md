# CleanSriLanka - Simple Report UI

This small static web app allows you to:
- Insert reports: NIC, phone, name, address, problem
- Search reports (by NIC / phone / name)
- Update a selected report with status (Solved / Not Solved) and a note

Files:
- `index.html` — main UI
- `styles.css` — styles
- `script.js` — client-side logic (uses Supabase JS client)
- `config.js` — placeholder for your Supabase project values

Setup
1. Create a Supabase project and get the `URL` and `ANON` key from Project -> Settings -> API.
2. In this folder edit `config.js` and replace the placeholders:
```js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```
3. Create the `reports` table in your Supabase SQL Editor using the query below.

SQL to create `reports` table
```sql
create table public.reports (
  id uuid default gen_random_uuid() primary key,
  token text,
  nic text,
  phone text,
  name text,
  address text,
  problem text,
  status text,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz
);
```

How to run
- Option 1: Open `index.html` in your browser (works in most cases).
- Option 2: Serve with a simple static server (recommended). Example using Python 3 (PowerShell):
```powershell
python -m http.server 5500
# then open http://localhost:5500/
```

Notes
- Do not commit your real Supabase keys to public repositories.
- For production, move keys to server-side or use environment variables and protected endpoints.
