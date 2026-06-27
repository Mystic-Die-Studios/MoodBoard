<?php
// GET ?id=... -> full board {id,title,updated,doc}
require __DIR__ . '/lib.php';
require_auth();

$id = (string)($_GET['id'] ?? '');
if (!valid_id($id)) fail(400, 'bad_id');
$path = board_path($id);
if (!is_file($path)) fail(404, 'not_found');

$board = json_decode((string) file_get_contents($path), true);
if (!is_array($board)) fail(500, 'corrupt');
json_out($board);
