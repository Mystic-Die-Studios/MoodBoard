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

  // ---- canvas setup ----------------------------------------------------------
  const canvas = new fabric.Canvas('c', {
    backgroundColor: '#ffffff', preserveObjectStacking: true, selection: true,
    fireRightClick: true, fireMiddleClick: true, stopContextMenu: true,
    uniformScaling: false, // corner drags resize freely (Shift to keep ratio)
  });
  canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
  canvas.freeDrawingBrush.color = $('#color').value;
  canvas.freeDrawingBrush.width = parseInt($('#size').value, 10);

  // Custom props to persist (object ids + connector endpoints).
  const PROPS = ['id', 'fromId', 'toId'];

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
    const s = borderPoint(a, bc.x, bc.y), e = borderPoint(b, ac.x, ac.y);
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

  canvas.on('mouse:wheel', (opt) => {
    const e = opt.e; e.preventDefault(); e.stopPropagation();
    setZoom(canvas.getZoom() * Math.pow(0.999, e.deltaY), { x: e.offsetX, y: e.offsetY });
  });

  // Pan: empty-space drag, Space-drag, Alt-drag, or middle mouse.
  let spaceDown = false, panning = false, panX = 0, panY = 0;
  function startPan(e) {
    panning = true; canvas.selection = false; canvas.skipTargetFind = true;
    panX = e.clientX; panY = e.clientY; canvas.setCursor('grabbing');
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
    if (connectMode) { if (connectFrom) { connectPreview.to = canvas.getPointer(opt.e); canvas.requestRenderAll(); } return; }
    if (creating) { updateCreate(canvas.getPointer(opt.e)); return; }
    if (!panning) return;
    const e = opt.e;
    // relativePan updates object coords too — keeps hit-detection aligned after panning.
    canvas.relativePan(new fabric.Point(e.clientX - panX, e.clientY - panY));
    panX = e.clientX; panY = e.clientY;
  });
  canvas.on('mouse:up', (opt) => {
    if (panning) { endPan(); return; }
    if (connectMode) { finishConnect(opt); return; }
    if (creating) endCreate();
  });
  window.addEventListener('mouseup', () => { if (panning) endPan(); }); // catch right-button release

  // ---- tools (left panel) ----------------------------------------------------
  const TOOL_BTN = {
    select: '#toolSelect', draw: '#toolDraw',
    'add-text': '#addText', 'add-rect': '#addRect', 'add-ellipse': '#addEllipse',
    'add-triangle': '#addTriangle', 'add-line': '#addLine', 'add-arrow': '#addArrow', connect: '#toolConnect',
  };
  function setActiveTool(name) {
    Object.values(TOOL_BTN).forEach((sel) => $(sel).setAttribute('aria-pressed', 'false'));
    if (TOOL_BTN[name]) $(TOOL_BTN[name]).setAttribute('aria-pressed', 'true');
  }
  function setDrawMode(draw) { canvas.isDrawingMode = draw; }

  let pendingAdd = null, creating = null, startPt = null;
  let connectMode = false, connectFrom = null, connectPreview = null;
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
    exitConnect(); clearPending(); pendingAdd = kind; setDrawMode(false);
    // While placing, ignore existing objects entirely so we never move/select them.
    canvas.skipTargetFind = true; canvas.selection = false;
    canvas.defaultCursor = 'crosshair'; canvas.discardActiveObject(); canvas.requestRenderAll();
    setActiveTool('add-' + kind);
  }
  function startConnect() {
    clearPending(); setDrawMode(false);
    connectMode = true; connectFrom = null; connectPreview = null;
    canvas.skipTargetFind = true; canvas.selection = false; canvas.discardActiveObject();
    canvas.defaultCursor = 'crosshair'; canvas.requestRenderAll();
    setActiveTool('connect');
  }
  function toSelect() { exitConnect(); clearPending(); setDrawMode(false); setActiveTool('select'); }

  $('#toolSelect').addEventListener('click', toSelect);
  $('#toolDraw').addEventListener('click', () => { exitConnect(); clearPending(); setDrawMode(true); setActiveTool('draw'); });
  $('#addText').addEventListener('click', () => startAdd('text'));
  $('#addRect').addEventListener('click', () => startAdd('rect'));
  $('#addEllipse').addEventListener('click', () => startAdd('ellipse'));
  $('#addTriangle').addEventListener('click', () => startAdd('triangle'));
  $('#addLine').addEventListener('click', () => startAdd('line'));
  $('#addArrow').addEventListener('click', () => startAdd('arrow'));
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
    return new fabric.IText('Text', { fontSize: 36, fill: color, fontFamily: 'system-ui, sans-serif' });
  }
  function placeAt(kind, left, top) {
    const obj = makeObject(kind);
    obj.set({ originX: 'center', originY: 'center', left, top });
    canvas.add(obj); canvas.setActiveObject(obj); canvas.requestRenderAll();
    if (kind === 'text') { obj.enterEditing(); obj.selectAll(); }
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
        else if (o.type === 'rect') o.set({ width: 200, height: 130, left: o.left - 100, top: o.top - 65 });
        else o.set({ width: 190, height: 160, left: o.left - 95, top: o.top - 80 });
      }
    }
    o.setCoords();
    startPt = null; clearPending(); // restores selection + target-finding
    canvas.setActiveObject(o); canvas.requestRenderAll();
    snapshot(); setActiveTool('select');
  }

  // Single mouse:down handler: text = click to place, shapes = drag to size, else pan.
  canvas.on('mouse:down', (opt) => {
    const e = opt.e;
    // Right or middle drag (or Space/Alt) pans the camera; left-drag is for select/draw.
    if (e.button === 2 || e.button === 1 || spaceDown || e.altKey) { startPan(e); return; }
    if (connectMode) {
      const p = canvas.getPointer(opt.e), src = objectAt(p);
      if (src) { connectFrom = src; connectPreview = { from: centerOf(src), to: p }; }
      return;
    }
    if (pendingAdd) {
      const p = canvas.getPointer(opt.e), kind = pendingAdd;
      if (kind === 'text') { clearPending(); setActiveTool('select'); placeAt('text', p.x, p.y); }
      else beginCreate(kind, p);
      return;
    }
    // left-click on empty space → Fabric's marquee selection (no custom handling needed)
  });

  // ---- snapping + alignment guides (nearby objects only) ---------------------
  let snapOn = true, guides = [];
  $('#snapToggle').addEventListener('click', () => {
    snapOn = !snapOn;
    $('#snapToggle').setAttribute('aria-pressed', String(snapOn));
    if (!snapOn) clearGuides();
  });
  function clearGuides() { if (guides.length) { guides = []; canvas.requestRenderAll(); } }

  canvas.on('object:moving', (e) => {
    guides = [];
    const obj = e.target;
    if (isText(obj)) positionPopover(obj);
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
  canvas.on('object:scaling', (e) => { if (isText(e.target)) positionPopover(e.target); updateAllArrows(); });
  canvas.on('object:rotating', updateAllArrows);
  canvas.on('object:modified', clearGuides);
  canvas.on('mouse:up', clearGuides);

  // Overlay: alignment-guide segments, connector preview, and text-popover follow.
  canvas.on('after:render', () => {
    if (textActive() && !$('#textPopover').classList.contains('hidden')) positionPopover(textActive());
    const ctx = canvas.getContext(), v = canvas.viewportTransform, z = canvas.getZoom();
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
  const serialize = () => JSON.stringify(canvas.toJSON(PROPS));
  function snapshot() {
    if (suppress || creating) return; // skip mid-creation; we snapshot once on finish
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
  canvas.on('path:created', snapshot);

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
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    let url = null;
    try {
      url = canvas.toDataURL({ format: 'jpeg', quality: 0.45, multiplier: mult,
        left: b.left - pad, top: b.top - pad, width: b.width + pad * 2, height: b.height + pad * 2 });
    } catch (_) {}
    canvas.setViewportTransform(v);
    return url;
  }
  async function save() {
    if (saving) { scheduleSave(); return; }
    if (!dirty) return;
    saving = true; dirty = false; setStatus('Saving…');
    try {
      await postJSON('board-save.php', { id: boardId, title: $('#title').value, doc: canvas.toJSON(PROPS), thumb: makeThumb() });
      setStatus('Saved');
    } catch (err) {
      dirty = true;
      if (err.status === 401) { toast('Session expired — please sign in', true); setTimeout(goGallery, 1200); }
      else { setStatus('Save failed'); toast('Save failed', true); }
    } finally { saving = false; }
  }

  // ---- color / size controls -------------------------------------------------
  $('#color').addEventListener('input', (e) => {
    const c = e.target.value;
    canvas.freeDrawingBrush.color = c;
    const objs = activeObjects();
    if (objs.length) {
      objs.forEach((o) => isStrokey(o) ? o.set('stroke', c) : o.set('fill', c));
      canvas.requestRenderAll(); snapshot();
    }
  });
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
    $('#fontFamily').value = o.fontFamily || 'system-ui, sans-serif';
    $('#fontSize').value = Math.round(o.fontSize || 36);
    setPressed($('#boldBtn'), o.fontWeight === 'bold' || Number(o.fontWeight) >= 600);
    setPressed($('#italicBtn'), o.fontStyle === 'italic');
    setPressed($('#underlineBtn'), !!o.underline);
    $('#alignBtn').textContent = cap(o.textAlign || 'left');
    setPressed($('#bulletBtn'), isListType(o, 'bullet'));
    setPressed($('#numberBtn'), isListType(o, 'number'));
    positionPopover(o);
  }
  function onSelection() { syncColor(canvas.getActiveObject()); updatePopover(); }
  canvas.on('selection:created', onSelection);
  canvas.on('selection:updated', onSelection);
  canvas.on('selection:cleared', () => $('#textPopover').classList.add('hidden'));

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
    const css = e.target.value;
    activeTexts().forEach((o) => o.set('fontFamily', css));
    canvas.requestRenderAll();
    ensureFont(css).then(() => { canvas.requestRenderAll(); snapshot(); updatePopover(); });
  });
  $('#fontSize').addEventListener('input', (e) => {
    const n = Math.min(400, Math.max(6, parseInt(e.target.value, 10) || 36));
    activeTexts().forEach((o) => o.set('fontSize', n)); canvas.requestRenderAll(); updatePopover();
  });
  $('#fontSize').addEventListener('change', () => { if (activeTexts().length) snapshot(); });
  $('#boldBtn').addEventListener('click', () => toggleText('fontWeight', 'bold', 'normal', (o) => o.fontWeight === 'bold'));
  $('#italicBtn').addEventListener('click', () => toggleText('fontStyle', 'italic', 'normal', (o) => o.fontStyle === 'italic'));
  $('#underlineBtn').addEventListener('click', () => toggleText('underline', true, false, (o) => !!o.underline));
  $('#alignBtn').addEventListener('click', () => {
    const objs = activeTexts(); if (!objs.length) return;
    const order = ['left', 'center', 'right'];
    applyText('textAlign', order[(order.indexOf(objs[0].textAlign || 'left') + 1) % order.length]);
  });

  // Lists: prefix each line with a bullet or number; toggling the same type removes it.
  const LIST_RE = /^\s*(?:•\s|\d+\.\s)/;
  const isListType = (o, type) => {
    const re = type === 'bullet' ? /^\s*•\s/ : /^\s*\d+\.\s/;
    const lines = String(o.text || '').split('\n').filter((l) => l.trim() !== '');
    return lines.length > 0 && lines.every((l) => re.test(l));
  };
  function applyList(type) {
    const objs = activeTexts(); if (!objs.length) return;
    objs.forEach((o) => {
      const lines = String(o.text || '').split('\n');
      const bare = lines.map((l) => l.replace(LIST_RE, ''));
      let next;
      if (isListType(o, type)) next = bare; // toggle off
      else if (type === 'bullet') next = bare.map((l) => (l.trim() === '' ? l : '• ' + l));
      else { let n = 0; next = bare.map((l) => (l.trim() === '' ? l : (++n) + '. ' + l)); }
      o.set('text', next.join('\n'));
    });
    canvas.requestRenderAll(); snapshot(); updatePopover();
  }
  $('#bulletBtn').addEventListener('click', () => applyList('bullet'));
  $('#numberBtn').addEventListener('click', () => applyList('number'));

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
  $('#forwardBtn').addEventListener('click', () => eachActive((o) => o.bringForward()));
  $('#backwardBtn').addEventListener('click', () => eachActive((o) => o.sendBackwards()));

  // ---- image upload (client downscale -> upload.php -> add) -------------------
  $('#addImage').addEventListener('click', () => { exitConnect(); clearPending(); setActiveTool('select'); $('#fileInput').click(); });
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
  function addImageFromUrl(url) {
    fabric.Image.fromURL(url, (img) => {
      const c = sceneCenter(), max = 600 / canvas.getZoom();
      const s = Math.min(1, max / Math.max(img.width, img.height));
      img.set({ originX: 'center', originY: 'center', left: c.left, top: c.top, scaleX: s, scaleY: s });
      setDrawMode(false);
      canvas.add(img); canvas.setActiveObject(img); canvas.requestRenderAll();
    }, { crossOrigin: 'anonymous' });
  }

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
    if (mod && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomBy(1.2); return; }
    if (mod && e.key === '-') { e.preventDefault(); zoomBy(1 / 1.2); return; }
    if (mod && e.key === '0') { e.preventDefault(); setZoom(1); return; }
    if (e.key === 'Escape') { exitConnect(); clearPending(); setActiveTool(canvas.isDrawingMode ? 'draw' : 'select'); canvas.discardActiveObject(); canvas.requestRenderAll(); return; }
    if (isTyping()) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); }
    else if (e.key === 'v' || e.key === 'V') { exitConnect(); clearPending(); setDrawMode(false); setActiveTool('select'); }
    else if (e.key === 'd' || e.key === 'D') { exitConnect(); clearPending(); setDrawMode(true); setActiveTool('draw'); }
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
  buildFonts();
  updateZoomLabel(); updateHistButtons(); setActiveTool('select');
  load();
})();
