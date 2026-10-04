# Deploy

BurnNotes runs as one process. The HTML, the CSS, the JavaScript and the JSON
api all come from the same origin, so there is no second host to configure.

## Before either platform

You need a working Turso token. The token that was in `.env` is rejected by
Turso with:

    invalid JWT token: can't be decoded with any of the existing keys

The token is well formed and carries read write permission, but its key id does
not match any signing key that database accepts. Mint a new one:

    npx @turso/cli db tokens create burnnotes-jagath-sajjan --permission rw

If the database does not exist yet:

    npx @turso/cli db create burnnotes-jagath-sajjan --group aws-ap-south-1

The server creates its own tables on boot, so there is no migration step. Do not
run the Turso shell against `notes` by hand.

The database URL is not a secret and is safe to commit. The auth token is a
secret and must never be committed. `.env` is gitignored for that reason, and
`.env.example` holds placeholders only.

## Render

Render is the simpler of the two. One web service, one environment.

1. Push the repository to GitHub.
2. In the Render dashboard choose New, then Web Service, then connect the
   repository.
3. Fill in the settings.

       Name              burnnotes
       Runtime           Node
       Build command     npm ci
       Start command     node src/server.js
       Health check path /api/health

4. `render.yaml` already declares all of the above, so Render will offer to
   apply the blueprint. Accepting it is enough.
5. Under Environment add the secrets by hand. Mark the token secret.

       NODE_ENV           production
       PORT               10000
       TRUST_PROXY        true
       TURSO_DATABASE_URL libsql://burnnotes-jagath-sajjan.aws-ap-south-1.turso.io
       TURSO_AUTH_TOKEN   the token you just minted

6. `TRUST_PROXY` matters. Without it every visitor shares one rate limit bucket
   because they all appear to come from Render's proxy. Set it only because
   Render strips any client supplied `X-Forwarded-For`.
7. Deploy. The first request to `/api/health` returning `{"ok":true}` confirms
   the schema was created.
8. The public disk is not needed. There is no file database in production.

There is no persistent disk on the free plan, which is fine, because production
uses Turso and the file database only exists for local development.

## Vercel

1. Push the repository to GitHub.
2. In the Vercel dashboard choose New Project and import the repository. Leave
   the framework preset as None. Do not set a build command.
3. Add the environment variables for production.

       NODE_ENV           production
       TURSO_DATABASE_URL libsql://burnnotes-jagath-sajjan.aws-ap-south-1.turso.io
       TURSO_AUTH_TOKEN   the token you just minted
       TRUST_PROXY        true

4. Deploy. Vercel builds `api/index.js` as a single function.
5. Read `vercel.json`. It routes every path, including `/assets/*`, through that
   one function. This matters. A `rewrites` entry would lose the race against
   Vercel's own static file serving, which happens first, and the CSS and
   JavaScript would then be served without your security headers. Do not change
   `routes` to `rewrites`.
6. Cold starts re-run the schema statements. They are all `IF NOT EXISTS`, so
   this is safe but does cost a few queries per cold start.

## Checking a deployment

    curl -sI https://YOUR_HOST/ | grep -iE 'content-security|referrer|cache-control'
    curl -s https://YOUR_HOST/api/health
    curl -s https://YOUR_HOST/api/stats

The first must show the policy, the second `{"ok":true}`, the third a `burned`
count.

Then open the app, write a note, open the link in a private window, confirm the
text appears, then open the same link again and confirm it says the note has
been burned.

## Note on Vercel and the file database

Vercel functions have a read only filesystem apart from `/tmp`. Set
`DATABASE_URL=file:/tmp/burnnotes.db` if you want a throwaway local file, but do
not expect it to persist between invocations. Production must use Turso.
