<?php
// Copy to config.php (production) or config.local.php (localhost) and edit.
// config.php should be chmod 600 in production. Both are git-ignored.
//
// Generate a passcode hash with:
//   php -r "echo password_hash('your-passcode-here', PASSWORD_DEFAULT), PHP_EOL;"
return [
  // password_hash() output for the shared passcode that gates the app.
  'PASSCODE_HASH' => '$2y$10$REPLACE_WITH_REAL_HASH_FROM_password_hash',

  // Branding shown in the UI.
  'APP_TITLE'     => 'MoodBoard',

  // Max upload size in bytes (server-side cap; client downscales first).
  'UPLOAD_MAX'    => 8 * 1024 * 1024,

  // Longest edge (px) the client downscales uploaded images to before upload.
  'IMG_MAX_DIM'   => 1600,
];
