(function () {
  'use strict';

  // ---- constants -------------------------------------------------------------
  const IMG_MAX_DIM = 1600;     // client downscale cap (longest edge)
  const HIST_MAX = 60;          // undo depth
  const MIN_ZOOM = 0.1, MAX_ZOOM = 8;
  const SNAP_PX = 6;            // snap threshold (screen px)
  const NEAR_PX = 260;         // only snap to objects within this screen distance

  // Font library — system fonts + a broad Google Fonts set (loaded on demand).
  // { label, css, g: google family name, w: has a 700 weight }
  const FONTS = [
    { label: 'Sans (system)', css: 'system-ui, sans-serif' },
    { label: 'Serif (Georgia)', css: 'Georgia, serif' },
    { label: 'Mono (system)', css: "'Courier New', monospace" },
    { label: 'Roboto', css: "'Roboto', sans-serif", g: 'Roboto', w: 1 },
    { label: 'Open Sans', css: "'Open Sans', sans-serif", g: 'Open Sans', w: 1 },
    { label: 'Lato', css: "'Lato', sans-serif", g: 'Lato', w: 1 },
    { label: 'Montserrat', css: "'Montserrat', sans-serif", g: 'Montserrat', w: 1 },
    { label: 'Poppins', css: "'Poppins', sans-serif", g: 'Poppins', w: 1 },
    { label: 'Inter', css: "'Inter', sans-serif", g: 'Inter', w: 1 },
    { label: 'Raleway', css: "'Raleway', sans-serif", g: 'Raleway', w: 1 },
    { label: 'Nunito', css: "'Nunito', sans-serif", g: 'Nunito', w: 1 },
    { label: 'Work Sans', css: "'Work Sans', sans-serif", g: 'Work Sans', w: 1 },
    { label: 'Quicksand', css: "'Quicksand', sans-serif", g: 'Quicksand', w: 1 },
    { label: 'Oswald', css: "'Oswald', sans-serif", g: 'Oswald', w: 1 },
    { label: 'Bebas Neue', css: "'Bebas Neue', sans-serif", g: 'Bebas Neue' },
    { label: 'Anton', css: "'Anton', sans-serif", g: 'Anton' },
    { label: 'Archivo Black', css: "'Archivo Black', sans-serif", g: 'Archivo Black' },
    { label: 'Righteous', css: "'Righteous', sans-serif", g: 'Righteous' },
    { label: 'Fredoka', css: "'Fredoka', sans-serif", g: 'Fredoka', w: 1 },
    { label: 'Comfortaa', css: "'Comfortaa', sans-serif", g: 'Comfortaa', w: 1 },
    { label: 'Merriweather', css: "'Merriweather', serif", g: 'Merriweather', w: 1 },
    { label: 'Playfair Display', css: "'Playfair Display', serif", g: 'Playfair Display', w: 1 },
    { label: 'Lora', css: "'Lora', serif", g: 'Lora', w: 1 },
    { label: 'PT Serif', css: "'PT Serif', serif", g: 'PT Serif', w: 1 },
    { label: 'Roboto Slab', css: "'Roboto Slab', serif", g: 'Roboto Slab', w: 1 },
    { label: 'Cinzel', css: "'Cinzel', serif", g: 'Cinzel', w: 1 },
    { label: 'Abril Fatface', css: "'Abril Fatface', serif", g: 'Abril Fatface' },
    { label: 'Roboto Mono', css: "'Roboto Mono', monospace", g: 'Roboto Mono', w: 1 },
    { label: 'JetBrains Mono', css: "'JetBrains Mono', monospace", g: 'JetBrains Mono', w: 1 },
    { label: 'Space Mono', css: "'Space Mono', monospace", g: 'Space Mono', w: 1 },
    { label: 'Lobster', css: "'Lobster', cursive", g: 'Lobster' },
    { label: 'Pacifico', css: "'Pacifico', cursive", g: 'Pacifico' },
    { label: 'Dancing Script', css: "'Dancing Script', cursive", g: 'Dancing Script', w: 1 },
    { label: 'Caveat', css: "'Caveat', cursive", g: 'Caveat', w: 1 },
    { label: 'Satisfy', css: "'Satisfy', cursive", g: 'Satisfy' },
    { label: 'Great Vibes', css: "'Great Vibes', cursive", g: 'Great Vibes' },
    { label: 'Sacramento', css: "'Sacramento', cursive", g: 'Sacramento' },
    { label: 'Shadows Into Light', css: "'Shadows Into Light', cursive", g: 'Shadows Into Light' },
    { label: 'Indie Flower', css: "'Indie Flower', cursive", g: 'Indie Flower' },
    { label: 'Permanent Marker', css: "'Permanent Marker', cursive", g: 'Permanent Marker' },
    { label: 'Amatic SC', css: "'Amatic SC', cursive", g: 'Amatic SC', w: 1 },
    { label: 'Bangers', css: "'Bangers', cursive", g: 'Bangers' },
    { label: 'Bungee', css: "'Bungee', cursive", g: 'Bungee' },
    { label: 'Monoton', css: "'Monoton', cursive", g: 'Monoton' },
    { label: 'Press Start 2P', css: "'Press Start 2P', cursive", g: 'Press Start 2P' },
    { label: 'Orbitron', css: "'Orbitron', sans-serif", g: 'Orbitron', w: 1 },
    { label: 'Teko', css: "'Teko', sans-serif", g: 'Teko', w: 1 },
  ];

  // ---- helpers ---------------------------------------------------------------
  const $ = (s) => document.querySelector(s);
  const qs = new URLSearchParams(location.search);
  const boardId = qs.get('id') || '';

  function toast(msg, isErr) {
    const t = $('#toast');
    t.textContent = msg; t.classList.toggle('err', !!isErr); t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }
  async function api(path, opts) {
    const res = await fetch('api/' + path, opts || {});
    let body = null; try { body = await res.json(); } catch (_) {}
    if (!res.ok) { const e = new Error((body && body.error) || res.statusText); e.status = res.status; e.body = body; throw e; }
    return body;
  }
  const postJSON = (path, data) =>
    api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

  function goGallery() { location.href = 'index.html'; }
  if (!boardId) { goGallery(); return; }

  const host = $('#host');

  // ---- inline SVG icon set (Feather/Lucide-style; injected into buttons by id) ----
  const _svg = (p) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const ICONS = {
    backBtn: _svg('<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>'),
    undoBtn: _svg('<polyline points="9 14 4 9 9 4"/><path d="M20 20v-5a4 4 0 0 0-4-4H4"/>'),
    redoBtn: _svg('<polyline points="15 14 20 9 15 4"/><path d="M4 20v-5a4 4 0 0 1 4-4h12"/>'),
    refreshBtn: _svg('<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>'),
    zoomIn: _svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
    zoomOut: _svg('<line x1="5" y1="12" x2="19" y2="12"/>'),
    zoomFit: _svg('<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>'),
    snapToggle: _svg('<path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="4" x2="8" y2="4"/><line x1="16" y1="4" x2="20" y2="4"/>'),
    snapGridBtn: _svg('<path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="4" x2="8" y2="4"/><line x1="16" y1="4" x2="20" y2="4"/>'),
    gridBtn: _svg('<rect x="3" y="3" width="18" height="18" rx="1"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>'),
    gridOptBtn: _svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
    dupBtn: _svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    forwardBtn: _svg('<polyline points="18 15 12 9 6 15"/>'),
    backwardBtn: _svg('<polyline points="6 9 12 15 18 9"/>'),
    toFrontBtn: _svg('<polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/>'),
    toBackBtn: _svg('<polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/>'),
    linkBtn: _svg('<path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
    cropBtn: _svg('<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>'),
    lockBtn: _svg('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
    propsBtn: _svg('<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>'),
    alignDistBtn: _svg('<line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/>'),
    arrangeBtn: _svg('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'),
    delBtn: _svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
    brushBtn: _svg('<path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>'),
    addNote: _svg('<path d="M4 4h16v10l-6 6H4z"/><path d="M20 14h-6v6"/>'),
    addFrame: _svg('<path d="M4 7h16M4 17h16M7 4v16M17 4v16"/>'),
    toolConnect: _svg('<circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8.5 8.5l7 7"/>'),
    toolPick: _svg('<path d="M19.07 3.5a2.83 2.83 0 0 0-4 0l-2.5 2.5-1-1-2 2 1 1L2.5 17.6V21.5h3.9l9.1-9.1 1 1 2-2-1-1 2.57-2.57a2.83 2.83 0 0 0 0-4z"/>'),
    addImage: _svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>'),
    toolSelect: _svg('<path d="M3 3l7.5 18 2.6-7.9L21 10.5z"/>'),
    toolDraw: _svg('<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z"/><circle cx="11" cy="11" r="1.5"/>'),
    toolErase: _svg('<path d="M20 20H8.5L3.4 14.9a2 2 0 0 1 0-2.8l8-8a2 2 0 0 1 2.8 0l5.6 5.6a2 2 0 0 1 0 2.8L14 20"/><line x1="18" y1="13" x2="11" y2="6"/>'),
    addText: _svg('<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>'),
    addRect: _svg('<rect x="3" y="5" width="18" height="14" rx="2"/>'),
    addEllipse: _svg('<ellipse cx="12" cy="12" rx="9" ry="7"/>'),
    addTriangle: _svg('<path d="M12 4l9 16H3z"/>'),
    addLine: _svg('<line x1="5" y1="19" x2="19" y2="5"/>'),
    addArrow: _svg('<line x1="5" y1="19" x2="19" y2="5"/><polyline points="11 5 19 5 19 13"/>'),
    bulletBtn: _svg('<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none"/>'),
    numberBtn: _svg('<line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/><line x1="10" y1="18" x2="20" y2="18"/><text x="1.5" y="8" font-size="7" fill="currentColor" stroke="none">1</text><text x="1.5" y="14" font-size="7" fill="currentColor" stroke="none">2</text><text x="1.5" y="20" font-size="7" fill="currentColor" stroke="none">3</text>'),
  };
  function applyIcons() {
    Object.keys(ICONS).forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.title && !el.getAttribute('aria-label')) el.setAttribute('aria-label', el.title);
      el.innerHTML = ICONS[id];
      el.classList.add('iconbtn');
    });
  }

  // ---- canvas setup ----------------------------------------------------------
  const canvas = new fabric.Canvas('c', {
    backgroundColor: '#ffffff', preserveObjectStacking: true, selection: true,
    fireRightClick: true, fireMiddleClick: true, stopContextMenu: true,
    // Corner drags resize freely; holding Ctrl gives Fabric's native uniform scaling
    // (locks aspect ratio AND keeps the opposite corner anchored).
    uniformScaling: false, uniScaleKey: 'ctrlKey',
  });
  canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
  canvas.freeDrawingBrush.color = $('#color').value;
  canvas.freeDrawingBrush.width = parseInt($('#size').value, 10);
  // Brush state — all user-controllable (defaults shown), nothing baked into the stroke logic.
  let brushType = 'pencil', eraseMode = false, brushOpen = false, erasing = false, eraseChanged = false;
  let brushFlow = 1, brushSmooth = 0, brushGap = 14, brushDash = 18;
  let sprayDensity = 16, sprayDot = 4, sprayVar = 2, sprayRandom = false;

  // Custom props to persist (object ids + connector endpoints + hyperlink + lock + frame).
  const PROPS = ['id', 'fromId', 'toId', 'link', 'locked', 'frame', 'name', 'label', 'listType'];

  // ---- Arrow connector (a Line subclass that draws an arrowhead) -------------
  fabric.Arrow = fabric.util.createClass(fabric.Line, {
    type: 'arrow',
    initialize: function (points, options) { this.callSuper('initialize', points || [0, 0, 0, 0], options || {}); },
    _render: function (ctx) {
      const p = this.calcLinePoints();
      const dx = p.x2 - p.x1, dy = p.y2 - p.y1;
      const angle = Math.atan2(dy, dx), lineLen = Math.hypot(dx, dy);
      const w = this.strokeWidth || 2;
      const len = Math.max(16, w * 3.2);    // head length, scales with stroke (no cap)
      const half = Math.max(9, w * 2.0);    // head half-width — always wider than the line
      const back = Math.min(len, lineLen);  // where the shaft stops (head base)
      const bx = p.x2 - Math.cos(angle) * back, by = p.y2 - Math.sin(angle) * back;
      // Shaft (ends at the head base so the line never pokes through the tip).
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1); ctx.lineTo(bx, by);
      ctx.lineWidth = w; ctx.strokeStyle = this.stroke || '#000';
      this.stroke && this._renderStroke(ctx);
      // Arrowhead.
      ctx.save();
      ctx.translate(p.x2, p.y2); ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-len, half); ctx.lineTo(-len, -half); ctx.closePath();
      ctx.fillStyle = this.stroke || '#000'; ctx.fill();
      ctx.restore();
    },
  });
  // Return synchronously (Fabric's enlivenObjects uses the return value for non-async
  // classes) and also invoke the callback for any async caller.
  fabric.Arrow.fromObject = function (object, callback) {
    const arrow = new fabric.Arrow([object.x1, object.y1, object.x2, object.y2], object);
    callback && callback(arrow);
    return arrow;
  };

  // Reposition a Line's geometry (keeps bbox consistent with its endpoints).
  function setLinePoints(line, x1, y1, x2, y2) {
    line.set({ x1, y1, x2, y2, left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) });
    line.setCoords();
  }
  // Bake any scale/rotation of a line/arrow back into its endpoints so it always
  // renders at scale 1 / angle 0 — otherwise the arrowhead warps under non-uniform
  // scaling or flips. Returns true if anything changed.
  function bakeLinear(o) {
    if ((o.scaleX === 1 || o.scaleX === undefined) && (o.scaleY === 1 || o.scaleY === undefined)
      && !(o.angle) && !(o.skewX) && !(o.skewY)) return false;
    const lp = o.calcLinePoints();           // endpoints relative to object center
    const m = o.calcTransformMatrix();        // local(centered) -> scene
    const A = fabric.util.transformPoint(new fabric.Point(lp.x1, lp.y1), m);
    const B = fabric.util.transformPoint(new fabric.Point(lp.x2, lp.y2), m);
    o.set({ scaleX: 1, scaleY: 1, angle: 0, skewX: 0, skewY: 0 });
    setLinePoints(o, A.x, A.y, B.x, B.y);
    return true;
  }
  canvas.on('object:modified', (e) => {
    const o = e.target;
    if (o && (o.type === 'line' || o.type === 'arrow') && !o.fromId) { if (bakeLinear(o)) canvas.requestRenderAll(); }
  });

  // Point on a rectangle's border in the direction of (tx,ty).
  function borderPoint(rect, tx, ty) {
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const dx = tx - cx, dy = ty - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const hw = rect.width / 2, hh = rect.height / 2;
    const s = 1 / Math.max(Math.abs(dx) / (hw || 1), Math.abs(dy) / (hh || 1));
    return { x: cx + dx * s, y: cy + dy * s };
  }
  // Point on an object's actual edge toward (tx,ty): true ellipse edge for ovals/circles,
  // bbox border for everything else — so connectors touch the shape, not its bounding box.
  function edgePoint(obj, tx, ty) {
    const r = obj.getBoundingRect(true);
    if (obj.type === 'ellipse' || obj.type === 'circle') {
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = tx - cx, dy = ty - cy;
      if (!dx && !dy) return { x: cx, y: cy };
      const a = r.width / 2 || 1, b = r.height / 2 || 1;
      const t = 1 / Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b));
      return { x: cx + dx * t, y: cy + dy * t };
    }
    return borderPoint(r, tx, ty);
  }

  // ---- object ids (needed so connectors can reference endpoints) ------------
  let idSeq = 0;
  const genId = () => 'o' + (++idSeq) + '_' + Math.floor(Math.random() * 1e6);
  function ensureId(o) { if (o && !o.id) o.id = genId(); }
  canvas.on('object:added', (e) => ensureId(e.target));
  const byId = (id) => canvas.getObjects().find((o) => o.id === id);
  const isArrow = (o) => o && o.type === 'arrow';

  function updateArrow(arrow) {
    const from = byId(arrow.fromId), to = byId(arrow.toId);
    if (!from || !to) return false;
    const a = from.getBoundingRect(true), b = to.getBoundingRect(true);
    const ac = { x: a.left + a.width / 2, y: a.top + a.height / 2 }, bc = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    const s = edgePoint(from, bc.x, bc.y), e = edgePoint(to, ac.x, ac.y);
    setLinePoints(arrow, s.x, s.y, e.x, e.y);
    return true;
  }
  // Recompute all connectors; drop any whose endpoint is gone.
  function updateAllArrows() {
    canvas.getObjects().filter(isArrow).forEach((arrow) => {
      if (arrow.fromId && arrow.toId && !updateArrow(arrow)) canvas.remove(arrow);
    });
    canvas.requestRenderAll();
  }
  function centerOf(o) { const r = o.getBoundingRect(true); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function objectAt(p) {
    const objs = canvas.getObjects();
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i];
      if (isArrow(o) || o.visible === false) continue;
      const r = o.getBoundingRect(true); // scene-space bbox; matches getPointer()
      if (p.x >= r.left && p.x <= r.left + r.width && p.y >= r.top && p.y <= r.top + r.height) return o;
    }
    return null;
  }
  function createConnector(from, to) {
    ensureId(from); ensureId(to);
    const arrow = new fabric.Arrow([0, 0, 0, 0], {
      stroke: $('#color').value, strokeWidth: Math.max(2, Math.round(parseInt($('#size').value, 10) / 2)),
      fromId: from.id, toId: to.id, strokeLineCap: 'round', strokeUniform: true,
      selectable: true, evented: true, hasControls: false, hasBorders: true,
      lockMovementX: true, lockMovementY: true, perPixelTargetFind: true, padding: 8,
      hoverCursor: 'pointer', objectCaching: false,
    });
    suppress = true;        // skip the intermediate (zero-length) snapshot from object:added
    canvas.add(arrow);
    updateArrow(arrow);
    suppress = false;
    canvas.requestRenderAll();
    snapshot();
  }
  function finishConnect(opt) {
    if (connectFrom) {
      const tgt = objectAt(canvas.getPointer(opt.e));
      if (tgt && tgt !== connectFrom && !isArrow(tgt)) createConnector(connectFrom, tgt);
    }
    connectFrom = null; connectPreview = null; // stay in connect mode for chaining
    canvas.requestRenderAll();
  }

  function resize() { canvas.setDimensions({ width: host.clientWidth, height: host.clientHeight }); }
  window.addEventListener('resize', resize);
  resize();

  // Scene <-> screen helpers.
  function sceneCenter() {
    const z = canvas.getZoom(), v = canvas.viewportTransform;
    return { left: (canvas.getWidth() / 2 - v[4]) / z, top: (canvas.getHeight() / 2 - v[5]) / z };
  }
  function contentBounds() {
    const objs = canvas.getObjects();
    if (!objs.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    objs.forEach((o) => {
      const r = o.getBoundingRect(true);
      x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top);
      x1 = Math.max(x1, r.left + r.width); y1 = Math.max(y1, r.top + r.height);
    });
    return { left: x0, top: y0, width: x1 - x0, height: y1 - y0 };
  }
  function activeObjects() { return canvas.getActiveObjects(); }
  function isStrokey(o) { return o.type === 'line' || o.type === 'path' || o.type === 'arrow'; }
  function isText(o) { return o.type === 'i-text' || o.type === 'text' || o.type === 'textbox'; }
  function isImage(o) { return o && o.type === 'image'; }

  // ---- zoom / pan ------------------------------------------------------------
  const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  function updateZoomLabel() { $('#zoomLabel').textContent = Math.round(canvas.getZoom() * 100) + '%'; }
  const centerPt = () => ({ x: canvas.getWidth() / 2, y: canvas.getHeight() / 2 });
  function setZoom(z, pt) { canvas.zoomToPoint(pt || centerPt(), clampZoom(z)); updateZoomLabel(); }
  const zoomBy = (f) => setZoom(canvas.getZoom() * f);

  function fitToContent() {
    const b = contentBounds();
    if (!b || b.width === 0 || b.height === 0) { canvas.setViewportTransform([1, 0, 0, 1, 0, 0]); updateZoomLabel(); return; }
    const pad = 80;
    const z = clampZoom(Math.min(canvas.getWidth() / (b.width + pad * 2), canvas.getHeight() / (b.height + pad * 2)));
    canvas.setViewportTransform([
      z, 0, 0, z,
      canvas.getWidth() / 2 - (b.left + b.width / 2) * z,
      canvas.getHeight() / 2 - (b.top + b.height / 2) * z,
    ]);
    updateZoomLabel();
  }

  $('#zoomIn').addEventListener('click', () => zoomBy(1.2));
  $('#zoomOut').addEventListener('click', () => zoomBy(1 / 1.2));
  $('#zoomReset').addEventListener('click', () => setZoom(1));
  $('#zoomFit').addEventListener('click', fitToContent);

  // ---- grid + snap-to-grid (grid is a scene-space background pattern) ---------
  let gridOn = false, snapGridOn = false, gridSize = 40, gridStyle = 'lines', gridStrength = 0.32, gridPopupOpen = false;
  function buildGridPattern() {
    const c = document.createElement('canvas'); c.width = c.height = gridSize;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, gridSize, gridSize);
    const col = 'rgba(40,46,58,' + gridStrength + ')';
    if (gridStyle === 'lines') {
      x.strokeStyle = col; x.lineWidth = 1;
      x.beginPath(); x.moveTo(0.5, 0); x.lineTo(0.5, gridSize); x.moveTo(0, 0.5); x.lineTo(gridSize, 0.5); x.stroke();
    } else {
      x.fillStyle = col; const r = Math.max(1, gridSize / 26);
      x.beginPath(); x.arc(0, 0, r, 0, 2 * Math.PI); x.arc(gridSize, 0, r, 0, 2 * Math.PI);
      x.arc(0, gridSize, r, 0, 2 * Math.PI); x.arc(gridSize, gridSize, r, 0, 2 * Math.PI); x.fill();
    }
    return new fabric.Pattern({ source: c, repeat: 'repeat' });
  }
  function refreshGrid() { if (gridOn) { canvas.backgroundColor = buildGridPattern(); canvas.requestRenderAll(); } }
  $('#gridBtn').addEventListener('click', () => {
    gridOn = !gridOn; $('#gridBtn').setAttribute('aria-pressed', String(gridOn));
    canvas.backgroundColor = gridOn ? buildGridPattern() : '#ffffff';
    canvas.requestRenderAll();
  });
  $('#snapGridBtn').addEventListener('click', () => {
    snapGridOn = !snapGridOn; $('#snapGridBtn').setAttribute('aria-pressed', String(snapGridOn));
  });
  $('#gridOptBtn').addEventListener('click', () => {
    gridPopupOpen = !gridPopupOpen;
    $('#gridPopup').classList.toggle('hidden', !gridPopupOpen);
    $('#gridOptBtn').setAttribute('aria-pressed', String(gridPopupOpen));
  });
  $('#gridScale').addEventListener('input', (e) => { gridSize = parseInt(e.target.value, 10); $('#gridScaleVal').textContent = gridSize; refreshGrid(); });
  $('#gridStrength').addEventListener('input', (e) => { gridStrength = parseInt(e.target.value, 10) / 100; $('#gridStrengthVal').textContent = e.target.value; refreshGrid(); });
  $('#gridStyle').addEventListener('click', () => {
    gridStyle = gridStyle === 'dots' ? 'lines' : 'dots';
    $('#gridStyle').textContent = gridStyle === 'dots' ? 'Dots' : 'Lines';
    refreshGrid();
  });
  $('#snapSelGrid').addEventListener('click', () => {
    const objs = activeObjects(); if (!objs.length) { toast('Select objects first', true); return; }
    canvas.discardActiveObject();
    objs.forEach((o) => { o.set({ left: Math.round(o.left / gridSize) * gridSize, top: Math.round(o.top / gridSize) * gridSize }); o.setCoords(); });
    canvas.setActiveObject(objs.length > 1 ? new fabric.ActiveSelection(objs, { canvas }) : objs[0]);
    canvas.requestRenderAll(); snapshot(); updateAllArrows();
  });

  canvas.on('mouse:wheel', (opt) => {
    const e = opt.e; e.preventDefault(); e.stopPropagation();
    setZoom(canvas.getZoom() * Math.pow(0.999, e.deltaY), { x: e.offsetX, y: e.offsetY });
  });

  // Pan: empty-space drag, Space-drag, Alt-drag, or middle mouse.
  let spaceDown = false, panning = false, panX = 0, panY = 0, panMoved = false, panStartX = 0, panStartY = 0;
  function startPan(e) {
    panning = true; panMoved = false; canvas.selection = false; canvas.skipTargetFind = true;
    panX = panStartX = e.clientX; panY = panStartY = e.clientY; canvas.setCursor('grabbing');
  }
  function endPan() {
    if (!panning) return;
    const adding = !!pendingAdd;
    panning = false;
    canvas.selection = !connectMode && !adding;
    canvas.skipTargetFind = spaceDown || connectMode || adding;
    canvas.setCursor(spaceDown ? 'grab' : 'default');
  }
  canvas.on('mouse:move', (opt) => {
    if (erasing) { eraseAt(opt); return; }
    if (connectMode) { if (connectFrom) { connectPreview.to = canvas.getPointer(opt.e); canvas.requestRenderAll(); } return; }
    if (creating) { updateCreate(canvas.getPointer(opt.e)); return; }
    if (!panning) return;
    const e = opt.e;
    if (Math.abs(e.clientX - panStartX) > 4 || Math.abs(e.clientY - panStartY) > 4) panMoved = true;
    // relativePan updates object coords too — keeps hit-detection aligned after panning.
    canvas.relativePan(new fabric.Point(e.clientX - panX, e.clientY - panY));
    panX = e.clientX; panY = e.clientY;
  });
  canvas.on('mouse:up', (opt) => {
    if (erasing) { erasing = false; if (eraseChanged) snapshot(); return; }
    if (panning) { endPan(); return; }
    if (connectMode) { finishConnect(opt); return; }
    if (creating) endCreate();
  });
  window.addEventListener('mouseup', () => { if (panning) endPan(); }); // catch right-button release

  // ---- right-click contextual options (for every object) ---------------------
  let propsViaContext = false; // props popup opened by right-click (auto-closes on click-off)
  function floatPopupAt(pop, x, y) {
    pop.style.right = 'auto';
    const w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(6, Math.min(x, host.clientWidth - w - 8)) + 'px';
    pop.style.top = Math.max(6, Math.min(y, host.clientHeight - h - 8)) + 'px';
  }
  function resetPopupTR(pop) { pop.style.left = 'auto'; pop.style.right = '14px'; pop.style.top = '54px'; }
  function closeContextPopups() {
    if (propsOpen) { propsOpen = false; $('#propsPopup').classList.add('hidden'); $('#propsBtn').setAttribute('aria-pressed', 'false'); }
    $('#textPopover').classList.add('hidden');
  }
  function openOptionsFor(o, x, y) {
    if (isText(o)) { updatePopover(); return; }    // text controls float above the text
    propsOpen = true; propsViaContext = true;
    $('#propsPopup').classList.remove('hidden'); $('#propsBtn').setAttribute('aria-pressed', 'true');
    updatePropsPopup(); floatPopupAt($('#propsPopup'), x, y);
  }
  canvas.upperCanvasEl.addEventListener('contextmenu', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (panMoved) { panMoved = false; return; }    // it was a right-drag pan, not a menu
    const t = canvas.findTarget(e) || canvas.getActiveObject();
    if (!t) { closeContextPopups(); return; }
    canvas.setActiveObject(t); canvas.requestRenderAll();
    openOptionsFor(t, e.offsetX, e.offsetY);
  });
  // Dismiss right-click menus when clicking off them.
  document.addEventListener('mousedown', (e) => {
    if (e.button === 2) return; // the right-click that may open a new menu is handled separately
    const inText = e.target.closest && e.target.closest('#textPopover');
    if (!inText && !$('#textPopover').classList.contains('hidden')) $('#textPopover').classList.add('hidden');
    const inProps = e.target.closest && e.target.closest('#propsPopup');
    if (propsOpen && propsViaContext && !inProps) {
      propsOpen = false; propsViaContext = false;
      $('#propsPopup').classList.add('hidden'); $('#propsBtn').setAttribute('aria-pressed', 'false');
    }
  }, true);

  // ---- tools (left panel) ----------------------------------------------------
  const TOOL_BTN = {
    select: '#toolSelect', draw: '#toolDraw',
    'add-text': '#addText', 'add-rect': '#addRect', 'add-ellipse': '#addEllipse',
    'add-triangle': '#addTriangle', 'add-line': '#addLine', 'add-arrow': '#addArrow', connect: '#toolConnect', pick: '#toolPick', erase: '#toolErase',
    'add-note': '#addNote', 'add-frame': '#addFrame',
  };
  function setActiveTool(name) {
    Object.values(TOOL_BTN).forEach((sel) => $(sel).setAttribute('aria-pressed', 'false'));
    if (TOOL_BTN[name]) $(TOOL_BTN[name]).setAttribute('aria-pressed', 'true');
    updateTopBar();
  }
  function setDrawMode(draw) { canvas.isDrawingMode = draw; updateTopBar(); }
  // Contextual top bar: object-edit group shows when something is selected (edit mode);
  // brush group shows while drawing (creation mode).
  function updateTopBar() {
    const eg = document.getElementById('editGroup'), bg = document.getElementById('brushGroup');
    if (eg) eg.style.display = canvas.getActiveObject() ? '' : 'none';
    if (bg) bg.style.display = canvas.isDrawingMode ? '' : 'none';
  }

  // ---- drawing brushes -------------------------------------------------------
  // Only Spray is a distinct Fabric brush; the rest are a PencilBrush whose finished
  // stroke we restyle (dash/cap/flow). This keeps every stroke a normal, serializable Path.
  function makeBrush() {
    const b = (!eraseMode && brushType === 'spray') ? new fabric.SprayBrush(canvas) : new fabric.PencilBrush(canvas);
    b.color = eraseMode ? (canvas.backgroundColor || '#ffffff') : $('#color').value;
    b.width = Math.max(1, parseInt($('#size').value, 10));
    if (b instanceof fabric.SprayBrush) {
      b.density = sprayDensity; b.dotWidth = sprayDot; b.dotWidthVariance = sprayVar;
      b.randomOpacity = sprayRandom; b.optimizeOverlapping = true;
    } else { b.decimate = brushSmooth; }
    return b;
  }
  function applyBrush() { canvas.freeDrawingBrush = makeBrush(); }
  function styleStroke(p) {
    p.set({ strokeLineCap: 'round', strokeLineJoin: 'round' });
    if (brushType === 'dotted') p.set({ strokeDashArray: [1, brushGap] });
    else if (brushType === 'dashed') p.set({ strokeDashArray: [brushDash, brushGap] });
  }
  function onPathCreated(e) {
    const p = e.path;
    if (!eraseMode) {
      styleStroke(p);
      if (brushFlow < 1) p.set({ opacity: brushFlow });
    }
    snapshot();
  }
  // ---- brush options popup ---------------------------------------------------
  $('#brushBtn').addEventListener('click', () => {
    brushOpen = !brushOpen;
    $('#brushPopup').classList.toggle('hidden', !brushOpen);
    $('#brushBtn').setAttribute('aria-pressed', String(brushOpen));
    if (brushOpen && propsOpen) { propsOpen = false; $('#propsPopup').classList.add('hidden'); $('#propsBtn').setAttribute('aria-pressed', 'false'); }
    updateBrushPopup();
  });
  function updateBrushPopup() {
    if (!brushOpen) return;
    document.querySelectorAll('#brushPopup .row[data-brush]').forEach((r) => {
      r.style.display = r.getAttribute('data-brush').split(' ').indexOf(brushType) >= 0 ? '' : 'none';
    });
  }
  function bindBrushParam(sel, valSel, fn) {
    $(sel).addEventListener('input', (e) => { const n = parseInt(e.target.value, 10); $(valSel).textContent = n; fn(n); });
  }
  bindBrushParam('#brushFlow', '#brushFlowVal', (n) => { brushFlow = n / 100; });
  bindBrushParam('#brushSmooth', '#brushSmoothVal', (n) => { brushSmooth = n; if (!eraseMode) applyBrush(); });
  bindBrushParam('#brushGap', '#brushGapVal', (n) => { brushGap = n; });
  bindBrushParam('#brushDash', '#brushDashVal', (n) => { brushDash = n; });
  bindBrushParam('#sprayDensity', '#sprayDensityVal', (n) => { sprayDensity = n; if (!eraseMode) applyBrush(); });
  bindBrushParam('#sprayDot', '#sprayDotVal', (n) => { sprayDot = n; if (!eraseMode) applyBrush(); });
  bindBrushParam('#sprayVar', '#sprayVarVal', (n) => { sprayVar = n; if (!eraseMode) applyBrush(); });
  $('#sprayRand').addEventListener('click', () => {
    sprayRandom = !sprayRandom;
    $('#sprayRand').setAttribute('aria-pressed', String(sprayRandom));
    $('#sprayRand').textContent = sprayRandom ? 'On' : 'Off';
    if (!eraseMode) applyBrush();
  });

  function startDraw() {
    if (canvas.isDrawingMode && !eraseMode) { toSelect(); return; } // click again toggles off
    exitConnect(); exitCrop(); exitPick(); clearPending(); eraseMode = false; setDrawMode(true); applyBrush(); setActiveTool('draw');
  }
  function startErase() {
    if (eraseMode) { toSelect(); return; } // click again toggles off
    exitConnect(); exitCrop(); exitPick(); clearPending();
    eraseMode = true; setDrawMode(false);
    canvas.skipTargetFind = true; canvas.selection = false; canvas.discardActiveObject();
    canvas.defaultCursor = 'crosshair'; canvas.requestRenderAll();
    setActiveTool('erase'); toast('Eraser — drag across brush strokes to remove them');
  }
  // Stroke eraser: remove freehand strokes (paths / spray groups) under the cursor — nothing else.
  function eraseAt(opt) {
    const p = canvas.getPointer(opt.e);
    const hits = canvas.getObjects().filter((o) => (o.type === 'path' || o.type === 'group') && o.visible !== false && !o.locked)
      .filter((o) => {
        const r = o.getBoundingRect(true);
        if (p.x < r.left || p.x > r.left + r.width || p.y < r.top || p.y > r.top + r.height) return false;
        try { return !canvas.isTargetTransparent(o, opt.e.offsetX, opt.e.offsetY); } catch (_) { return true; }
      });
    if (hits.length) { hits.forEach((o) => canvas.remove(o)); eraseChanged = true; canvas.requestRenderAll(); }
  }
  $('#brushType').addEventListener('change', (e) => { brushType = e.target.value; if (!eraseMode) applyBrush(); updateBrushPopup(); });

  let pendingAdd = null, creating = null, startPt = null;
  let connectMode = false, connectFrom = null, connectPreview = null;
  let cropMode = false, cropImg = null, cropFrame = null, cropPrev = null, cropGhost = null;
  let pickMode = false;
  const normalizeUrl = (u) => (/^[a-z][a-z0-9+.-]*:/i.test(u) ? u : 'https://' + u);
  // Normalize interaction back to "select" (unless we're in connect mode).
  function clearPending() {
    pendingAdd = null;
    canvas.defaultCursor = connectMode ? 'crosshair' : 'default';
    canvas.skipTargetFind = connectMode;   // add/create no longer suppress targeting
    canvas.selection = !connectMode;
  }
  function exitConnect() {
    if (!connectMode) return;
    connectMode = false; connectFrom = null; connectPreview = null;
    canvas.skipTargetFind = false; canvas.selection = true; canvas.defaultCursor = 'default';
    canvas.requestRenderAll();
  }
  function startAdd(kind) {
    exitConnect(); exitCrop(); exitPick(); clearPending(); pendingAdd = kind; setDrawMode(false);
    // While placing, ignore existing objects entirely so we never move/select them.
    canvas.skipTargetFind = true; canvas.selection = false;
    canvas.defaultCursor = 'crosshair'; canvas.discardActiveObject(); canvas.requestRenderAll();
    setActiveTool('add-' + kind);
  }
  function startConnect() {
    exitCrop(); exitPick(); clearPending(); setDrawMode(false);
    connectMode = true; connectFrom = null; connectPreview = null;
    canvas.skipTargetFind = true; canvas.selection = false; canvas.discardActiveObject();
    canvas.defaultCursor = 'crosshair'; canvas.requestRenderAll();
    setActiveTool('connect');
  }
  function toSelect() { exitConnect(); exitCrop(); exitPick(); clearPending(); eraseMode = false; setDrawMode(false); setActiveTool('select'); }

  $('#toolSelect').addEventListener('click', toSelect);
  $('#toolDraw').addEventListener('click', startDraw);
  $('#toolErase').addEventListener('click', startErase);
  $('#addText').addEventListener('click', () => startAdd('text'));
  $('#addRect').addEventListener('click', () => startAdd('rect'));
  $('#addEllipse').addEventListener('click', () => startAdd('ellipse'));
  $('#addTriangle').addEventListener('click', () => startAdd('triangle'));
  $('#addLine').addEventListener('click', () => startAdd('line'));
  $('#addArrow').addEventListener('click', () => startAdd('arrow'));
  $('#addNote').addEventListener('click', () => startAdd('note'));
  $('#addFrame').addEventListener('click', () => {
    const objs = activeObjects();
    if (objs.length) { createFrameAround(objs); return; } // wrap the current selection
    startAdd('frame');
  });
  function createFrameAround(objs) {
    canvas.discardActiveObject();
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    objs.forEach((o) => { const rc = o.getBoundingRect(true); l = Math.min(l, rc.left); t = Math.min(t, rc.top); r = Math.max(r, rc.left + rc.width); b = Math.max(b, rc.top + rc.height); });
    const pad = 30;
    const f = new fabric.Rect({ left: l - pad, top: t - pad, width: (r - l) + pad * 2, height: (b - t) + pad * 2, originX: 'left', originY: 'top', fill: '#ffffff', stroke: '#8b93a3', strokeWidth: 1.5, strokeUniform: true, frame: true, name: 'Frame' });
    canvas.add(f); f.sendToBack();
    canvas.setActiveObject(f); canvas.requestRenderAll(); snapshot();
  }
  $('#toolConnect').addEventListener('click', startConnect);

  function makeObject(kind) {
    const color = $('#color').value;
    if (kind === 'rect') return new fabric.Rect({ width: 200, height: 130, rx: 6, ry: 6, fill: color });
    if (kind === 'ellipse') return new fabric.Ellipse({ rx: 100, ry: 75, fill: color });
    if (kind === 'triangle') return new fabric.Triangle({ width: 190, height: 160, fill: color });
    if (kind === 'line') {
      const w = Math.max(2, parseInt($('#size').value, 10));
      return new fabric.Line([-110, 0, 110, 0], { stroke: color, strokeWidth: w, strokeLineCap: 'round' });
    }
    if (kind === 'note') return new fabric.Textbox('Note', { width: 200, fontSize: 18, fill: '#2b2b2b', backgroundColor: NOTE_COLORS[0], textAlign: 'left', fontFamily: 'system-ui, sans-serif' });
    // Textbox wraps text within its width (word wrapping); drag side handles to reflow.
    return new fabric.Textbox('Text', { width: 260, fontSize: 36, fill: color, fontFamily: 'system-ui, sans-serif' });
  }
  function placeAt(kind, left, top) {
    const obj = makeObject(kind);
    obj.set({ originX: 'center', originY: 'center', left, top });
    canvas.add(obj); canvas.setActiveObject(obj); canvas.requestRenderAll();
    if (kind === 'text' || kind === 'note') { obj.enterEditing(); obj.selectAll(); }
  }

  // Drag-to-size creation for shapes/lines/arrows.
  function beginCreate(kind, p) {
    clearPending();
    const color = $('#color').value;
    let obj;
    if (kind === 'rect') obj = new fabric.Rect({ left: p.x, top: p.y, width: 1, height: 1, rx: 6, ry: 6, fill: color, originX: 'left', originY: 'top' });
    else if (kind === 'ellipse') obj = new fabric.Ellipse({ left: p.x, top: p.y, rx: 1, ry: 1, fill: color, originX: 'left', originY: 'top' });
    else if (kind === 'triangle') obj = new fabric.Triangle({ left: p.x, top: p.y, width: 1, height: 1, fill: color, originX: 'left', originY: 'top' });
    else if (kind === 'arrow') { const w = Math.max(2, parseInt($('#size').value, 10)); obj = new fabric.Arrow([p.x, p.y, p.x, p.y], { stroke: color, strokeWidth: w, strokeLineCap: 'round', strokeUniform: true, objectCaching: false }); }
    else if (kind === 'frame') obj = new fabric.Rect({ left: p.x, top: p.y, width: 1, height: 1, fill: '#ffffff', stroke: '#8b93a3', strokeWidth: 1.5, strokeUniform: true, originX: 'left', originY: 'top', frame: true, name: 'Frame' });
    else { const w = Math.max(2, parseInt($('#size').value, 10)); obj = new fabric.Line([p.x, p.y, p.x, p.y], { stroke: color, strokeWidth: w, strokeLineCap: 'round', strokeUniform: true }); }
    creating = obj; startPt = p;
    canvas.selection = false; canvas.skipTargetFind = true; // keep other objects untouched
    canvas.add(obj); canvas.requestRenderAll();
  }
  const isLinear = (o) => o.type === 'line' || o.type === 'arrow';
  function updateCreate(p) {
    const o = creating;
    if (isLinear(o)) { setLinePoints(o, startPt.x, startPt.y, p.x, p.y); }
    else {
      const x = Math.min(startPt.x, p.x), y = Math.min(startPt.y, p.y);
      const w = Math.abs(p.x - startPt.x), h = Math.abs(p.y - startPt.y);
      if (o.type === 'ellipse') o.set({ left: x, top: y, rx: Math.max(0.5, w / 2), ry: Math.max(0.5, h / 2) });
      else o.set({ left: x, top: y, width: Math.max(1, w), height: Math.max(1, h) });
    }
    o.setCoords(); canvas.requestRenderAll();
  }
  function endCreate() {
    const o = creating; creating = null;
    const minDim = 6;
    if (isLinear(o)) {
      if (Math.hypot(o.x2 - o.x1, o.y2 - o.y1) < minDim) setLinePoints(o, o.x1, o.y1, o.x1 + 160, o.y1);
    } else {
      const bw = o.type === 'ellipse' ? o.rx * 2 : o.width;
      const bh = o.type === 'ellipse' ? o.ry * 2 : o.height;
      if (bw < minDim && bh < minDim) {
        if (o.type === 'ellipse') o.set({ rx: 100, ry: 75, left: o.left - 100, top: o.top - 75 });
        else if (o.frame) o.set({ width: 400, height: 300, left: o.left - 200, top: o.top - 150 });
        else if (o.type === 'rect') o.set({ width: 200, height: 130, left: o.left - 100, top: o.top - 65 });
        else o.set({ width: 190, height: 160, left: o.left - 95, top: o.top - 80 });
      }
    }
    o.setCoords();
    if (o.frame) o.sendToBack(); // frames sit behind their contents
    startPt = null; clearPending(); // restores selection + target-finding
    canvas.setActiveObject(o); canvas.requestRenderAll();
    snapshot(); setActiveTool('select');
  }

  // Single mouse:down handler: text = click to place, shapes = drag to size, else pan.
  canvas.on('mouse:down', (opt) => {
    const e = opt.e;
    // Right or middle drag (or Space/Alt) pans the camera; left-drag is for select/draw.
    if (e.button === 2 || e.button === 1 || spaceDown || e.altKey) { startPan(e); return; }
    if (eraseMode) { erasing = true; eraseChanged = false; eraseAt(opt); return; }
    if (pickMode) { sampleColorAt(opt); return; }
    if (connectMode) {
      const p = canvas.getPointer(opt.e), src = objectAt(p);
      if (src) { connectFrom = src; connectPreview = { from: centerOf(src), to: p }; }
      return;
    }
    if (pendingAdd) {
      const p = canvas.getPointer(opt.e), kind = pendingAdd;
      if (kind === 'text' || kind === 'note') { clearPending(); setActiveTool('select'); placeAt(kind, p.x, p.y); }
      else beginCreate(kind, p);
      return;
    }
    // Ctrl/Cmd+click a linked object opens its hyperlink.
    if ((e.ctrlKey || e.metaKey) && opt.target && opt.target.link) {
      window.open(normalizeUrl(opt.target.link), '_blank', 'noopener'); return;
    }
    // Grabbing a frame: capture its contents so they move with it.
    if (opt.target && opt.target.frame) { opt.target._members = frameMembers(opt.target); opt.target._lx = opt.target.left; opt.target._ly = opt.target.top; }
    // left-click on empty space → Fabric's marquee selection (no custom handling needed)
  });

  // ---- snapping + alignment guides (nearby objects, always on) ---------------
  const snapOn = true; let guides = [];
  function clearGuides() { if (guides.length) { guides = []; canvas.requestRenderAll(); } }

  canvas.on('object:moving', (e) => {
    guides = [];
    const obj = e.target;
    if (isText(obj)) positionPopover(obj);
    if (snapGridOn) {
      obj.set({ left: Math.round(obj.left / gridSize) * gridSize, top: Math.round(obj.top / gridSize) * gridSize });
      obj.setCoords(); updateAllArrows(); return;
    }
    if (!snapOn) return;
    const z = canvas.getZoom(), thr = SNAP_PX / z, near = NEAR_PX / z;
    const moving = obj.type === 'activeSelection' ? obj.getObjects() : [obj];
    const others = canvas.getObjects().filter((o) => o !== obj && moving.indexOf(o) < 0 && !o.group && o.visible !== false && !isArrow(o));
    if (!others.length) return;
    const b = obj.getBoundingRect(true, true); // live bbox
    const mb = { l: b.left, cx: b.left + b.width / 2, r: b.left + b.width, t: b.top, cy: b.top + b.height / 2, b2: b.top + b.height };
    let bestX = null, bestY = null;
    others.forEach((o) => {
      const r = o.getBoundingRect(true, true);
      const vGap = Math.max(0, r.top - mb.b2, mb.t - (r.top + r.height));   // vertical gap between boxes
      const hGap = Math.max(0, r.left - mb.r, mb.l - (r.left + r.width));   // horizontal gap
      if (vGap <= near) { // x-alignment only matters when vertically nearby
        [mb.l, mb.cx, mb.r].forEach((mv) => [r.left, r.left + r.width / 2, r.left + r.width].forEach((tv) => {
          const d = tv - mv;
          if (Math.abs(d) <= thr && (!bestX || Math.abs(d) < Math.abs(bestX.d)))
            bestX = { d, line: tv, a: Math.min(mb.t, r.top), b: Math.max(mb.b2, r.top + r.height) };
        }));
      }
      if (hGap <= near) {
        [mb.t, mb.cy, mb.b2].forEach((mh) => [r.top, r.top + r.height / 2, r.top + r.height].forEach((th) => {
          const d = th - mh;
          if (Math.abs(d) <= thr && (!bestY || Math.abs(d) < Math.abs(bestY.d)))
            bestY = { d, line: th, a: Math.min(mb.l, r.left), b: Math.max(mb.r, r.left + r.width) };
        }));
      }
    });
    if (bestX) { obj.left += bestX.d; guides.push({ axis: 'x', pos: bestX.line, a: bestX.a, b: bestX.b }); }
    if (bestY) { obj.top += bestY.d; guides.push({ axis: 'y', pos: bestY.line, a: bestY.a, b: bestY.b }); }
    if (bestX || bestY) obj.setCoords();
    updateAllArrows(); // connectors follow the moved object
  });
  canvas.on('object:scaling', (e) => {
    if (isText(e.target)) positionPopover(e.target);
    updateAllArrows();
  });
  canvas.on('object:rotating', (e) => {
    // Snap rotation to 15° increments unless Shift is held (then free).
    if (!e.e.shiftKey) { const step = 15; e.target.angle = Math.round(e.target.angle / step) * step; e.target.setCoords(); }
    updateAllArrows();
  });
  canvas.on('object:modified', clearGuides);
  canvas.on('mouse:up', clearGuides);

  // ---- frames / sections: a frame drags its contained objects along -----------
  function frameMembers(f) {
    const fr = f.getBoundingRect(true);
    return canvas.getObjects().filter((o) => o !== f && !o.frame && !isArrow(o) && o.visible !== false && o.selectable !== false)
      .filter((o) => { const c = centerOf(o); return c.x >= fr.left && c.x <= fr.left + fr.width && c.y >= fr.top && c.y <= fr.top + fr.height; });
  }
  canvas.on('object:moving', (e) => {
    const f = e.target;
    if (f && f.frame && f._members) {
      const dx = f.left - f._lx, dy = f.top - f._ly;
      if (dx || dy) { f._members.forEach((o) => { o.left += dx; o.top += dy; o.setCoords(); }); f._lx = f.left; f._ly = f.top; }
    }
  });
  canvas.on('object:modified', (e) => { if (e.target && e.target.frame) e.target._members = null; });
  canvas.on('mouse:dblclick', (opt) => {
    const t = opt.target;
    if (t && t.frame) { const n = prompt('Frame name:', t.name || 'Frame'); if (n !== null) { t.set('name', n); canvas.requestRenderAll(); snapshot(); } }
    else if (t && isArrow(t)) { const n = prompt('Connector label (blank to remove):', t.label || ''); if (n !== null) { t.label = n.trim() || undefined; canvas.requestRenderAll(); snapshot(); } }
  });

  // Overlay: alignment-guide segments, connector preview, and text-popover follow.
  canvas.on('after:render', () => {
    if (textActive() && !$('#textPopover').classList.contains('hidden')) positionPopover(textActive());
    const ctx = canvas.getContext(), v = canvas.viewportTransform, z = canvas.getZoom();
    // Frame name labels (drawn at each frame's top-left, screen space).
    const frames = canvas.getObjects().filter((o) => o.frame);
    if (frames.length) {
      ctx.save(); ctx.fillStyle = '#8b93a3'; ctx.font = '12px system-ui, sans-serif';
      frames.forEach((f) => { const r = f.getBoundingRect(); ctx.fillText(f.name || 'Frame', r.left + 3, Math.max(11, r.top - 5)); });
      ctx.restore();
    }
    // Connector labels (pill at the connector midpoint).
    canvas.getObjects().forEach((ar) => {
      if (!isArrow(ar) || !ar.label) return;
      const mx = ((ar.x1 + ar.x2) / 2) * z + v[4], my = ((ar.y1 + ar.y2) / 2) * z + v[5];
      ctx.save(); ctx.font = '12px system-ui, sans-serif';
      const tw = ctx.measureText(ar.label).width;
      ctx.fillStyle = 'rgba(29,32,38,0.92)'; ctx.fillRect(mx - tw / 2 - 6, my - 9, tw + 12, 18);
      ctx.fillStyle = '#e7e9ee'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ar.label, mx, my);
      ctx.restore();
    });
    if (guides.length) {
      ctx.save(); ctx.strokeStyle = '#ff3b8b'; ctx.lineWidth = 1;
      guides.forEach((g) => {
        ctx.beginPath();
        if (g.axis === 'x') { const x = g.pos * z + v[4]; ctx.moveTo(x, g.a * z + v[5] - 12); ctx.lineTo(x, g.b * z + v[5] + 12); }
        else { const y = g.pos * z + v[5]; ctx.moveTo(g.a * z + v[4] - 12, y); ctx.lineTo(g.b * z + v[4] + 12, y); }
        ctx.stroke();
      });
      ctx.restore();
    }
    if (connectMode && connectFrom && connectPreview) {
      ctx.save(); ctx.strokeStyle = '#6ea8fe'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(connectPreview.from.x * z + v[4], connectPreview.from.y * z + v[5]);
      ctx.lineTo(connectPreview.to.x * z + v[4], connectPreview.to.y * z + v[5]);
      ctx.stroke(); ctx.restore();
    }
  });

  // ---- history (undo/redo) ---------------------------------------------------
  let history = [], hi = -1, suppress = false;
  // Serialize the board WITHOUT the grid background pattern (grid is view-only, never saved).
  function docObject() {
    const bg = canvas.backgroundColor, patt = bg && typeof bg !== 'string';
    if (patt) canvas.backgroundColor = '#ffffff';
    const doc = canvas.toJSON(PROPS);
    if (patt) canvas.backgroundColor = bg;
    return doc;
  }
  const serialize = () => JSON.stringify(docObject());
  function snapshot() {
    if (suppress || creating || cropMode) return; // skip mid-creation/crop; snapshot once on finish
    history = history.slice(0, hi + 1);
    history.push(serialize());
    if (history.length > HIST_MAX) history.shift();
    hi = history.length - 1;
    scheduleSave(); updateHistButtons();
  }
  function loadState(json) {
    suppress = true;
    canvas.loadFromJSON(json, () => { updateAllArrows(); canvas.renderAll(); suppress = false; updateHistButtons(); });
  }
  function undo() { if (hi > 0) { hi--; loadState(history[hi]); scheduleSave(); } }
  function redo() { if (hi < history.length - 1) { hi++; loadState(history[hi]); scheduleSave(); } }
  function updateHistButtons() {
    $('#undoBtn').disabled = hi <= 0;
    $('#redoBtn').disabled = hi >= history.length - 1;
  }
  canvas.on('object:added', snapshot);
  canvas.on('object:removed', snapshot);
  canvas.on('object:modified', snapshot);
  canvas.on('path:created', onPathCreated);

  // ---- save (debounced auto-save + manual) -----------------------------------
  let dirty = false, saving = false;
  function setStatus(s) { $('#status').textContent = s; }
  function scheduleSave() {
    dirty = true; setStatus('Unsaved…');
    clearTimeout(scheduleSave._t);
    scheduleSave._t = setTimeout(save, 1200);
  }
  function makeThumb() {
    const b = contentBounds();
    if (!b) return null;
    const pad = 20, longest = Math.max(b.width, b.height) + pad * 2, mult = Math.min(1, 320 / longest);
    const v = canvas.viewportTransform.slice();
    const bg = canvas.backgroundColor, patt = bg && typeof bg !== 'string';
    if (patt) canvas.backgroundColor = '#ffffff'; // keep the grid out of the thumbnail
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    let url = null;
    try {
      url = canvas.toDataURL({ format: 'jpeg', quality: 0.45, multiplier: mult,
        left: b.left - pad, top: b.top - pad, width: b.width + pad * 2, height: b.height + pad * 2 });
    } catch (_) {}
    canvas.setViewportTransform(v);
    if (patt) canvas.backgroundColor = bg;
    return url;
  }
  async function save() {
    if (saving) { scheduleSave(); return; }
    if (!dirty) return;
    saving = true; dirty = false; setStatus('Saving…');
    try {
      await postJSON('board-save.php', { id: boardId, title: $('#title').value, doc: docObject(), thumb: makeThumb() });
      setStatus('Saved');
    } catch (err) {
      dirty = true;
      if (err.status === 401) { toast('Session expired — please sign in', true); setTimeout(goGallery, 1200); }
      else { setStatus('Save failed'); toast('Save failed', true); }
    } finally { saving = false; }
  }

  // ---- color / size controls -------------------------------------------------
  function applyColor(c) {
    if (!eraseMode) canvas.freeDrawingBrush.color = c; // don't recolor the eraser
    const objs = activeObjects();
    if (!objs.length) return;
    if (textRange()) { setTextStyle({ fill: c }); return; } // color just the selected glyphs
    objs.forEach((o) => isStrokey(o) ? o.set('stroke', c) : o.set('fill', c));
    canvas.requestRenderAll(); snapshot();
  }
  $('#color').addEventListener('input', (e) => applyColor(e.target.value));
  $('#size').addEventListener('input', (e) => {
    const n = parseInt(e.target.value, 10);
    $('#sizeVal').textContent = n;
    canvas.freeDrawingBrush.width = n;
    const objs = activeObjects();
    if (objs.length) {
      objs.forEach((o) => {
        if (isText(o)) return; // text size handled by the Text popover
        if (isStrokey(o)) o.set('strokeWidth', n);
        else { o.set('strokeWidth', n); if (!o.stroke) o.set('stroke', $('#color').value); }
      });
      canvas.requestRenderAll();
    }
  });
  $('#size').addEventListener('change', () => { if (activeObjects().length) snapshot(); });

  function syncColor(o) {
    if (!o) return;
    const col = isStrokey(o) ? o.stroke : o.fill;
    if (typeof col === 'string' && /^#[0-9a-f]{6}$/i.test(col)) $('#color').value = col;
  }

  // ---- text styling popover (floats above the selected text) -----------------
  const textActive = () => { const o = canvas.getActiveObject(); return o && isText(o) ? o : null; };
  const activeTexts = () => activeObjects().filter(isText);
  const setPressed = (btn, on) => btn.setAttribute('aria-pressed', String(on));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function positionPopover(o) {
    const pop = $('#textPopover');
    const r = o.getBoundingRect(); // screen coords; canvas fills host at (0,0)
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let left = r.left + r.width / 2;
    left = Math.max(pw / 2 + 6, Math.min(left, host.clientWidth - pw / 2 - 6));
    let top = r.top - ph - 12;
    if (top < 6) top = r.top + r.height + 12;
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }
  function updatePopover() {
    const o = textActive(), pop = $('#textPopover');
    if (!o) { pop.classList.add('hidden'); return; }
    pop.classList.remove('hidden');
    $('#fontFamily').value = textStyleVal('fontFamily', 'system-ui, sans-serif');
    $('#fontSize').value = Math.round(textStyleVal('fontSize', 36));
    const fw = textStyleVal('fontWeight', 'normal');
    setPressed($('#boldBtn'), fw === 'bold' || Number(fw) >= 600);
    setPressed($('#italicBtn'), textStyleVal('fontStyle', 'normal') === 'italic');
    setPressed($('#underlineBtn'), !!textStyleVal('underline', false));
    $('#alignBtn').textContent = cap(o.textAlign || 'left');
    setPressed($('#bulletBtn'), isListType(o, 'bullet'));
    setPressed($('#numberBtn'), isListType(o, 'number'));
    positionPopover(o);
  }
  // Selecting no longer auto-opens options — they appear on right-click (see contextmenu).
  function onSelection() {
    syncColor(canvas.getActiveObject());
    updateContextButtons(); updateTopBar();
    if (propsOpen) updatePropsPopup();          // keep an open props popup in sync
    if (textActive()) { if (!$('#textPopover').classList.contains('hidden')) updatePopover(); }
    else $('#textPopover').classList.add('hidden');
  }
  canvas.on('selection:created', onSelection);
  canvas.on('selection:updated', onSelection);
  canvas.on('selection:cleared', () => { $('#textPopover').classList.add('hidden'); lastTextSel = null; updateContextButtons(); updateTopBar(); });

  function applyText(prop, val) {
    const objs = activeTexts(); if (!objs.length) return;
    objs.forEach((o) => o.set(prop, val));
    canvas.requestRenderAll(); snapshot(); updatePopover();
  }
  function toggleText(prop, onVal, offVal, isOn) {
    const objs = activeTexts(); if (!objs.length) return;
    const turnOn = !isOn(objs[0]);
    objs.forEach((o) => o.set(prop, turnOn ? onVal : offVal));
    canvas.requestRenderAll(); snapshot(); updatePopover();
  }
  // Rich text: when a glyph range is selected while editing, style only that range; else whole object(s).
  let lastTextSel = null; // last non-empty char selection (so right-click can style it)
  let lastCaret = null;   // last caret/selection (collapsed ok) for per-line list ops
  function editingTextRange() {
    const o = canvas.getActiveObject();
    return (o && isText(o) && o.isEditing && o.selectionStart !== o.selectionEnd) ? o : null;
  }
  function textRange() {
    const re = editingTextRange();
    if (re) return { o: re, start: re.selectionStart, end: re.selectionEnd };
    const o = canvas.getActiveObject();
    if (lastTextSel && lastTextSel.obj === o && lastTextSel.start !== lastTextSel.end) return { o, start: lastTextSel.start, end: lastTextSel.end };
    return null;
  }
  function setTextStyle(style) {
    const r = textRange();
    if (r) r.o.setSelectionStyles(style, r.start, r.end);
    else activeTexts().forEach((o) => o.set(style));
    canvas.requestRenderAll(); snapshot(); updatePopover();
  }
  function textStyleVal(prop, fallback) {
    const r = textRange();
    if (r) { const s = r.o.getSelectionStyles(r.start, r.end); if (s[0] && s[0][prop] !== undefined) return s[0][prop]; return r.o[prop] !== undefined ? r.o[prop] : fallback; }
    const o = activeTexts()[0];
    return o && o[prop] !== undefined ? o[prop] : fallback;
  }
  // Track the character selection; options no longer auto-open (right-click instead).
  canvas.on('text:selection:changed', (e) => {
    const o = e.target; if (!o) return;
    lastCaret = { obj: o, start: o.selectionStart, end: o.selectionEnd };
    if (o.selectionStart !== o.selectionEnd) lastTextSel = { obj: o, start: o.selectionStart, end: o.selectionEnd };
  });
  canvas.on('text:editing:entered', (e) => { lastTextSel = null; const o = e.target; if (o) lastCaret = { obj: o, start: o.selectionStart, end: o.selectionEnd }; });
  // Inject the Google Fonts stylesheet and populate the font picker.
  function buildFonts() {
    const fams = FONTS.filter((f) => f.g).map((f) => 'family=' + f.g.replace(/ /g, '+') + (f.w ? ':wght@400;700' : ''));
    if (fams.length) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?' + fams.join('&') + '&display=swap';
      document.head.appendChild(link);
    }
    const sel = $('#fontFamily');
    sel.innerHTML = '';
    FONTS.forEach((f) => {
      const o = document.createElement('option');
      o.value = f.css; o.textContent = f.label; o.style.fontFamily = f.css;
      sel.appendChild(o);
    });
  }
  // Ensure a font's glyphs are loaded before we rely on the canvas measuring it.
  function ensureFont(css) {
    const name = css.split(',')[0].replace(/['"]/g, '').trim();
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([document.fonts.load('24px "' + name + '"'), document.fonts.load('bold 24px "' + name + '"')]).catch(() => {});
  }
  function ensureBoardFonts() {
    const fams = new Set();
    canvas.getObjects().forEach((o) => { if (isText(o) && o.fontFamily) fams.add(o.fontFamily); });
    return Promise.all([...fams].map(ensureFont)).then(() => canvas.requestRenderAll());
  }

  $('#fontFamily').addEventListener('change', (e) => {
    const css = e.target.value, r = textRange();
    if (r) r.o.setSelectionStyles({ fontFamily: css }, r.start, r.end);
    else activeTexts().forEach((o) => o.set('fontFamily', css));
    canvas.requestRenderAll();
    ensureFont(css).then(() => { canvas.requestRenderAll(); snapshot(); updatePopover(); });
  });
  $('#fontSize').addEventListener('input', (e) => {
    const n = Math.min(400, Math.max(6, parseInt(e.target.value, 10) || 36)), r = textRange();
    if (r) r.o.setSelectionStyles({ fontSize: n }, r.start, r.end);
    else activeTexts().forEach((o) => o.set('fontSize', n));
    canvas.requestRenderAll(); updatePopover();
  });
  $('#fontSize').addEventListener('change', () => { if (activeTexts().length) snapshot(); });
  $('#boldBtn').addEventListener('click', () => { const v = textStyleVal('fontWeight', 'normal'); setTextStyle({ fontWeight: (v === 'bold' || Number(v) >= 600) ? 'normal' : 'bold' }); });
  $('#italicBtn').addEventListener('click', () => setTextStyle({ fontStyle: textStyleVal('fontStyle', 'normal') === 'italic' ? 'normal' : 'italic' }));
  $('#underlineBtn').addEventListener('click', () => setTextStyle({ underline: !textStyleVal('underline', false) }));
  $('#alignBtn').addEventListener('click', () => {
    const objs = activeTexts(); if (!objs.length) return;
    const order = ['left', 'center', 'right'];
    applyText('textAlign', order[(order.indexOf(objs[0].textAlign || 'left') + 1) % order.length]);
  });

  // ---- list engine — per line, style-preserving (insertChars/removeChars) -----
  // Markers live in the text (indent + marker + ' '), but EVERY mutation goes through
  // Fabric's insertChars/removeChars so per-character styles shift correctly (never
  // corrupted). Lists apply to the caret line / selected lines only.
  const INDENT = '    ';
  const LINE_MARK = /^( *)(•|◦|▪|\d+\.) (.*)$/;
  const bulletFor = (lvl) => ['•', '◦', '▪'][lvl % 3];
  function parseLine(text) {
    const m = text.match(LINE_MARK);
    if (m) return { isList: true, indentLen: m[1].length, level: Math.floor(m[1].length / INDENT.length), marker: m[2], markerType: /^\d/.test(m[2]) ? 'number' : 'bullet', markerLen: m[2].length, prefixLen: m[1].length + m[2].length + 1, content: m[3] };
    const lead = (text.match(/^ */) || [''])[0];
    return { isList: false, indentLen: lead.length, level: Math.floor(lead.length / INDENT.length), prefixLen: lead.length, content: text.slice(lead.length) };
  }
  function logicalLines(o) { const a = []; let pos = 0; String(o.text || '').split('\n').forEach((p) => { a.push({ start: pos, len: p.length, text: p }); pos += p.length + 1; }); return a; }
  function caretRange(o) {
    if (o.isEditing) return { s: o.selectionStart || 0, e: o.selectionEnd != null ? o.selectionEnd : (o.selectionStart || 0) };
    if (lastCaret && lastCaret.obj === o) return { s: lastCaret.start, e: lastCaret.end };
    return { s: 0, e: String(o.text || '').length };
  }
  function lineSpan(lines, s, e) { let first = 0, last = 0; for (let i = 0; i < lines.length; i++) { if (s >= lines[i].start) first = i; if (e >= lines[i].start) last = i; } return { first, last }; }
  const hasListLines = (o) => isText(o) && /^( *)(?:•|◦|▪|\d+\.) /m.test(String(o.text || ''));
  function syncCaret(o, sel) {
    if (!o.isEditing) return;
    const t = String(o.text || ''); sel = Math.max(0, Math.min(sel, t.length));
    o.selectionStart = o.selectionEnd = sel;
    if (o.hiddenTextarea) { o.hiddenTextarea.value = t; try { o.hiddenTextarea.selectionStart = o.hiddenTextarea.selectionEnd = sel; } catch (_) {} }
    o.renderCursorOrSelection && o.renderCursorOrSelection();
  }
  // Renumber number markers / normalize bullet glyph per level — only where a marker
  // actually differs (so normal typing is a no-op and never disturbs styles).
  function renumber(o) {
    const lines = logicalLines(o), counters = [], want = [];
    for (let i = 0; i < lines.length; i++) {
      const p = parseLine(lines[i].text);
      if (!p.isList) { for (let k = 0; k < counters.length; k++) counters[k] = 0; want.push(null); continue; }
      for (let k = p.level + 1; k < counters.length; k++) counters[k] = 0;
      if (p.markerType === 'number') { counters[p.level] = (counters[p.level] || 0) + 1; want.push(counters[p.level] + '.'); }
      else want.push(bulletFor(p.level));
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      if (want[i] == null) continue;
      const cur = logicalLines(o)[i], p = parseLine(cur.text);
      if (!p.isList || p.marker === want[i]) continue;
      const mStart = cur.start + p.indentLen;
      o.insertChars(want[i], undefined, mStart, mStart + p.markerLen);
    }
    o.initDimensions && o.initDimensions(); o.dirty = true;
  }
  function applyList(type) {
    const o = canvas.getActiveObject(); if (!o || !isText(o)) return;
    const r = caretRange(o), base = logicalLines(o), span = lineSpan(base, r.s, r.e);
    let allType = true;
    for (let i = span.first; i <= span.last; i++) { const p = parseLine(base[i].text); if (!(p.isList && p.markerType === type)) { allType = false; break; } }
    for (let i = span.last; i >= span.first; i--) {
      const ln = logicalLines(o)[i], p = parseLine(ln.text), mStart = ln.start + p.indentLen, nm = type === 'number' ? '1.' : '•';
      if (allType) { if (p.isList) o.removeChars(mStart, mStart + p.markerLen + 1); }       // remove "marker "
      else if (p.isList) o.insertChars(nm, undefined, mStart, mStart + p.markerLen);         // swap marker type
      else if (ln.text.trim() !== '') o.insertChars(nm + ' ', undefined, mStart, mStart);    // add marker
    }
    renumber(o); syncCaret(o, o.selectionStart || 0);
    canvas.requestRenderAll(); snapshot(); updatePopover();
  }
  const isListType = (o, type) => {
    const r = caretRange(o), lines = logicalLines(o), span = lineSpan(lines, r.s, r.e);
    for (let i = span.first; i <= span.last; i++) { const p = parseLine(lines[i].text); if (p.isList && p.markerType === type) return true; }
    return false;
  };
  function continueList(o) {
    const lines = logicalLines(o), sel = o.selectionStart || 0, p = parseLine(lines[lineSpan(lines, sel, sel).first].text);
    const indent = ' '.repeat(p.indentLen), marker = p.markerType === 'number' ? '1.' : bulletFor(p.level);
    o.insertChars('\n' + indent + marker + ' ', undefined, sel, sel);
    renumber(o); syncCaret(o, sel + 1 + indent.length + marker.length + 1);
  }
  function exitOrOutdent(o) {
    const lines = logicalLines(o), sel = o.selectionStart || 0, ln = lines[lineSpan(lines, sel, sel).first], p = parseLine(ln.text);
    if (p.level > 0) { o.removeChars(ln.start, ln.start + INDENT.length); renumber(o); syncCaret(o, sel - INDENT.length); }
    else { const mStart = ln.start + p.indentLen; o.removeChars(mStart, mStart + p.markerLen + 1); renumber(o); syncCaret(o, mStart); }
  }
  function indentLine(o, delta) {
    const lines = logicalLines(o), sel = o.selectionStart || 0, ln = lines[lineSpan(lines, sel, sel).first], p = parseLine(ln.text);
    if (!p.isList) return;
    if (delta > 0) { o.insertChars(INDENT, undefined, ln.start, ln.start); renumber(o); syncCaret(o, sel + INDENT.length); }
    else if (p.indentLen >= INDENT.length) { o.removeChars(ln.start, ln.start + INDENT.length); renumber(o); syncCaret(o, Math.max(ln.start, sel - INDENT.length)); }
  }
  // Keep numbering correct on ordinary typing/deletion (style-preserving, no-op if unchanged).
  let renumbering = false;
  canvas.on('text:changed', (e) => {
    const o = e.target;
    if (o && hasListLines(o) && !renumbering) { renumbering = true; try { renumber(o); } finally { renumbering = false; } canvas.requestRenderAll(); }
  });
  // Enter / Backspace / Tab while editing a list line (capture-phase, before Fabric).
  document.addEventListener('keydown', (e) => {
    const o = canvas.getActiveObject();
    if (!o || !isText(o) || !o.isEditing) return;
    const lines = logicalLines(o), sel = o.selectionStart || 0, ln = lines[lineSpan(lines, sel, sel).first], p = parseLine(ln.text);
    if (!p.isList) return;
    if (e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); indentLine(o, e.shiftKey ? -1 : 1); canvas.requestRenderAll(); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); if (p.content.trim() === '') exitOrOutdent(o); else continueList(o); canvas.requestRenderAll(); }
    else if (e.key === 'Backspace' && sel === ln.start + p.prefixLen) { e.preventDefault(); e.stopImmediatePropagation(); exitOrOutdent(o); canvas.requestRenderAll(); }
  }, true);
  $('#bulletBtn').addEventListener('click', () => applyList('bullet'));
  $('#numberBtn').addEventListener('click', () => applyList('number'));
  // Keep the text's character selection while clicking style buttons (don't steal focus),
  // so Bold/Italic/Underline/align/list apply to the selected characters during editing.
  $('#textPopover').querySelectorAll('button').forEach((b) => b.addEventListener('mousedown', (e) => e.preventDefault()));

  // ---- object operations -----------------------------------------------------
  function eachActive(fn) { activeObjects().forEach(fn); canvas.requestRenderAll(); }
  function deleteSel() {
    const objs = activeObjects(); if (!objs.length) return;
    objs.forEach((o) => canvas.remove(o));
    canvas.discardActiveObject(); updateAllArrows(); canvas.requestRenderAll();
  }
  function duplicateSel() {
    const obj = canvas.getActiveObject(); if (!obj) return;
    obj.clone((clone) => {
      clone.set({ left: obj.left + 24, top: obj.top + 24 });
      canvas.discardActiveObject();
      if (clone.type === 'activeSelection') {
        clone.canvas = canvas; clone.forEachObject((o) => canvas.add(o)); clone.setCoords();
      } else canvas.add(clone);
      canvas.setActiveObject(clone); canvas.requestRenderAll();
    });
  }
  $('#delBtn').addEventListener('click', deleteSel);
  $('#dupBtn').addEventListener('click', duplicateSel);
  // z-order ops don't fire events, so snapshot explicitly to persist the new order.
  $('#forwardBtn').addEventListener('click', () => { eachActive((o) => o.bringForward()); snapshot(); });
  $('#backwardBtn').addEventListener('click', () => { eachActive((o) => o.sendBackwards()); snapshot(); });
  $('#toFrontBtn').addEventListener('click', () => { eachActive((o) => o.bringToFront()); snapshot(); });
  $('#toBackBtn').addEventListener('click', () => { eachActive((o) => o.sendToBack()); snapshot(); });

  // ---- copy / cut / paste objects within the board ---------------------------
  let clipboard = null;
  function copySel() {
    const objs = activeObjects(); if (!objs.length) return false;
    clipboard = objs.map((o) => {
      const c = o.toObject(PROPS);
      if (c.type === 'arrow') { delete c.fromId; delete c.toId; } // paste as a free arrow
      delete c.id;
      return c;
    });
    return true;
  }
  function pasteClipboard() {
    if (!clipboard || !clipboard.length) return false;
    fabric.util.enlivenObjects(clipboard.map((c) => Object.assign({}, c)), (objs) => {
      canvas.discardActiveObject();
      const added = [];
      objs.forEach((o) => {
        o.set({ left: (o.left || 0) + 26, top: (o.top || 0) + 26 });
        o.id = undefined; ensureId(o);
        if (o.locked) applyLock(o, true);
        if (isImage(o) && o.filters && o.filters.length) o.applyFilters();
        canvas.add(o); added.push(o);
      });
      if (added.length === 1) canvas.setActiveObject(added[0]);
      else if (added.length > 1) canvas.setActiveObject(new fabric.ActiveSelection(added, { canvas }));
      canvas.requestRenderAll(); snapshot();
    });
    return true;
  }

  // ---- align & distribute ----------------------------------------------------
  let alignOpen = false;
  $('#alignDistBtn').addEventListener('click', () => {
    alignOpen = !alignOpen;
    $('#alignPopup').classList.toggle('hidden', !alignOpen);
    $('#alignDistBtn').setAttribute('aria-pressed', String(alignOpen));
  });
  // Operate in absolute coords: discard the group first, then re-select.
  function alignObjects(fn) {
    const objs = activeObjects(); if (objs.length < 2) { toast('Select 2+ objects', true); return; }
    canvas.discardActiveObject();
    const items = objs.map((o) => ({ o, r: o.getBoundingRect(true) }));
    fn(items);
    objs.forEach((o) => o.setCoords());
    canvas.setActiveObject(new fabric.ActiveSelection(objs, { canvas }));
    canvas.requestRenderAll(); snapshot(); updateAllArrows();
  }
  function selBounds(items) {
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    items.forEach(({ r: rc }) => { l = Math.min(l, rc.left); t = Math.min(t, rc.top); r = Math.max(r, rc.left + rc.width); b = Math.max(b, rc.top + rc.height); });
    return { l, t, r, b, cx: (l + r) / 2, cy: (t + b) / 2 };
  }
  function distribute(items, axis) {
    if (items.length < 3) { toast('Select 3+ to distribute', true); return; }
    const key = axis === 'x' ? (it) => it.r.left + it.r.width / 2 : (it) => it.r.top + it.r.height / 2;
    const s = items.slice().sort((a, b) => key(a) - key(b));
    const first = key(s[0]), last = key(s[s.length - 1]), step = (last - first) / (s.length - 1);
    s.forEach((it, i) => { const d = first + step * i - key(it); if (axis === 'x') it.o.left += d; else it.o.top += d; });
  }
  $('#alL').addEventListener('click', () => alignObjects((it) => { const g = selBounds(it); it.forEach(({ o, r }) => (o.left += g.l - r.left)); }));
  $('#alR').addEventListener('click', () => alignObjects((it) => { const g = selBounds(it); it.forEach(({ o, r }) => (o.left += g.r - (r.left + r.width))); }));
  $('#alCx').addEventListener('click', () => alignObjects((it) => { const g = selBounds(it); it.forEach(({ o, r }) => (o.left += g.cx - (r.left + r.width / 2))); }));
  $('#alT').addEventListener('click', () => alignObjects((it) => { const g = selBounds(it); it.forEach(({ o, r }) => (o.top += g.t - r.top)); }));
  $('#alB').addEventListener('click', () => alignObjects((it) => { const g = selBounds(it); it.forEach(({ o, r }) => (o.top += g.b - (r.top + r.height))); }));
  $('#alM').addEventListener('click', () => alignObjects((it) => { const g = selBounds(it); it.forEach(({ o, r }) => (o.top += g.cy - (r.top + r.height / 2))); }));
  $('#alDistH').addEventListener('click', () => alignObjects((it) => distribute(it, 'x')));
  $('#alDistV').addEventListener('click', () => alignObjects((it) => distribute(it, 'y')));

  // ---- hyperlinks ------------------------------------------------------------
  $('#linkBtn').addEventListener('click', () => {
    const o = canvas.getActiveObject();
    if (!o || o._objects) return;
    const url = prompt('Hyperlink URL (leave blank to remove):', o.link || '');
    if (url === null) return;
    const v = url.trim();
    o.set({ link: v || undefined, hoverCursor: v ? 'alias' : undefined });
    canvas.requestRenderAll(); snapshot(); updateContextButtons();
    toast(v ? 'Link set — Ctrl+click the object to open' : 'Link removed');
  });

  // ---- image crop (adjustable crop frame: drag/resize, Enter to apply) --------
  $('#cropBtn').addEventListener('click', () => {
    if (cropMode) { applyCropFromFrame(); return; } // second click applies
    const o = canvas.getActiveObject();
    if (!o || o.type !== 'image') { toast('Select an image first', true); return; }
    startCrop(o);
  });
  function startCrop(img) {
    exitConnect(); exitPick(); clearPending();
    cropMode = true; cropImg = img;
    const r = img.getBoundingRect(true); // current displayed bounds (scene)
    // Make every other object inert so only the crop frame is interactive.
    cropPrev = canvas.getObjects().map((o) => ({ o, sel: o.selectable, ev: o.evented }));
    canvas.getObjects().forEach((o) => { o.selectable = false; o.evented = false; });
    // Faint full-source ghost so the user can see what reverse-cropping will reveal.
    const sx = img.scaleX || 1, sy = img.scaleY || 1;
    const imgLeft = img.left - (img.width * sx) / 2, imgTop = img.top - (img.height * sy) / 2;
    const fullLeft = imgLeft - (img.cropX || 0) * sx, fullTop = imgTop - (img.cropY || 0) * sy;
    const srcEl = img._originalElement || (img.getElement && img.getElement());
    if (srcEl) {
      cropGhost = new fabric.Image(srcEl, {
        left: fullLeft, top: fullTop, originX: 'left', originY: 'top', scaleX: sx, scaleY: sy,
        opacity: 0.3, selectable: false, evented: false, excludeFromExport: true, objectCaching: false,
      });
      suppress = true; canvas.add(cropGhost); suppress = false;
    }
    cropFrame = new fabric.Rect({
      left: r.left, top: r.top, width: r.width, height: r.height, originX: 'left', originY: 'top',
      fill: 'rgba(110,168,254,0.12)', stroke: '#6ea8fe', strokeWidth: 1, strokeDashArray: [6, 4],
      strokeUniform: true, cornerColor: '#6ea8fe', cornerStrokeColor: '#fff', transparentCorners: false,
      lockRotation: true, objectCaching: false, excludeFromExport: true, selectable: true, evented: true,
    });
    cropFrame.setControlsVisibility({ mtr: false });
    $('#cropBtn').setAttribute('aria-pressed', 'true');
    suppress = true; canvas.add(cropFrame); suppress = false;
    canvas.setActiveObject(cropFrame); canvas.requestRenderAll();
    toast('Drag / resize the crop box · Enter or Crop to apply · Esc to cancel');
  }
  function exitCrop() {
    if (!cropMode) return;
    const img = cropImg;
    suppress = true;
    if (cropFrame) { canvas.remove(cropFrame); cropFrame = null; }
    if (cropGhost) { canvas.remove(cropGhost); cropGhost = null; }
    suppress = false;
    (cropPrev || []).forEach(({ o, sel, ev }) => { o.selectable = sel; o.evented = ev; });
    cropPrev = null; cropMode = false; cropImg = null;
    canvas.selection = true; canvas.defaultCursor = 'default';
    $('#cropBtn').setAttribute('aria-pressed', 'false');
    if (img) canvas.setActiveObject(img);
    canvas.requestRenderAll();
  }
  function applyCropFromFrame() {
    if (!cropFrame || !cropImg) { exitCrop(); return; }
    const fr = cropFrame.getBoundingRect(true), img = cropImg;
    exitCrop();
    applyCrop(img, { x: fr.left, y: fr.top, w: fr.width, h: fr.height });
    canvas.setActiveObject(img); canvas.requestRenderAll(); snapshot();
  }
  function imgSourceSize(img) {
    const el = img._originalElement || img._element || (img.getElement && img.getElement());
    return {
      ew: (el && (el.naturalWidth || el.width)) || (img.width + (img.cropX || 0)),
      eh: (el && (el.naturalHeight || el.height)) || (img.height + (img.cropY || 0)),
    };
  }
  // Crop assumes an unrotated image (angle 0). Clamps to the FULL source extent, so dragging
  // the frame outward grows the crop back (reverse cropping) up to the original image.
  function applyCrop(img, r) {
    const sx = img.scaleX || 1, sy = img.scaleY || 1;
    const dispW = img.width * sx, dispH = img.height * sy;
    const imgLeft = img.left - dispW / 2, imgTop = img.top - dispH / 2; // center origin
    const { ew, eh } = imgSourceSize(img);
    const fullLeft = imgLeft - (img.cropX || 0) * sx, fullTop = imgTop - (img.cropY || 0) * sy;
    const fullRight = fullLeft + ew * sx, fullBottom = fullTop + eh * sy;
    const x0 = Math.max(r.x, fullLeft), y0 = Math.max(r.y, fullTop);
    const x1 = Math.min(r.x + r.w, fullRight), y1 = Math.min(r.y + r.h, fullBottom);
    if (x1 - x0 < 4 || y1 - y0 < 4) return;
    img.set({
      cropX: (x0 - fullLeft) / sx, cropY: (y0 - fullTop) / sy,
      width: (x1 - x0) / sx, height: (y1 - y0) / sy,
      left: x0 + (x1 - x0) / 2, top: y0 + (y1 - y0) / 2,
    });
    img.setCoords();
  }

  // Enable/disable contextual buttons based on the current selection.
  function updateContextButtons() {
    const o = canvas.getActiveObject();
    const single = !!o && !o._objects;
    $('#linkBtn').disabled = !single;
    $('#linkBtn').setAttribute('aria-pressed', String(!!(o && o.link)));
    $('#cropBtn').disabled = !(single && o.type === 'image');
    $('#lockBtn').disabled = !o;
    $('#lockBtn').setAttribute('aria-pressed', String(!!(o && o.locked)));
    updatePropsPopup();
  }

  // ---- image upload (client downscale -> upload.php -> add) -------------------
  $('#addImage').addEventListener('click', () => { exitConnect(); exitCrop(); exitPick(); clearPending(); setActiveTool('select'); $('#fileInput').click(); });
  $('#fileInput').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setStatus('Uploading…');
    try {
      const blob = await downscale(file);
      const fd = new FormData();
      fd.append('board', boardId);
      fd.append('file', blob, file.name.replace(/\.[^.]+$/, '') + (blob.type === 'image/png' ? '.png' : '.jpg'));
      const r = await api('upload.php', { method: 'POST', body: fd });
      addImageFromUrl(r.url);
      setStatus('Saved');
    } catch (err) {
      if (err.status === 401) { toast('Session expired — please sign in', true); setTimeout(goGallery, 1200); }
      else { toast('Image upload failed', true); setStatus(''); }
    }
  });
  function downscale(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.width, h = img.height;
        const scale = Math.min(1, IMG_MAX_DIM / Math.max(w, h));
        w = Math.round(w * scale); h = Math.round(h * scale);
        const off = document.createElement('canvas');
        off.width = w; off.height = h;
        off.getContext('2d').drawImage(img, 0, 0, w, h);
        const keepPng = file.type === 'image/png' || file.type === 'image/gif';
        off.toBlob((b) => b ? resolve(b) : reject(new Error('encode')), keepPng ? 'image/png' : 'image/jpeg', 0.9);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }
  function addImageFromUrl(url, atScene) {
    fabric.Image.fromURL(url, (img) => {
      const c = atScene || sceneCenter(), max = 600 / canvas.getZoom();
      const s = Math.min(1, max / Math.max(img.width, img.height));
      img.set({ originX: 'center', originY: 'center', left: c.left, top: c.top, scaleX: s, scaleY: s });
      setDrawMode(false);
      canvas.add(img); canvas.setActiveObject(img); canvas.requestRenderAll();
    }, { crossOrigin: 'anonymous' });
  }

  // ---- clipboard paste + drag-drop image import ------------------------------
  async function importImageBlob(blob, atScene) {
    setStatus('Uploading…');
    try {
      const file = blob instanceof File ? blob : new File([blob], 'pasted.png', { type: blob.type || 'image/png' });
      const small = await downscale(file);
      const fd = new FormData();
      fd.append('board', boardId);
      fd.append('file', small, 'img' + (small.type === 'image/png' ? '.png' : '.jpg'));
      const r = await api('upload.php', { method: 'POST', body: fd });
      addImageFromUrl(r.url, atScene);
      setStatus('Saved');
    } catch (err) {
      if (err.status === 401) { toast('Session expired — please sign in', true); setTimeout(goGallery, 1200); }
      else { toast('Image import failed', true); setStatus(''); }
    }
  }
  window.addEventListener('paste', (e) => {
    if (isTyping()) return; // let text editing paste normally
    const items = (e.clipboardData || {}).items || [];
    for (const it of items) {
      if (it.type && it.type.indexOf('image/') === 0) { const blob = it.getAsFile(); if (blob) { e.preventDefault(); importImageBlob(blob); return; } }
    }
    if (pasteClipboard()) e.preventDefault(); // internal object paste (Ctrl+V with no OS image)
  });
  host.addEventListener('dragover', (e) => e.preventDefault());
  host.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = [...((e.dataTransfer && e.dataTransfer.files) || [])].filter((f) => f.type.indexOf('image/') === 0);
    if (!files.length) return;
    const z = canvas.getZoom(), v = canvas.viewportTransform;
    const sx = (e.offsetX - v[4]) / z, sy = (e.offsetY - v[5]) / z;
    files.forEach((f, i) => importImageBlob(f, { left: sx + i * 26, top: sy + i * 26 }));
  });
  // Prevent the browser from opening an image when dropped outside the canvas.
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  // ---- eyedropper ------------------------------------------------------------
  $('#toolPick').addEventListener('click', startPick);
  function startPick() {
    exitConnect(); exitCrop(); clearPending(); setDrawMode(false);
    pickMode = true; canvas.skipTargetFind = true; canvas.selection = false;
    canvas.defaultCursor = 'crosshair'; canvas.requestRenderAll();
    setActiveTool('pick'); toast('Click to pick a color · Esc to cancel');
  }
  function exitPick() {
    if (!pickMode) return;
    pickMode = false; canvas.skipTargetFind = false; canvas.selection = true; canvas.defaultCursor = 'default';
  }
  function sampleColorAt(opt) {
    const ctx = canvas.getContext();
    const rs = canvas.getRetinaScaling ? canvas.getRetinaScaling() : (window.devicePixelRatio || 1);
    const x = Math.round(opt.e.offsetX * rs), y = Math.round(opt.e.offsetY * rs);
    try {
      const d = ctx.getImageData(x, y, 1, 1).data;
      const hex = '#' + [d[0], d[1], d[2]].map((n) => n.toString(16).padStart(2, '0')).join('');
      $('#color').value = hex; applyColor(hex); toast('Picked ' + hex);
    } catch (_) { toast('Could not sample color', true); }
    exitPick(); setActiveTool('select');
  }

  // ---- object properties popup (opacity / flip / grayscale / radius / shadow) -
  let propsOpen = false;
  $('#propsBtn').addEventListener('click', () => {
    propsOpen = !propsOpen;
    $('#propsPopup').classList.toggle('hidden', !propsOpen);
    $('#propsBtn').setAttribute('aria-pressed', String(propsOpen));
    if (propsOpen && brushOpen) { brushOpen = false; $('#brushPopup').classList.add('hidden'); $('#brushBtn').setAttribute('aria-pressed', 'false'); }
    if (propsOpen) { propsViaContext = false; resetPopupTR($('#propsPopup')); updatePropsPopup(); }
  });
  $('#opacity').addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10) / 100; $('#opacityVal').textContent = e.target.value;
    activeObjects().forEach((o) => o.set('opacity', v)); canvas.requestRenderAll();
  });
  $('#opacity').addEventListener('change', () => { if (activeObjects().length) snapshot(); });
  function applyToActive(fn) { const objs = activeObjects(); if (!objs.length) return; objs.forEach(fn); canvas.requestRenderAll(); snapshot(); updatePropsPopup(); }
  $('#flipH').addEventListener('click', () => applyToActive((o) => o.set('flipX', !o.flipX)));
  $('#flipV').addEventListener('click', () => applyToActive((o) => o.set('flipY', !o.flipY)));
  $('#grayBtn').addEventListener('click', () => {
    const imgs = activeObjects().filter(isImage);
    if (!imgs.length) { toast('Select an image', true); return; }
    imgs.forEach((o) => {
      o.filters = o.filters || [];
      const i = o.filters.findIndex((f) => f instanceof fabric.Image.filters.Grayscale);
      if (i >= 0) o.filters.splice(i, 1); else o.filters.push(new fabric.Image.filters.Grayscale());
      o.applyFilters();
    });
    canvas.requestRenderAll(); snapshot(); updatePropsPopup();
  });
  $('#cornerRadius').addEventListener('input', (e) => {
    const n = parseInt(e.target.value, 10); $('#radiusVal').textContent = n;
    activeObjects().forEach((o) => { if (o.type === 'rect') o.set({ rx: n, ry: n }); }); canvas.requestRenderAll();
  });
  $('#cornerRadius').addEventListener('change', () => { if (activeObjects().length) snapshot(); });
  function setShadow(o, on) {
    o.set('shadow', on ? new fabric.Shadow({ color: $('#shadowColor').value, blur: parseInt($('#shadowBlur').value, 10), offsetX: 4, offsetY: 4 }) : null);
  }
  $('#shadowBtn').addEventListener('click', () => {
    const objs = activeObjects(); if (!objs.length) return;
    const turnOn = !objs[0].shadow; objs.forEach((o) => setShadow(o, turnOn));
    canvas.requestRenderAll(); snapshot(); updatePropsPopup();
  });
  const refreshShadow = () => { activeObjects().forEach((o) => { if (o.shadow) setShadow(o, true); }); canvas.requestRenderAll(); };
  $('#shadowColor').addEventListener('input', refreshShadow);
  $('#shadowBlur').addEventListener('input', refreshShadow);
  $('#shadowBlur').addEventListener('change', () => { if (activeObjects().length) snapshot(); });

  // Image filters: keep at most one instance of each; value 0 removes it.
  function imgFilterGet(img, Klass) { return (img.filters || []).find((f) => f instanceof Klass); }
  function imgFilterSet(img, Klass, key, value) {
    img.filters = img.filters || [];
    const f = imgFilterGet(img, Klass);
    if (value === 0) { if (f) img.filters.splice(img.filters.indexOf(f), 1); }
    else if (f) { f[key] = value; }
    else { const o = {}; o[key] = value; img.filters.push(new Klass(o)); }
    img.applyFilters();
  }
  function bindFilter(slider, valEl, Klass, key, scale) {
    $(slider).addEventListener('input', (e) => {
      const raw = parseInt(e.target.value, 10); $(valEl).textContent = raw;
      activeObjects().filter(isImage).forEach((o) => imgFilterSet(o, Klass, key, raw * scale));
      canvas.requestRenderAll();
    });
    $(slider).addEventListener('change', () => { if (activeObjects().filter(isImage).length) snapshot(); });
  }
  bindFilter('#fBlur', '#fBlurVal', fabric.Image.filters.Blur, 'blur', 0.01);          // 0..100 -> 0..1
  bindFilter('#fBright', '#fBrightVal', fabric.Image.filters.Brightness, 'brightness', 0.01); // -100..100 -> -1..1
  bindFilter('#fContrast', '#fContrastVal', fabric.Image.filters.Contrast, 'contrast', 0.01);
  bindFilter('#fSat', '#fSatVal', fabric.Image.filters.Saturation, 'saturation', 0.01);
  bindFilter('#fHue', '#fHueVal', fabric.Image.filters.HueRotation, 'rotation', 1 / 180); // -180..180 deg -> -1..1

  function updatePropsPopup() {
    const o = canvas.getActiveObject();
    $('#propsBtn').disabled = !o;
    if (!propsOpen || !o) return;
    $('#opacity').value = Math.round((o.opacity != null ? o.opacity : 1) * 100); $('#opacityVal').textContent = $('#opacity').value;
    setPressed($('#flipH'), !!o.flipX); setPressed($('#flipV'), !!o.flipY);
    const gray = isImage(o) && (o.filters || []).some((f) => f instanceof fabric.Image.filters.Grayscale);
    setPressed($('#grayBtn'), gray); $('#grayBtn').disabled = !isImage(o);
    const isRect = o.type === 'rect';
    $('#radiusRow').style.display = isRect ? '' : 'none';
    if (isRect) { $('#cornerRadius').value = Math.round(o.rx || 0); $('#radiusVal').textContent = Math.round(o.rx || 0); }
    setPressed($('#shadowBtn'), !!o.shadow);
    if (o.shadow) { $('#shadowColor').value = String(o.shadow.color || '#000000').slice(0, 7); $('#shadowBlur').value = o.shadow.blur || 14; }
    $('#noteRow').style.display = o.type === 'textbox' ? '' : 'none';
    const img = isImage(o);
    $('#imgAdjust').style.display = img ? '' : 'none';
    if (img) {
      const gv = (Klass, key, scale) => { const f = imgFilterGet(o, Klass); return f ? Math.round((f[key] || 0) / scale) : 0; };
      const setS = (sel, valSel, n) => { $(sel).value = n; $(valSel).textContent = n; };
      setS('#fBlur', '#fBlurVal', gv(fabric.Image.filters.Blur, 'blur', 0.01));
      setS('#fBright', '#fBrightVal', gv(fabric.Image.filters.Brightness, 'brightness', 0.01));
      setS('#fContrast', '#fContrastVal', gv(fabric.Image.filters.Contrast, 'contrast', 0.01));
      setS('#fSat', '#fSatVal', gv(fabric.Image.filters.Saturation, 'saturation', 0.01));
      setS('#fHue', '#fHueVal', gv(fabric.Image.filters.HueRotation, 'rotation', 1 / 180));
    }
  }

  // ---- lock ------------------------------------------------------------------
  function applyLock(o, locked) {
    o.set({
      locked: locked || undefined,
      lockMovementX: locked, lockMovementY: locked, lockScalingX: locked, lockScalingY: locked, lockRotation: locked,
      hasControls: !locked, hoverCursor: locked ? 'not-allowed' : (o.link ? 'alias' : undefined),
    });
    if (isText(o)) o.set('editable', !locked);
  }
  $('#lockBtn').addEventListener('click', () => {
    const objs = activeObjects(); if (!objs.length) return;
    const turnOn = !objs[0].locked;
    objs.forEach((o) => applyLock(o, turnOn));
    canvas.requestRenderAll(); snapshot(); updateContextButtons();
    toast(turnOn ? 'Locked' : 'Unlocked');
  });

  // ---- auto-arrange images into a grid ---------------------------------------
  $('#arrangeBtn').addEventListener('click', () => {
    let imgs = activeObjects().filter(isImage);
    if (imgs.length < 2) imgs = canvas.getObjects().filter(isImage);
    if (imgs.length < 2) { toast('Need 2+ images to arrange', true); return; }
    const rects = imgs.map((o) => o.getBoundingRect(true));
    const cellW = Math.max(...rects.map((r) => r.width)), cellH = Math.max(...rects.map((r) => r.height));
    const gap = Math.max(cellW, cellH) * 0.08;
    const cols = Math.ceil(Math.sqrt(imgs.length)), rows = Math.ceil(imgs.length / cols);
    const cx = rects.reduce((s, r) => s + r.left + r.width / 2, 0) / rects.length;
    const cy = rects.reduce((s, r) => s + r.top + r.height / 2, 0) / rects.length;
    const x0 = cx - ((cols - 1) * (cellW + gap)) / 2, y0 = cy - ((rows - 1) * (cellH + gap)) / 2;
    canvas.discardActiveObject();
    imgs.forEach((o, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      o.set({ originX: 'center', originY: 'center', left: x0 + col * (cellW + gap), top: y0 + row * (cellH + gap) });
      o.setCoords();
    });
    canvas.requestRenderAll(); snapshot(); updateAllArrows();
  });

  // ---- color swatches --------------------------------------------------------
  const DEFAULT_SWATCHES = ['#4d8bff', '#e5534b', '#3fb950', '#f0b429', '#a371f7', '#ec6cb9', '#ffffff', '#000000'];
  function loadSwatches() { try { return JSON.parse(localStorage.getItem('mb_swatches')) || DEFAULT_SWATCHES.slice(); } catch (_) { return DEFAULT_SWATCHES.slice(); } }
  function saveSwatches(arr) { try { localStorage.setItem('mb_swatches', JSON.stringify(arr)); } catch (_) {} }
  function buildSwatches() {
    const wrap = $('#swatches'); wrap.innerHTML = '';
    loadSwatches().forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sw'; b.style.background = c; b.title = c;
      b.addEventListener('click', () => { $('#color').value = c; applyColor(c); });
      wrap.appendChild(b);
    });
  }
  $('#swatchAdd').addEventListener('click', () => {
    const c = $('#color').value, arr = loadSwatches();
    if (!arr.includes(c)) { arr.unshift(c); if (arr.length > 16) arr.pop(); saveSwatches(arr); buildSwatches(); toast('Swatch saved'); }
  });

  // ---- sticky-note background colors -----------------------------------------
  const NOTE_COLORS = ['#fff3a8', '#ffd2a8', '#ffb3ba', '#bdeec0', '#a8d8ff', '#e3c8ff', '#ffffff', '#d8dde6'];
  function buildNoteSwatches() {
    const wrap = $('#noteSwatches'); wrap.innerHTML = '';
    NOTE_COLORS.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sw'; b.style.background = c; b.title = c;
      b.addEventListener('click', () => { activeTexts().forEach((o) => o.set('backgroundColor', c)); canvas.requestRenderAll(); snapshot(); updatePropsPopup(); });
      wrap.appendChild(b);
    });
  }
  $('#noteNone').addEventListener('click', () => { activeTexts().forEach((o) => o.set('backgroundColor', '')); canvas.requestRenderAll(); snapshot(); });

  // ---- top buttons -----------------------------------------------------------
  $('#backBtn').addEventListener('click', async () => { await save(); goGallery(); });
  $('#saveBtn').addEventListener('click', () => { dirty = true; save(); });
  $('#refreshBtn').addEventListener('click', () => {
    if (dirty && !confirm('Discard unsaved changes and reload the saved version?')) return;
    load();
  });
  $('#undoBtn').addEventListener('click', undo);
  $('#redoBtn').addEventListener('click', redo);
  $('#title').addEventListener('input', scheduleSave);

  // ---- keyboard shortcuts ----------------------------------------------------
  function isTyping() {
    const ao = canvas.getActiveObject();
    if (ao && ao.isEditing) return true;
    return /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  }
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isTyping() && !panning) {
      spaceDown = true; canvas.skipTargetFind = true; canvas.defaultCursor = 'grab'; canvas.setCursor('grab'); e.preventDefault(); return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); dirty = true; save(); return; }
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSel(); return; }
    if (mod && e.key.toLowerCase() === 'c' && !isTyping() && canvas.getActiveObject()) { e.preventDefault(); if (copySel()) toast('Copied'); return; }
    if (mod && e.key.toLowerCase() === 'x' && !isTyping() && canvas.getActiveObject()) { e.preventDefault(); if (copySel()) deleteSel(); return; }
    if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomBy(1.2); return; }
    if (mod && e.key === '-') { e.preventDefault(); zoomBy(1 / 1.2); return; }
    if (mod && e.key === '0') { e.preventDefault(); setZoom(1); return; }
    if (cropMode && e.key === 'Enter') { e.preventDefault(); applyCropFromFrame(); return; }
    if (e.key === 'Escape') { exitConnect(); exitCrop(); exitPick(); clearPending(); eraseMode = false; setDrawMode(false); setActiveTool('select'); canvas.discardActiveObject(); canvas.requestRenderAll(); return; }
    if (isTyping()) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); }
    else if (e.key === 'v' || e.key === 'V') toSelect();
    else if (e.key === 'd' || e.key === 'D') startDraw();
    else if (e.key === 'e' || e.key === 'E') startErase();
    else if (e.key === 't' || e.key === 'T') startAdd('text');
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') { spaceDown = false; canvas.skipTargetFind = connectMode; canvas.defaultCursor = connectMode ? 'crosshair' : 'default'; if (!panning) canvas.setCursor(connectMode ? 'crosshair' : 'default'); }
  });

  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---- load board ------------------------------------------------------------
  async function load() {
    try {
      const b = await api('board-get.php?id=' + encodeURIComponent(boardId));
      $('#title').value = b.title || 'Untitled';
      document.title = (b.title || 'MoodBoard') + ' — MoodBoard';
      const done = () => {
        // Re-apply lock flags and image filters that aren't reconstructed automatically.
        canvas.getObjects().forEach((o) => {
          if (o.locked) applyLock(o, true);
          if (isText(o) && !o.listType) {
            const first = String(o.text || '').split('\n').find((l) => l.trim()) || '';
            if (/^•\s/.test(first)) o.listType = 'bullet';
            else if (/^\d+\.\s/.test(first)) o.listType = 'number';
          }
          if (isImage(o) && o.filters && o.filters.length) o.applyFilters();
        });
        canvas.renderAll(); suppress = false;
        history = [serialize()]; hi = 0; updateHistButtons();
        dirty = false; setStatus('Saved'); fitToContent();
        updateAllArrows(); // reconnect connectors after load
        ensureBoardFonts(); // load any custom fonts used, then re-render
      };
      suppress = true;
      if (b.doc) canvas.loadFromJSON(b.doc, done);
      else { canvas.clear(); canvas.backgroundColor = '#ffffff'; done(); }
    } catch (err) {
      if (err.status === 401) { toast('Sign in required', true); setTimeout(goGallery, 1000); }
      else if (err.status === 404) { toast('Board not found', true); setTimeout(goGallery, 1000); }
      else toast('Failed to load board', true);
    }
  }

  $('#sizeVal').textContent = $('#size').value;
  applyIcons(); buildFonts(); buildSwatches(); buildNoteSwatches();
  updateZoomLabel(); updateHistButtons(); setActiveTool('select'); updateContextButtons(); updateTopBar();
  load();
})();
