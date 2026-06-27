<?php
// POST multipart {board:<id>, file:<image>} -> store under uploads/<id>/ -> {url}
// Client downscales before upload; this validates MIME + size and saves the bytes.
require __DIR__ . '/lib.php';
require_auth();
if (method() !== 'POST') fail(405, 'method_not_allowed');

$id = (string)($_POST['board'] ?? '');
if (!valid_id($id)) fail(400, 'bad_id');
if (!is_file(board_path($id))) fail(404, 'board_not_found');

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
  fail(400, 'no_file', 'Upload failed (' . ($_FILES['file']['error'] ?? 'missing') . ').');
}
$f = $_FILES['file'];
$max = (int) config('UPLOAD_MAX', 8 * 1024 * 1024);
if ($f['size'] > $max) fail(413, 'too_large', 'Image exceeds ' . round($max / 1048576) . ' MB.');

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = (string) $finfo->file($f['tmp_name']);
$ext = [
  'image/png'  => 'png',
  'image/jpeg' => 'jpg',
  'image/webp' => 'webp',
  'image/gif'  => 'gif',
][$mime] ?? null;
if ($ext === null) fail(415, 'bad_type', "Unsupported image type: $mime");

$name = new_id() . '.' . $ext;
$dest = uploads_dir($id) . '/' . $name;
if (!move_uploaded_file($f['tmp_name'], $dest)) {
  // Fallback for CLI/dev servers where move_uploaded_file may not apply.
  if (!@rename($f['tmp_name'], $dest)) fail(500, 'store_failed');
}

// URL relative to the document root (public_html/).
json_out(['url' => 'uploads/' . $id . '/' . $name]);
