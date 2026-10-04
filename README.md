# BurnNotes

Notes that burn after reading. Encrypted in the browser, destroyed on the first
read.

## How it works

1. You type a secret into the page.
2. Your browser generates a fresh 256 bit key and a fresh 96 bit iv, and seals
   the text with AES GCM.
3. Only the sealed bytes and the iv are sent to the server.
4. You get a link shaped like `https://host/n/ID#KEY`. The key sits in the URL
   fragment, which browsers never send to a server.
5. The first person to press Open and Burn gets the text. That same statement
   deletes the row. There is no second read.

The server stores ciphertext and nothing else. It cannot read your note, and it
never receives the key.

## Run it

    npm install
    npm run dev:local

Open http://localhost:3000.

`dev:local` and `start:local` use a file database at `local.db`. `dev` and
`start` use `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` from `.env`.

    npm test

## API

    POST /api/notes            { ciphertext, iv, ttl }   returns { id }
    POST /api/notes/:id/read   destroys the note          returns { ciphertext, iv }
    GET  /api/stats            returns { burned }
    GET  /api/health           returns { ok }

`ttl` is one of `1h`, `24h`, `7d`. Ciphertext is capped at 16KB. Reads are
`POST` only, so a link preview bot cannot burn a note. Missing, expired and
already read all return the same 404 body.

Limits are 20 creates and 60 reads per hour per address, held in memory.

## Layout

    src/config.js        environment and dotenv loading
    src/db.js            libSQL client and schema
    src/notes.js         create, burn, stats, purge
    src/ids.js           128 bit note ids
    src/validation.js    request validation
    src/rate-limit.js    in memory limiter per address
    src/ip.js            client address
    src/sweep.js         expired row cleanup
    src/security.js      response header policy
    src/paths.js         absolute paths
    src/routes/api.js    json endpoints
    src/routes/pages.js  html endpoints
    src/app.js           route assembly
    src/server.js        node entry
    api/index.js         single host entry for Vercel
    public/              frontend, no build step
    test/                node test runner tests

## Security notes

Read THREAT_MODEL.md. It covers what the server can and cannot see, what leaks
when you paste a link into a chat app, and the limits of the design.

The short version: this hides the contents of a note from the server. It does
not hide who sent it, who read it, or how long it was.

## Screenshots

Drop images in `docs/` and reference them here.

    ![Write page](docs/write.png)
    ![Note waiting](docs/waiting.png)
    ![Burned](docs/burned.png)

Captured at 360, 768 and 1280 pixels wide.

## Deploy

See DEPLOY.md for Render and Vercel. Both run a single process on a single
origin.

You will need a fresh Turso token. See the first section of DEPLOY.md.

## Licence

GPL 3.0. See LICENSE.
