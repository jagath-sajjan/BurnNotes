# Threat model

BurnNotes is built for one job: hand a short secret to one person over a channel
you do not fully control, and make sure nobody, including the server, can read
it twice.

## What the server holds

For every live note the database contains four values and nothing else:

    id           128 bit random, generated on the server
    ciphertext   AES GCM output, base64url
    iv           12 random bytes, base64url
    created_at   milliseconds
    expires_at   milliseconds
    burn_mode    `auto` or `manual`

Plus one row in `stats` holding a single integer, the number of notes burned.

## What the server never receives

The plaintext and the key never leave the browser. Specifically:

1. The browser generates a fresh 256 bit key and a fresh 96 bit iv per note.
2. The browser encrypts with the Web Crypto API.
3. Only `ciphertext`, `iv` and `ttl` are sent in the request body.
4. The key is placed in the URL fragment, written as `https://host/n/ID#KEY`.
5. Browsers do not send the fragment to the server in the request line, and it
   is not in the `Referer` header either.

So the server is a blind store. It can see that a note exists, roughly how long
it is, and when it was destroyed. It cannot open it.

## What the server can still learn

Honest limits of the blind store model:

1. **Length.** AES GCM output is plaintext length plus 28 bytes. Anyone with a
   database dump learns the exact character count of every note. Length alone
   can leak a great deal about some formats.
2. **Timing.** The server knows the creation time, the destruction time, and the
   source address of both. It can tell that a person at address A handed a
   secret to a person at address B, and how long the secret sat unread. That is
   metadata, and metadata is often enough.
3. **Volume.** The burned counter is global and public. It reveals how much
   traffic the service handles.
4. **Aggregate size and churn.** Row counts and insert rates describe usage.

## Link sharing channels

Sending a one time link is where most real leaks happen, not in the crypto.

1. **Link preview bots.** WhatsApp, Slack, Telegram, Discord and most mail
   clients fetch a URL when it appears in a message, to build a preview. If a
   read were a `GET`, that prefetch would destroy the note before the recipient
   ever saw it. Reads are therefore `POST` only, fired by a button click. A bot
   sends no fragment and presses no button, so it cannot burn anything. This is
   the single most important design decision in the app.
2. **Channels that strip the fragment.** Some apps treat `#` as an anchor and
   drop everything after it, or normalise it away. The recipient then receives
   `https://host/n/ID` with no key. The client refuses to send a read request
   when the fragment is absent, so the note survives and the sender can reissue
   it. This is deliberate, and it is tested.
3. **Clipboard, clipboard managers and OS history.** The full link including the
   key is in the clipboard. Clipboard managers, cloud clipboard sync and the
   system keychain may retain it long after you close the tab.
4. **Browser history and sync.** The key sits in the address bar until the note
   is opened, at which point `history.replaceState` removes it. If you close
   the tab first, or the machine is shared, the key stays in history. Browser
   account sync copies history to a server you do not control.
5. **Screenshots, screen sharing, shoulder surfing.** The key is visible in the
   address bar for as long as the note is unopened.
6. **Search engines and archives.** Pages under `/n/` carry
   `X-Robots-Tag` style `noindex` and are served `no-store`, and the burned page
   is not a preview of the note, so there is nothing for a crawler to index.

## Limits of the design

1. **One read means one read.** A note that was opened has been destroyed. There
   is no recovery, no undo and no second copy. If the recipient closes the
   browser mid read, the secret is gone.
2. **No forward secrecy.** If the key leaks later, from history or a clipboard
   manager, then a ciphertext captured from the database can be decrypted
   later. The note is not retroactively safe.
3. **No protection of the plaintext after reading.** Once someone opens a note
   they can photograph it, copy it, or re-share it. The app controls the server
   copy, not the human copy.
4. **The recipient must be trusted.** BurnNotes delivers a secret to whoever
   holds the link. It is not an identity system and does not authenticate the
   reader.
5. **Metadata is not protected.** See the section above. This design hides
   content, not traffic patterns.
6. **One key per note.** Keys are never reused across notes. This bounds the
   damage of any single key leak to exactly one note, and it removes the GCM
   nonce reuse failure mode entirely. It does not protect the one note whose
   key leaked.
7. **Third party database.** Turso stores the ciphertext. It cannot decrypt
   without the key, which it never receives. It could however delete, corrupt or
   substitute rows, and it can read creation times and sizes.
8. **Rate limits are per process and in memory.** They reset when the process
   restarts. On a deployment with more than one instance the effective limit is
   the per process limit multiplied by the instance count. `TRUST_PROXY` is off
   by default; turning it on is only safe when the platform strips any client
   supplied `X-Forwarded-For`.
9. **Manual notes are not destroyed on close.** A manual note stays in the
   database until the reader burns it or `expires_at` passes. Closing the tab
   does not burn it, which is the whole point of the mode, but it means the
   ciphertext sits on the server longer. It is capped at 24 hours and the
   sweeper removes it on time. Anyone who wants destruction on close must use
   auto mode.
10. **`peek` returns ciphertext without destroying it.** Peeking is only
   offered on manual notes, is rate limited like a read, and hands back the
   same opaque bytes the database already holds. It reveals nothing the
   database does not already hold, but it does keep a note readable for as long
   as its expiry allows.
11. **Out of scope.** A malicious browser extension with host permissions, a
   compromised device, a hostile origin that the user grants access to, screen
   capture, and traffic analysis are all outside this design.

## What is actually enforced

1. Ciphertext only in the database. Covered by a test that stores a known
   plaintext canary and asserts it appears nowhere in the stored row.
2. Second read always fails. Covered by tests for the sequential case and for
   two concurrent reads, where exactly one receives the note.
3. Missing, expired and already read all return one identical body, so the
   endpoint is not an oracle for which of the three happened.
4. Reads are `POST`. A `GET` on a live note returns not found and leaves the
   note intact, so a link preview cannot burn it.
5. Note text is rendered with `textContent` only. Covered by a test that stores
   markup including a script and an image error handler, and asserts it renders
   as visible text with no element created and no handler run.
6. The fragment is cleared from history immediately after the read request
   returns, whether or not decryption then succeeds.
7. A strict content security policy with no inline script and no inline style
   blocks the common paths for injected script to exfiltrate the key.
8. Auto mode only burns on load when the URL fragment is present. A link preview
   fetches the page without the fragment, so it is refused before any request
   is made. This is the real link preview defence, not the `POST` requirement
   alone.
9. `peek` on an auto note returns the same not found body as a missing note, so
   the endpoint does not confirm that an auto note exists.
10. Manual notes cannot be created with an expiry longer than 24 hours.

## Reading speed

Auto mode holds a note open before destroying it. The window is 15 seconds plus
90 milliseconds per character, capped at 90 seconds. This is a deliberate trade:
the original design destroyed on load, which meant a long note could be read
only once and only if the reader was fast. The plaintext still exists only in
one reader's browser during that window, and the server copy is deleted at the
start of it, not at the end.
