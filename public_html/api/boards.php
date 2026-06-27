<?php
// GET  -> list all boards [{id,title,updated}], newest first
// POST {title} -> create an empty board, returns {id}
require __DIR__ . '/lib.php';
require_auth();

if (method() === 'GET') {
  $out = [];
  foreach (glob(boards_dir() . '/*.json') ?: [] as $file) {
    $b = json_decode((string) file_get_contents($file), true);
    if (!is_array($b) || empty($b['id'])) continue;
    $out[] = [
      'id'      => $b['id'],
      'title'   => $b['title'] ?? 'Untitled',
      'updated' => $b['updated'] ?? 0,
      'thumb'   => !empty($b['thumb']) ? $b['thumb'] : null,
    ];
  }
  usort($out, fn($a, $b) => ($b['updated'] <=> $a['updated']));
  json_out(['boards' => $out]);
}

if (method() === 'POST') {
  $in = json_in();
  $title = trim((string)($in['title'] ?? ''));
  if ($title === '') $title = 'Untitled board';
  if (mb_strlen($title) > 120) $title = mb_substr($title, 0, 120);

  $id = new_id();
  $board = [
    'id'      => $id,
    'title'   => $title,
    'updated' => time(),
    'doc'     => null, // empty Fabric canvas until first save
    'thumb'   => null,
  ];
  file_put_contents(board_path($id), json_encode($board, JSON_UNESCAPED_SLASHES));
  json_out(['id' => $id, 'title' => $title]);
}

fail(405, 'method_not_allowed');
