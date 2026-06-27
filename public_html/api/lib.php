<?php
// Shared helpers for all MoodBoard API endpoints. No DB; JSON files on disk.
declare(strict_types=1);

// ---- No-cache (LiteSpeed gotcha from the prior project) ----------------------
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-LiteSpeed-Cache-Control: no-cache');
header('Content-Type: application/json; charset=utf-8');

// ---- Config ------------------------------------------------------------------
function config(string $key, $default = null) {
  static $cfg = null;
  if ($cfg === null) {
    $base = dirname(__DIR__); // public_html/
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $isLocal = (strpos($host, 'localhost') !== false) || (strpos($host, '127.0.0.1') !== false);
    $file = $isLocal && is_file("$base/config.local.php") ? "$base/config.local.php" : "$base/config.php";
    $cfg = is_file($file) ? (require $file) : [];
    if (!is_array($cfg)) $cfg = [];
  }
  return array_key_exists($key, $cfg) ? $cfg[$key] : $default;
}

// ---- Paths -------------------------------------------------------------------
function base_dir(): string { return dirname(__DIR__); }            // public_html/
function boards_dir(): string {
  $d = base_dir() . '/data/boards';
  if (!is_dir($d)) @mkdir($d, 0775, true);
  return $d;
}
function uploads_base(): string {
  $d = base_dir() . '/uploads';
  if (!is_dir($d)) @mkdir($d, 0775, true);
  return $d;
}
// Strict id validation prevents path traversal: only our generated ids match.
function valid_id(string $id): bool { return (bool) preg_match('/^[A-Za-z0-9_-]{6,40}$/', $id); }
function board_path(string $id): string { return boards_dir() . '/' . $id . '.json'; }
function uploads_dir(string $id): string {
  $d = uploads_base() . '/' . $id;
  if (!is_dir($d)) @mkdir($d, 0775, true);
  return $d;
}
function new_id(): string {
  // URL-safe, ~22 chars, collision-resistant.
  return rtrim(strtr(base64_encode(random_bytes(15)), '+/', '-_'), '=');
}

// ---- Session + auth ----------------------------------------------------------
function start_session(): void {
  if (session_status() === PHP_SESSION_ACTIVE) return;
  $https = (($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off')
    || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
    || (($_SERVER['SERVER_PORT'] ?? '') === '443');
  session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'httponly' => true,
    'secure'   => $https,
    'samesite' => 'Lax',
  ]);
  session_start();
}
function is_authed(): bool { start_session(); return !empty($_SESSION['ok']); }
function require_auth(): void {
  if (!is_authed()) fail(401, 'auth_required', 'Enter the passcode to continue.');
}

// ---- Request / response helpers ---------------------------------------------
function json_in(): array {
  $raw = file_get_contents('php://input');
  $data = json_decode($raw ?: 'null', true);
  return is_array($data) ? $data : [];
}
function json_out($data, int $code = 200): void {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}
function fail(int $code, string $error, string $detail = ''): void {
  json_out(['error' => $error, 'detail' => $detail], $code);
}
function method(): string { return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'); }

// Recursively remove a directory (used when deleting a board's uploads).
function rrmdir(string $dir): void {
  if (!is_dir($dir)) return;
  foreach (scandir($dir) ?: [] as $f) {
    if ($f === '.' || $f === '..') continue;
    $p = "$dir/$f";
    is_dir($p) ? rrmdir($p) : @unlink($p);
  }
  @rmdir($dir);
}
