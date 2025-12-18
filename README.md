# SREE KUMARAN SWEETS & BAKERY — QR Ordering System

Mobile menu + counter dashboard with QR table links, using Next.js (frontend) and Express/MongoDB/Socket.io (backend). Thermal printing is stubbed for now; hook to a real ESC/POS printer when ready.

## Prereqs
- Node.js 18+
- MongoDB Atlas connection string
- Windows: run commands in PowerShell

## Backend
1) Install deps  
`cd backend; npm install`

2) Configure env  
Create `backend/.env`:
```
PORT=4000
MONGO_URI=your-mongodb-uri
CLIENT_ORIGIN=http://localhost:3000
```

3) Import menu from Excel (provided `sancks product list.xlsx` in project root):  
```
cd backend
node seed/convertExcel.js   # writes seed/menu.json
npm run seed                # loads items into Mongo
```

4) Run server  
`npm run dev`

## Frontend
1) Install deps  
`cd frontend; npm install`

2) Env (optional defaults already used)  
Create `frontend/.env.local` if API not on localhost:4000  
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

3) Run  
`npm run dev` (http://localhost:3000)

## Usage
- Customer QR: `http://localhost:3000/menu?table=1` (replace table number per table QR).
- Dashboard: `http://localhost:3000/dashboard` for live orders; mark Prepared, Print (stub updates status to BILLED).

## Printer (stubbed)
- Stub prints formatted receipt text to server console via `backend/print/escposStub.js`.
- To enable real printing, replace stub with actual ESC/POS library and point to the installed printer.

## Notes
- Items CRUD available via backend `/api/items` (POST/PATCH/DELETE) for admin tools.
- Code aims to stay simple and beginner-friendly; comments inline where non-obvious.

