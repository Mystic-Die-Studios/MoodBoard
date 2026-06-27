<?php
// POST {passcode} -> verify -> set session. GET -> report current auth state.
require __DIR__ . '/lib.php';

if (method() === 'GET') {
  json_out(['authed' => is_authed(), 'title' => config('APP_TITLE', 'MoodBoard')]);
}

if (method() === 'POST') {
  start_session();
  $in = json_in();
  $passcode = (string)($in['passcode'] ?? '');
  $hash = (string) config('PASSCODE_HASH', '');

  if ($hash !== '' && $passcode !== '' && password_verify($passcode, $hash)) {
    session_regenerate_id(true); // prevent fixation
    $_SESSION['ok'] = true;
    json_out(['authed' => true]);
  }
  usleep(400000); // ~0.4s throttle on bad attempts
  fail(401, 'bad_passcode', 'Incorrect passcode.');
}

if (method() === 'DELETE') { // logout
  start_session();
  $_SESSION = [];
  if (session_status() === PHP_SESSION_ACTIVE) session_destroy();
  json_out(['authed' => false]);
}

fail(405, 'method_not_allowed');
