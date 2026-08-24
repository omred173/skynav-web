(function () {
  "use strict";
  var C = window.SKYNAV;
  var EM = "\u2014";

  var state = {
    stream: null,
    imuReady: false,
    beta: null,
    gamma: null,
    gps: null,
    shots: [],
  };

  function $(id) { return document.getElementById(id); }
  function show(id) {
    document.querySelectorAll(".screen").forEach(function (el) {
      el.classList.toggle("active", el.id === id);
    });
  }
  function fmt(n, d) {
    if (n == null || !isFinite(n)) return EM;
    return Number(n).toFixed(d == null ? 2 : d);
  }
  function fmtLat(lat) {
    if (lat == null || !isFinite(lat)) return EM;
    return Math.abs(lat).toFixed(5) + "° " + (lat >= 0 ? "צפון" : "דרום");
  }
  function fmtLon(lon) {
    if (lon == null || !isFinite(lon)) return EM;
    return Math.abs(lon).toFixed(5) + "° " + (lon >= 0 ? "מזרח" : "מערב");
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
          });
        },
        function () { resolve(null); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    });
  }

  function requestMotion() {
    return new Promise(function (resolve) {
      function onOrient(ev) {
        if (ev.beta == null) return;
        state.beta = ev.beta;
        state.gamma = ev.gamma;
        state.imuReady = true;
      }
      window.addEventListener("deviceorientation", onOrient, true);
      window.addEventListener("deviceorientationabsolute", onOrient, true);
      if (typeof DeviceMotionEvent !== "undefined" &&
          typeof DeviceMotionEvent.requestPermission === "function") {
        DeviceMotionEvent.requestPermission().catch(function () {});
      }
      if (typeof DeviceOrientationEvent !== "undefined" &&
          typeof DeviceOrientationEvent.requestPermission === "function") {
        DeviceOrientationEvent.requestPermission()
          .then(function (r) { resolve(r === "granted"); })
          .catch(function () { resolve(false); });
      } else {
        setTimeout(function () { resolve(state.imuReady); }, 500);
      }
    });
  }

  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.resolve(false);
    }
    var tries = [
      { video: { facingMode: { exact: "environment" } }, audio: false },
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
        if (i + 1 < tries.length) return attempt(i + 1);
        return false;
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

  function detectSun() {
    var video = $("video");
    var work = $("work");
    if (!video || !video.videoWidth) return null;
    var w = work.width, h = work.height;
    var ctx = work.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);
    var data = ctx.getImageData(0, 0, w, h).data;
    var n = 0, sx = 0, sy = 0;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var r = data[i], g = data[i + 1], b = data[i + 2];
        var yv = 0.299 * r + 0.587 * g + 0.114 * b;
        if (yv >= 235 && r > 190 && g > 150) {
          n++; sx += x; sy += y;
        }
      }
    }
    if (n < 3 || n > w * h * 0.15) return null;
    return { nx: (sx / n) / w, ny: (sy / n) / h };
  }

  function altitudeFromImu(blob) {
    if (!state.imuReady || state.beta == null) return null;
    var hs = 90 - Math.abs(state.beta);
    if (blob && blob.ny != null) hs += (0.5 - blob.ny) * 54;
    if (hs < 0 || hs > 90) return null;
    return hs;
  }

  function sunAt(gps, utc) {
    var sun = C.sunEquatorial(utc);
    if (!gps) {
      return { sun: sun, hc: null, zn: null };
    }
    var lha = C.lha_deg(sun.gha_deg, gps.lon);
    var hc = C.computed_altitude(gps.lat, sun.dec_deg, lha);
    var zn = C.azimuth_zn(gps.lat, sun.dec_deg, lha, hc);
    return { sun: sun, hc: hc, zn: zn };
  }

  function renderResult(rec) {
    var html = "";
    function row(k, v) {
      html += '<div class="row"><span class="k">' + k + '</span><span class="v">' + v + "</span></div>";
    }
    if (rec.gps) {
      row("אתה כאן", fmtLat(rec.gps.lat) + "<br>" + fmtLon(rec.gps.lon));
      row("דיוק GPS", rec.gps.acc != null ? Math.round(rec.gps.acc) + " מ׳" : EM);
    } else {
      row("מיקום GPS", "לא אושר — אפשר בלי, אבל המיקום לא יוצג");
    }
    if (rec.hc != null) {
      if (rec.hc > 0) {
        row("השמש עכשיו", fmt(rec.hc, 1) + "° מעל האופק");
        row("כיוון השמש", fmt(rec.zn, 0) + "°");
      } else {
        row("השמש עכשיו", "מתחת לאופק (" + fmt(rec.hc, 1) + "°)");
        row("כיוון", fmt(rec.zn, 0) + "°");
      }
    }
    if (rec.measured != null) {
      row("הטלפון מדד", fmt(rec.measured, 1) + "°");
      if (rec.hc != null) {
        var d = rec.measured - rec.hc;
        row("הפרש מול החישוב", (d >= 0 ? "+" : "") + fmt(d, 1) + "°");
      }
    } else {
      row("מדידת טלפון", rec.imuNote || "אין חיישן תנועה — נשארים על GPS");
    }
    row("זמן", rec.utc.toISOString().replace("T", " ").slice(0, 19) + " UTC");
    $("resultCard").innerHTML = html;
    show("result");
  }

  function finish(measured, imuNote) {
    stopCamera();
    var utc = new Date();
    var pack = sunAt(state.gps, utc);
    renderResult({
      gps: state.gps,
      hc: pack.hc,
      zn: pack.zn,
      measured: measured,
      imuNote: imuNote,
      utc: utc,
    });
  }

  function loopOverlay() {
    var ov = $("overlay");
    var video = $("video");
    function tick() {
      if (!state.stream) return;
      if (video.videoWidth && ov) {
        ov.width = ov.clientWidth * (window.devicePixelRatio || 1);
        ov.height = ov.clientHeight * (window.devicePixelRatio || 1);
        var octx = ov.getContext("2d");
        octx.clearRect(0, 0, ov.width, ov.height);
        var blob = detectSun();
        var ret = $("reticle");
        if (blob) {
          octx.strokeStyle = "#3dcc8a";
          octx.lineWidth = 5;
          octx.beginPath();
          octx.arc(blob.nx * ov.width, blob.ny * ov.height, 36, 0, Math.PI * 2);
          octx.stroke();
          if (ret) ret.classList.add("ok");
          $("aimStatus").textContent = "השמש בפריים — לחץ צלם";
        } else {
          if (ret) ret.classList.remove("ok");
          $("aimStatus").textContent = state.imuReady
            ? "כוון את העיגול לשמש"
            : "כוון לשמש (בלי חיישן תנועה עדיין אפשר לצלם או לדלג)";
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  $("btnGo").addEventListener("click", function () {
    $("homeStatus").textContent = "";
    show("aim");
    $("aimStatus").textContent = "פותח מצלמה… אשר אם קופץ חלון";
    loopOverlay();
    requestMotion();
    getGPS().then(function (g) { state.gps = g; });
    startCamera().then(function (cam) {
      if (cam) {
        $("aimStatus").textContent = "המצלמה פתוחה. כוון לשמש או דלג.";
        return;
      }
      $("aimStatus").textContent = "אין מצלמה. אפשר לדלג למיקום GPS.";
    });
  });

  $("btnShoot").addEventListener("click", function () {
    var blob = detectSun();
    var hs = altitudeFromImu(blob);
    if (hs == null) {
      // still finish with GPS + computed sun; don't invent a number
      finish(null, state.imuReady ? "לא הצלחתי למדוד גובה — נשארים על GPS" : "אין חיישן תנועה — נשארים על GPS");
      return;
    }
    finish(hs, null);
  });

  $("btnSkipCam").addEventListener("click", function () {
    finish(null, "דילגת על המצלמה");
  });

  $("btnAgain").addEventListener("click", function () {
    stopCamera();
    state.shots = [];
    $("homeStatus").textContent = "";
    show("home");
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js?v=3").catch(function () {});
  }
})();
