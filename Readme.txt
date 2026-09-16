## Local development

1. Create a Neon PostgreSQL project and copy its pooled connection string.
2. Copy `.env.example` to `.env` and set `DATABASE_URL`.
3. Run the SQL in `DB.SQL` against the Neon database.
4. Install dependencies and start the app:

```sh
npm install
npm start
```

The app is available at `http://localhost:3000`.

## Vercel deployment

Import this repository into Vercel, then add the Neon integration or set `DATABASE_URL` in the project environment variables for Production and Preview. Vercel detects `vercel.json` and runs `server.js` as the Express function. Run `DB.SQL` once against the Neon database before signing in.

Also add `AUTH_SECRET` in Vercel. Generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and use the same value for Production, Preview, and Development. Authentication uses signed tokens because Vercel functions do not share in-memory sessions.

The seeded local accounts are `admin` / `root` and `ava` / `root`; change them before production use.
    
