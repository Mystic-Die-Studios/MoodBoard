# MoodBoard

A hosted, passcode-gated mood-board app. Create boards and on each one **upload + resize
images, add simple shapes, write text, and draw freehand in different colors and sizes.**
Boards are saved on the server as JSON and reopened/edited later (async — refresh to see
others' changes).

Built on the same lightweight stack as the prior project: **PHP 8.1+, vanilla JS, no
database, no build step.** Rendering uses **[Fabric.js](http://fabricjs.com/)** (vendored, no
npm). Persistence is flat JSON files under `data/boards/`; uploaded images live in `uploads/`.

## Layout

```
public_html/
  index.html  board.html         # gallery + editor pages
  assets/  app.css gallery.js editor.js  vendor/fabric.min.js
  api/     lib.php auth.php boards.php board-get/save/delete.php upload.php
  data/    .htaccess  boards/<id>.json   # board docs (git-ignored)
  uploads/ <id>/<file>                   # downscaled images (git-ignored)
  config.example.php  .htaccess
```

## Local development (Windows)

1. Install PHP 8.1+ (`winget install PHP.PHP.8.3`). The winget build ships **no active
   `php.ini`** — create one next to `php.exe` (path from `php --ini`) enabling at least
   `mbstring`, `fileinfo`, `openssl`, `curl`. Verify with `php -m`.
2. Create `public_html/config.local.php` (git-ignored) from `config.example.php`. A working
   local file with passcode **`moodboard`** is already provided. To change it:
   `php -r "echo password_hash('NEWPASS', PASSWORD_DEFAULT), PHP_EOL;"` → paste into
   `PASSCODE_HASH`.
3. Run: `php -S localhost:8000 -t public_html`
4. Open <http://localhost:8000>, enter the passcode, create a board.

`config.local.php` is loaded automatically on `localhost`; `config.php` is used everywhere else.

## How it works

- **Auth** — one shared passcode (`password_verify` against `PASSCODE_HASH`) sets a
  server session (`HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS). All `api/*` endpoints
  except `auth.php` call `require_auth()`.
- **Editor** — a Fabric canvas. The toolbar adds text/shapes/images, toggles a free-drawing
  brush (color + size), and edits the selected object's color/size. Changes **auto-save**
  (debounced ~1.2 s) and on demand (Save / Ctrl+S); a small **thumbnail** is stored for the
  gallery. **Undo/redo** keeps a JSON-snapshot stack.
- **Images** — downscaled client-side to ≤1600 px before upload (keeps board JSON small);
  `upload.php` validates MIME via `finfo` and stores the file, returning a same-origin URL.
- **Persistence** — `board-save.php` writes `data/boards/<id>.json` atomically (temp +
  rename). Model is **last-write-wins**; the editor shows save status and a **Refresh** button
  to reload the server copy.

## Verify

- Lint after edits: `node --check public_html/assets/*.js` and `php -l public_html/api/*.php`.
- Manual end-to-end (browser): passcode → new board → upload an image and resize it → add a
  rectangle + ellipse → add/edit text → free-draw in 2 colors and 2 brush sizes → reload and
  confirm it persisted → open in a second browser/incognito (re-enter passcode) and confirm
  the saved state loads → delete the board.

## Deploy

See **[DEPLOY.md](DEPLOY.md)** (cPanel/LiteSpeed on Namecheap). Short version: clone via
cPanel Git, point the subdomain document root at `public_html/`, set PHP 8.1+, run AutoSSL,
and create `public_html/config.php` (chmod 600) with a real `PASSCODE_HASH`.
