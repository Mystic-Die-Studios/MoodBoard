<?php
// POST {id} -> remove board JSON + its uploads directory.
require __DIR__ . '/lib.php';
require_auth();
if (method() !== 'POST') fail(405, 'method_not_allowed');

$in = json_in();
$id = (string)($in['id'] ?? '');
if (!valid_id($id)) fail(400, 'bad_id');

$path = board_path($id);
if (is_file($path)) @unlink($path);
rrmdir(uploads_base() . '/' . $id);

json_out(['ok' => true]);
