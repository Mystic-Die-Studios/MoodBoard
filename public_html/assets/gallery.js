(function () {
  'use strict';

  // ---- tiny helpers ----------------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  function toast(msg, isErr) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.toggle('err', !!isErr);
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }
  async function api(path, opts) {
    const res = await fetch('api/' + path, Object.assign({ headers: {} }, opts));
    let body = null;
    try { body = await res.json(); } catch (_) {}
    if (!res.ok) {
      const err = new Error((body && body.error) || res.statusText);
      err.status = res.status; err.body = body;
      throw err;
    }
    return body;
  }
  const postJSON = (path, data) =>
    api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

  function timeAgo(unixSec) {
    if (!unixSec) return '';
    const s = Math.max(1, Math.floor(Date.now() / 1000 - unixSec));
    const units = [[31536000, 'y'], [2592000, 'mo'], [86400, 'd'], [3600, 'h'], [60, 'm']];
    for (const [sec, label] of units) if (s >= sec) return Math.floor(s / sec) + label + ' ago';
    return s + 's ago';
  }
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- auth gate -------------------------------------------------------------
  function showGate(title) {
    if (title) { $('#gateTitle').textContent = title; }
    $('#gate').hidden = false;
    $('#passcode').focus();
  }
  function hideGate() { $('#gate').hidden = true; }

  $('#gateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#gateErr').textContent = '';
    try {
      await postJSON('auth.php', { passcode: $('#passcode').value });
      hideGate();
      $('#passcode').value = '';
      loadBoards();
    } catch (err) {
      $('#gateErr').textContent = (err.body && err.body.detail) || 'Incorrect passcode.';
    }
  });

  $('#logoutBtn').addEventListener('click', async () => {
    try { await api('auth.php', { method: 'DELETE' }); } catch (_) {}
    $('#grid').innerHTML = '';
    showGate();
  });

  // ---- board grid ------------------------------------------------------------
  function render(boards) {
    const grid = $('#grid');
    grid.innerHTML = '';

    const newTile = document.createElement('div');
    newTile.className = 'tile new';
    newTile.innerHTML = '<div><div class="plus">+</div><div>New board</div></div>';
    newTile.addEventListener('click', createBoard);
    grid.appendChild(newTile);

    for (const b of boards) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      const thumbStyle = b.thumb ? ` style="background-image:url('${escapeHtml(b.thumb)}')"` : '';
      tile.innerHTML =
        `<div class="thumb"${thumbStyle}>${b.thumb ? '' : 'open'}</div>` +
        `<div class="meta"><div class="t">` +
          `<div class="name">${escapeHtml(b.title)}</div>` +
          `<div class="when">${timeAgo(b.updated)}</div>` +
        `</div><button class="icon danger" title="Delete">&times;</button></div>`;
      tile.querySelector('.thumb').addEventListener('click', () => open(b.id));
      tile.querySelector('.name').addEventListener('click', () => open(b.id));
      tile.querySelector('.danger').addEventListener('click', (e) => { e.stopPropagation(); del(b); });
      grid.appendChild(tile);
    }
    $('#empty').classList.toggle('hidden', boards.length > 0);
  }

  function open(id) { location.href = 'board.html?id=' + encodeURIComponent(id); }

  async function createBoard() {
    const title = prompt('Name this board:', 'Untitled board');
    if (title === null) return;
    try {
      const r = await postJSON('boards.php', { title });
      open(r.id);
    } catch (err) { toast('Could not create board', true); }
  }

  async function del(b) {
    if (!confirm(`Delete "${b.title}"? This cannot be undone.`)) return;
    try {
      await postJSON('board-delete.php', { id: b.id });
      toast('Board deleted');
      loadBoards();
    } catch (err) { toast('Delete failed', true); }
  }

  async function loadBoards() {
    try {
      const r = await api('boards.php');
      render(r.boards || []);
    } catch (err) {
      if (err.status === 401) showGate();
      else toast('Failed to load boards', true);
    }
  }

  // ---- init ------------------------------------------------------------------
  $('#newBtn').addEventListener('click', createBoard);
  (async function init() {
    try {
      const s = await api('auth.php');
      if (s.title) { $('#appTitle').textContent = s.title; $('#gateTitle').textContent = s.title; document.title = s.title; }
      if (s.authed) loadBoards(); else showGate(s.title);
    } catch (_) { showGate(); }
  })();
})();
