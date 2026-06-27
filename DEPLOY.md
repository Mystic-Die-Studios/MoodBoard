# Deploy — cPanel / LiteSpeed (Namecheap)

No build step. Deploy by cloning the repo through cPanel Git and pointing a subdomain at
`public_html/`. Mirrors the prior project's hosting; only auth differs (shared passcode,
no GitHub OAuth).

## 1. Clone via cPanel Git Version Control

For a **private** repo, add a read-only deploy key first:
1. cPanel **SSH Access → Manage SSH Keys → Generate** (RSA, no passphrase); copy the **public** key.
2. GitHub repo **Settings → Deploy keys → Add deploy key** (read-only) → paste it.
3. cPanel SSH Keys → **Manage → Authorize** the key.
4. cPanel **Git Version Control → Create** → clone URL `git@github.com:<owner>/MoodBoard.git`
   → path `/home/USER/repositories/MoodBoard`.

(Public repo: skip the key; clone the HTTPS URL.)

## 2. Point the subdomain at public_html/

1. **Domains** → create/select a subdomain (e.g. `mood.yourdomain.com`) and set its
   **Document Root** to `/home/USER/repositories/MoodBoard/public_html`.
2. **MultiPHP Manager** → set the subdomain to **PHP 8.1+**.

## 3. Config (not in git)

Create `public_html/config.php` from `config.example.php`, set a real passcode hash, chmod **600**:

```bash
cd ~/repositories/MoodBoard/public_html
cp config.example.php config.php
php -r "echo password_hash('YOUR-PASSCODE', PASSWORD_DEFAULT), PHP_EOL;"   # paste into PASSCODE_HASH
chmod 600 config.php
```

`config.php`, `data/boards/`, and `uploads/` are **git-ignored**, so `Update from Remote`
never overwrites them.

## 4. Writable data + uploads

```bash
mkdir -p data/boards uploads
chmod 775 data data/boards uploads        # 755 if the PHP user owns them
```

`data/.htaccess` blocks direct web access to board JSON (served only via `api/*.php`).
Verify after deploy that `https://mood.yourdomain.com/data/boards/anything.json` is **403/denied**.

## 5. SSL / HTTPS

cPanel → **SSL/TLS Status → run AutoSSL** for the subdomain; confirm `https://` loads.
Session cookies are marked `Secure` only over HTTPS (detected via `HTTPS` /
`X-Forwarded-Proto` / port 443 in `lib.php`).

## 6. Upload limits

Default PHP caps may be small (e.g. `upload_max_filesize = 2M`). The client downscales images
to ≤1600 px first, so most uploads fit, but to be safe raise limits in **MultiPHP INI Editor**:
`upload_max_filesize = 10M`, `post_max_size = 12M`. Keep `config.php`'s `UPLOAD_MAX` ≤ these.

## Updates

cPanel → **Git Version Control → Manage → Update from Remote / Pull**. Static files + PHP
deploy instantly; no restart needed.

## LiteSpeed caching (important)

`public_html/.htaccess` and `lib.php` send aggressive no-cache headers
(`Cache-Control: no-store`, `X-LiteSpeed-Cache-Control: no-cache`). Keep them — caching the
session/auth responses would break sign-in. If you add a LiteSpeed Cache plugin, exclude this
subdomain.
