/* jumpnow. — animated favicon
 * Renders the # + arrow mark on a 32×32 canvas and pushes it to the
 * <link rel="icon"> per frame. Loops the "Stamp in" scene.
 *
 * Coord system: native 256×256 (matches the source mark), scaled down to 32.
 */
(function () {
  if (typeof document === 'undefined') return;

  var SIZE = 32;            // favicon px size
  var NATIVE = 256;         // mark coord space
  var SCALE = SIZE / NATIVE;
  var RED = '#FF001C';
  var LOOP = 3.0;           // seconds — "stamp in" loop
  var SPEED = 0.75;         // playback speed (matches standalone preview)

  // ── Canvas + favicon link ─────────────────────────────────────────────────
  var canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  var ctx = canvas.getContext('2d');

  // Find or create a single favicon link we control.
  var link = document.querySelector("link[rel~='icon'][data-jn-anim]");
  if (!link) {
    // Remove existing png/ico icons so the browser uses ours instead.
    var existing = document.querySelectorAll("link[rel~='icon'], link[rel='shortcut icon']");
    for (var i = 0; i < existing.length; i++) {
      // Keep apple-touch-icon and mask-icon untouched.
      var rel = (existing[i].getAttribute('rel') || '').toLowerCase();
      if (rel.indexOf('apple') !== -1 || rel.indexOf('mask') !== -1) continue;
      existing[i].parentNode.removeChild(existing[i]);
    }
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.setAttribute('data-jn-anim', '1');
    document.head.appendChild(link);
  }

  // ── Easing helpers ────────────────────────────────────────────────────────
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  var Easing = {
    linear: function (t) { return t; },
    easeOutQuad: function (t) { return 1 - (1 - t) * (1 - t); },
    easeInQuad: function (t) { return t * t; },
    easeInOutQuad: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    easeOutBack: function (t) {
      var c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
  };

  // Piecewise linear interpolation over breakpoints, with optional easing per segment.
  function interpolate(stops, values, easings) {
    return function (t) {
      if (t <= stops[0]) return values[0];
      for (var i = 1; i < stops.length; i++) {
        if (t <= stops[i]) {
          var t0 = stops[i - 1], t1 = stops[i];
          var v0 = values[i - 1], v1 = values[i];
          var local = (t - t0) / (t1 - t0);
          var ease = Easing.linear;
          if (Array.isArray(easings)) ease = easings[i - 1] || Easing.linear;
          else if (easings) ease = easings;
          return v0 + (v1 - v0) * ease(local);
        }
      }
      return values[values.length - 1];
    };
  }

  // ── Mark geometry (in 256×256 space) ─────────────────────────────────────
  // Helper: draw a polygon path from a list of [x,y] points.
  function poly(points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (var i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  var STROKES = {
    leftV:  [[75, 48], [119, 48], [80, 232], [37, 232]],
    rightV: [[171, 48], [215, 48], [177, 232], [133, 232]],
    topH:   [[35, 64], [248, 64], [244, 104], [26, 104]],
    botH:   [[15, 160], [229, 160], [220, 200], [6, 200]],
    arrow:  [[103, 8], [130, 44], [67, 44]]
  };

  // ── "Stamp in" scene ─────────────────────────────────────────────────────
  function strokeState(tt, start) {
    var dur = 0.35;
    var local = clamp((tt - start) / dur, 0, 1);
    var eased = Easing.easeOutBack(local);
    return {
      opacity: clamp(local * 2, 0, 1),
      offset: (1 - eased) * 30
    };
  }

  function drawStampIn(time) {
    var tt = time % LOOP;

    var sLeftV  = strokeState(tt, 0.05);
    var sRightV = strokeState(tt, 0.13);
    var sTopH   = strokeState(tt, 0.21);
    var sBotH   = strokeState(tt, 0.29);

    var arrowEnterStart = 0.55;
    var arrowEnterEnd = 0.95;
    var fadeStart = LOOP - 0.4;

    var arrowOpacity = tt < arrowEnterStart ? 0
      : tt > fadeStart ? interpolate([fadeStart, LOOP], [1, 0])(tt)
      : 1;
    var arrowY = interpolate(
      [arrowEnterStart, arrowEnterStart + 0.25, arrowEnterEnd, LOOP],
      [80, -16, 0, 0],
      [Easing.easeOutQuad, Easing.easeInOutQuad, Easing.linear]
    )(tt);
    var bodyOpacity = tt > fadeStart ? interpolate([fadeStart, LOOP], [1, 0])(tt) : 1;

    // Clear at SIZE resolution
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Switch to native coords
    ctx.save();
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = RED;

    // Body strokes
    function paintStroke(pts, st, parentAlpha) {
      ctx.save();
      ctx.globalAlpha = parentAlpha * st.opacity;
      ctx.translate(0, -st.offset);
      poly(pts);
      ctx.restore();
    }
    paintStroke(STROKES.leftV,  sLeftV,  bodyOpacity);
    paintStroke(STROKES.rightV, sRightV, bodyOpacity);
    paintStroke(STROKES.topH,   sTopH,   bodyOpacity);
    paintStroke(STROKES.botH,   sBotH,   bodyOpacity);

    // Arrow
    if (arrowOpacity > 0.001) {
      ctx.save();
      ctx.globalAlpha = arrowOpacity;
      ctx.translate(0, arrowY);
      poly(STROKES.arrow);
      ctx.restore();
    }

    ctx.restore();
  }

  // ── Loop ─────────────────────────────────────────────────────────────────
  var startTs = null;
  var lastUpdate = 0;
  var rafId = null;

  function frame(ts) {
    if (startTs == null) startTs = ts;
    var time = ((ts - startTs) / 1000) * SPEED;
    drawStampIn(time);

    // Throttle favicon updates to ~12fps — browsers throttle data-URL swaps
    // anyway and excessive churn shows up in dev tools.
    if (ts - lastUpdate > 80) {
      try { link.href = canvas.toDataURL('image/png'); } catch (e) { /* ignore */ }
      lastUpdate = ts;
    }
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (rafId != null) return;
    startTs = null;
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Pause when tab is hidden — saves CPU and the favicon won't be visible
  // while throttled anyway.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
