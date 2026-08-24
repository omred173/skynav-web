(function () {
  "use strict";
  var C = window.SKYNAV;
  var EM = "\u2014";
  var FALLBACK = { lat: 31.2518, lon: 34.7913, acc: null, source: "beersheva" };

  var state = {
    stream: null,
    imuReady: false,
    beta: null,
    gamma: null,
    heading: null,
    gps: null,
    stack: [],
  };

  function $(id) { return document.getElementById(id); }
  function show(id) {
    document.querySelectorAll(".screen").forEach(function (el) {
      el.classList.toggle("active", el.id === id);
    });
  }
  function fmt(n, d) {
    if (n == null || !isFinite(n)) return EM;
    return Number(n).toFixed(d == null ? 1 : d);
  }
  function place() {
    return state.gps || FALLBACK;
  }
  function fmtLat(lat) {
    return Math.abs(lat).toFixed(4) + "° " + (lat >= 0 ? "צפון" : "דרום");
  }
  function fmtLon(lon) {
    return Math.abs(lon).toFixed(4) + "° " + (lon >= 0 ? "מזרח" : "מערב");
  }

  function getGPS() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        function (pos) {
          resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            acc: pos.coords.accuracy,
            source: "gps",
          });
        },
        function () { resolve(null); },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
      );
    });
  }

  function requestMotion() {
    function onOrient(ev) {
      if (ev.beta != null) {
        state.beta = ev.beta;
        state.gamma = ev.gamma;
        state.imuReady = true;
      }
      if (typeof ev.webkitCompassHeading === "number") {
        state.heading = ev.webkitCompassHeading;
      } else if (ev.alpha != null) {
        state.heading = (360 - ev.alpha) % 360;
      }
    }
    window.addEventListener("deviceorientation", onOrient, true);
    window.addEventListener("deviceorientationabsolute", onOrient, true);
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      DeviceOrientationEvent.requestPermission().catch(function () {});
    }
    if (typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function") {
      DeviceMotionEvent.requestPermission().catch(function () {});
    }
  }

  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.resolve(false);
    }
    var tries = [
      { video: { facingMode: { exact: "environment" }, width: { ideal: 1920 } }, audio: false },
      { video: { facingMode: { ideal: "environment" } }, audio: false },
      { video: true, audio: false }
    ];
    function attempt(i) {
      return navigator.mediaDevices.getUserMedia(tries[i]).then(function (stream) {
        state.stream = stream;
        var v = $("video");
        v.srcObject = stream;
        v.muted = true;
        v.setAttribute("playsinline", "");
        v.setAttribute("webkit-playsinline", "");
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
        return true;
      }).catch(function () {
        return i + 1 < tries.length ? attempt(i + 1) : false;
      });
    }
    return attempt(0);
  }

  function stopCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach(function (t) { t.stop(); });
      state.stream = null;
    }
  }

  function lookAlt() {
    if (state.beta == null) return 35;
    var hs = 90 - Math.abs(state.beta);
    if (hs < 0) hs = 0;
    if (hs > 90) hs = 90;
    return hs;
  }

  function lookAz() {
    if (state.heading != null && isFinite(state.heading)) return state.heading;
    return 180;
  }

  function grabFrame() {
    var video = $("video");
    var work = $("work");
    if (!video.videoWidth) return null;
    var ctx = work.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, work.width, work.height);
    return ctx.getImageData(0, 0, work.width, work.height);
  }

  function maxStack(frames) {
    if (!frames.length) return null;
    var w = frames[0].width, h = frames[0].height;
    var out = new ImageData(w, h);
    var n = frames.length;
    for (var i = 0; i < out.data.length; i++) {
      var m = 0;
      for (var f = 0; f < n; f++) {
        if (frames[f].data[i] > m) m = frames[f].data[i];
      }
      out.data[i] = m;
    }
    return out;
  }

  function detectMoon(img) {
    if (!img) return null;
    var w = img.width, h = img.height, data = img.data;
    var n = 0, sx = 0, sy = 0;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var yv = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (yv >= 200) { n++; sx += x; sy += y; }
      }
    }
    var frac = n / (w * h);
    if (n < 20 || frac > 0.25) return null;
    return { nx: (sx / n) / w, ny: (sy / n) / h, n: n, frac: frac };
  }

  function detectStars(img) {
    if (!img) return [];
    var w = img.width, h = img.height, data = img.data;
    var hits = [];
    for (var y = 2; y < h - 2; y += 2) {
      for (var x = 2; x < w - 2; x += 2) {
        var i = (y * w + x) * 4;
        var yv = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (yv < 210) continue;
        hits.push({ nx: x / w, ny: y / h, yv: yv });
      }
    }
    hits.sort(function (a, b) { return b.yv - a.yv; });
    return hits.slice(0, 12);
  }

  function project(body, la, lz) {
    var daz = ((body.az - lz + 540) % 360) - 180;
    var dalt = la - body.alt;
    var hfov = 52, vfov = 68;
    return { x: 0.5 + daz / hfov, y: 0.5 + dalt / vfov, body: body };
  }

  function explain(sky, moonBlob, starHits) {
    var up = sky.bodies.filter(function (b) { return b.alt > 0; });
    var lines = [];
    if (sky.night) {
      lines.push("לילה. השמש מתחת לאופק.");
    } else {
      lines.push("יום. מחפשים שמש.");
    }
    var moon = sky.bodies.filter(function (b) { return b.kind === "moon"; })[0];
    if (moon && moon.alt > 0) {
      lines.push("ירח חזק: " + fmt(moon.alt) + "° מעל האופק, כיוון " + fmt(moon.az, 0) + "°.");
      if (moonBlob) lines.push("המצלמה רואה כתם בהיר — כנראה היריח.");
      else lines.push("כוון את העיגול לירח. כמה צילומים עוזרים.");
    }
    var stars = up.filter(function (b) { return b.kind === "star"; }).slice(0, 4);
    if (stars.length) {
      lines.push("כוכבים למעלה: " + stars.map(function (s) { return s.name; }).join(", ") + ".");
    }
    if (starHits.length) lines.push("נקודות בהירות בפריים: " + starHits.length + ".");
    return lines.join(" ");
  }

  function loopOverlay() {
    var ov = $("overlay");
    var video = $("video");
    function tick() {
      if (!state.stream && !video.srcObject) {
        requestAnimationFrame(tick);
        return;
      }
      if (video.videoWidth && ov) {
        ov.width = ov.clientWidth * (window.devicePixelRatio || 1);
        ov.height = ov.clientHeight * (window.devicePixelRatio || 1);
        var octx = ov.getContext("2d");
        octx.clearRect(0, 0, ov.width, ov.height);
        var loc = place();
        var sky = C.skyBodies(new Date(), loc.lat, loc.lon);
        var la = lookAlt();
        var lz = lookAz();
        sky.bodies.forEach(function (b) {
          if (b.alt < 0) return;
          var p = project(b, la, lz);
          if (p.x < -0.05 || p.x > 1.05 || p.y < -0.05 || p.y > 1.05) return;
          var x = p.x * ov.width, y = p.y * ov.height;
          octx.beginPath();
          octx.strokeStyle = b.kind === "moon" ? "#f4e27a" : b.kind === "sun" ? "#e88c20" : "#9ad0ff";
          octx.lineWidth = b.kind === "moon" ? 5 : 2;
          octx.arc(x, y, b.kind === "moon" ? 28 : 8, 0, Math.PI * 2);
          octx.stroke();
          octx.fillStyle = "#fff";
          octx.font = "16px -apple-system, sans-serif";
          octx.fillText(b.name, x + 12, y - 8);
        });
        var frame = grabFrame();
        var moonBlob = detectMoon(frame);
        var stars = detectStars(frame);
        $("aimStatus").textContent = explain(sky, moonBlob, stars);
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function takeSeries() {
    $("aimStatus").textContent = "מצלם סדרה…";
    state.stack = [];
    var n = 0;
    function one() {
      var f = grabFrame();
      if (f) state.stack.push(f);
      n++;
      if (n < 8) {
        setTimeout(one, 180);
        return;
      }
      var stacked = maxStack(state.stack);
      var moonBlob = detectMoon(stacked);
      var stars = detectStars(stacked);
      var loc = place();
      var sky = C.skyBodies(new Date(), loc.lat, loc.lon);
      var moon = sky.bodies.filter(function (b) { return b.kind === "moon"; })[0];
      var measured = null;
      if (moonBlob && state.imuReady) {
        measured = lookAlt() + (0.5 - moonBlob.ny) * 68;
      }
      renderResult({
        loc: loc,
        sky: sky,
        moon: moon,
        moonBlob: moonBlob,
        stars: stars,
        frames: state.stack.length,
        measured: measured,
      });
    }
    one();
  }

  function renderResult(rec) {
    stopCamera();
    var html = "";
    function row(k, v) {
      html += '<div class="row"><span class="k">' + k + '</span><span class="v">' + v + "</span></div>";
    }
    var locNote = rec.loc.source === "gps" ? "GPS" : "באר שבע (ברירת מחדל עד שיש GPS)";
    row("מיקום להשוואה", locNote + "<br>" + fmtLat(rec.loc.lat) + "<br>" + fmtLon(rec.loc.lon));
    if (rec.loc.acc) row("דיוק GPS", Math.round(rec.loc.acc) + " מ׳");
    if (rec.sky.night) row("מצב", "לילה — ירח וכוכבים, לא שמש");
    if (rec.moon && rec.moon.alt > 0) {
      row("ירח מחושב", fmt(rec.moon.alt) + "° · כיוון " + fmt(rec.moon.az, 0) + "°");
    } else {
      row("ירח", "מתחת לאופק עכשיו");
    }
    if (rec.measured != null) {
      row("הטלפון מדד (ירח)", fmt(rec.measured) + "°");
      if (rec.moon) row("הפרש", fmt(rec.measured - rec.moon.alt) + "°");
    }
    row("תמונות בסדרה", String(rec.frames || 0));
    row("נקודות בהירות", rec.moonBlob ? "ירח + " + rec.stars.length + " כוכבים" : String(rec.stars.length) + " כוכבים");
    var names = rec.sky.bodies.filter(function (b) { return b.alt > 8 && b.kind === "star"; }).slice(0, 5).map(function (b) { return b.name; });
    if (names.length) row("למעלה עכשיו", names.join(" · "));
    $("resultCard").innerHTML = html;
    show("result");
  }

  $("btnGo").addEventListener("click", function () {
    show("aim");
    document.body.classList.add("night");
    $("aimStatus").textContent = "פותח מצלמה ללילה… אשר מצלמה אם קופץ";
    requestMotion();
    getGPS().then(function (g) { if (g) state.gps = g; });
    loopOverlay();
    startCamera().then(function (cam) {
      if (cam) $("aimStatus").textContent = "מצלמה פתוחה. כוון לירח. אחר כך «צלם סדרה».";
      else $("aimStatus").textContent = "אין מצלמה. אפשר עדיין לראות מה בשמיים לפי הזמן.";
    });
  });

  $("btnShoot").addEventListener("click", takeSeries);
  $("btnSkipCam").addEventListener("click", function () {
    var loc = place();
    var sky = C.skyBodies(new Date(), loc.lat, loc.lon);
    var moon = sky.bodies.filter(function (b) { return b.kind === "moon"; })[0];
    renderResult({ loc: loc, sky: sky, moon: moon, moonBlob: null, stars: [], frames: 0, measured: null });
  });
  $("btnAgain").addEventListener("click", function () {
    stopCamera();
    state.stack = [];
    show("home");
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js?v=4").catch(function () {});
  }
})();
