# BurnNotes

Notes that burn after reading. Encrypted in the browser, destroyed on first read.

## Run

    npm install
    npm run dev:local

Open http://localhost:3000 in a browser.

`npm run dev:local` uses a file database at `local.db`. `npm run dev` uses
`TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` from `.env`.

## Layout

    src/config.js        environment and dotenv loading
    src/db.js            libSQL client and schema
    src/paths.js         absolute paths, independent of the working directory
    src/security.js      response header policy
    src/routes/api.js    json endpoints
    src/routes/pages.js  html endpoints
    public/              frontend, no build step
    test/                node test runner tests

## Licence

GPL 3.0. See LICENSE.
