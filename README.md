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
5. The reader gets the text, and that same statement deletes the row. There is
   no second read.

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

    POST /api/notes              { ciphertext, iv, ttl, burnMode }  returns { id }
    GET  /api/notes/:id/expiry   mode and expiry, no ciphertext
    POST /api/notes/:id/peek     manual notes only, does not destroy
    POST /api/notes/:id/read     destroys the note   returns { ciphertext, iv }
    GET  /api/stats              returns { burned }
    GET  /api/health             returns { ok }

`ttl` is one of `10m`, `1h`, `24h`, `7d`. `burnMode` is `auto` or `manual`, and
defaults to `auto`. A manual note cannot outlive 24 hours. Ciphertext is capped
at 16KB. Reads are `POST` only. Missing, expired, already read and peeked at an
auto note all return the same 404 body.

Limits are 20 creates and 60 reads per hour per address, held in memory.

## Burn modes

**Auto burn** destroys the server copy the moment the link is opened. The reader
gets 15 seconds plus 90 milliseconds per character, capped at 90 seconds, and a
link preview cannot trigger it because the key lives in the fragment.

**Manual burn** leaves the note on the server until the reader presses Burn.
The reader gets as long as the expiry allows. If they close the tab it is still
destroyed on time by the sweeper. Use this when the reader may need longer than
a countdown allows.

## Reading speed

Auto burn holds the note open for 15 seconds plus 90 milliseconds per
character, capped at 90 seconds. The server copy is deleted at the start of that
window, not the end. Manual burn reads `expires_at` and shows the time
remaining.

## Layout

    src/config.js        environment and dotenv loading
    src/db.js            libSQL client and schema
    src/notes.js         create, burn, peek, stats, purge
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

## Checking it end to end

`npm test` runs the unit and API suite against a temporary database. To drive a
running server as a browser would:

    npm run start:local
    node test/e2e.local.mjs

## Deploy

See DEPLOY.md for Render and Vercel. Both run a single process on a single
origin.

You will need a fresh Turso token. See the first section of DEPLOY.md.

## Licence

GPL 3.0. See LICENSE.
