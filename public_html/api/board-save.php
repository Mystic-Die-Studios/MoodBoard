<?php
// POST {id, doc, title?, thumb?} -> persist board (atomic write). Last-write-wins.
require __DIR__ . '/lib.php';
require_auth();
if (method() !== 'POST') fail(405, 'method_not_allowed');

$in = json_in();
$id = (string)($in['id'] ?? '');
if (!valid_id($id)) fail(400, 'bad_id');
$path = board_path($id);
if (!is_file($path)) fail(404, 'not_found');

$existing = json_decode((string) file_get_contents($path), true);
if (!is_array($existing)) $existing = ['id' => $id];

$board = [
  'id'      => $id,
  'title'   => isset($in['title']) ? mb_substr(trim((string)$in['title']), 0, 120) : ($existing['title'] ?? 'Untitled'),
  'updated' => time(),
  'doc'     => array_key_exists('doc', $in) ? $in['doc'] : ($existing['doc'] ?? null),
  // Thumbnail is a small data-URL string; cap its length defensively.
  'thumb'   => isset($in['thumb']) && is_string($in['thumb']) && strlen($in['thumb']) < 200000
                 ? $in['thumb'] : ($existing['thumb'] ?? null),
];

// Atomic write: temp file + rename.
$tmp = $path . '.tmp.' . getmypid();
$json = json_encode($board, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
if ($json === false) fail(400, 'encode_failed', json_last_error_msg());
if (file_put_contents($tmp, $json) === false) fail(500, 'write_failed');
if (!rename($tmp, $path)) { @unlink($tmp); fail(500, 'rename_failed'); }

json_out(['ok' => true, 'updated' => $board['updated']]);
