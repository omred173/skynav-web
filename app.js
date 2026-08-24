(function () {
  "use strict";
  var C = window.SKYNAV;
  var EM = "\u2014";
  var LAST_KEY = "skynav.last";
  var HIST_KEY = "skynav.history";
  var THEME_KEY = "skynav.theme";

  var state = {
    path: null,
    horizonLocked: false,
    imuReady: false,
    beta: null,
    gamma: null,
    shots: [],
    stream: null,
    last: null,
    apSource: "none",
  };

  function $(id) { return document.getElementById(id); }
  function show(id) {
    document.querySelectorAll(".screen").forEach(function (el) {
      el.classList.toggle("active", el.id === id);
    });
  }
  function fmt(n, d) {
    if (n == null || !isFinite(n)) return EM;
    return Number(n).toFixed(d == null ? 3 : d);
  }
  function loadLast() {
    try { return JSON.parse(localStorage.getItem(LAST_KEY) || "null"); } catch (e) { return null; }
  }
  function loadHist() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || "[]"); } catch (e) { return []; }
  }
  function saveLast(r) {
    localStorage.setItem(LAST_KEY, JSON.stringify(r));
    var h = loadHist();
    h.push(r);
    localStorage.setItem(HIST_KEY, JSON.stringify(h));
    refreshLastBtn();
  }
  function refreshLastBtn() {
    var last = loadLast();
    var btn = $("btnLast");
    if (!last) {
      btn.disabled = true;
      btn.textContent = "Last result — " + EM;
      return;
    }
    btn.disabled = false;
    var t = last.utc ? last.utc.slice(11, 19) + "Z" : EM;
    var ho = last.ho_deg != null ? fmt(last.ho_deg, 3) + "°" : EM;
    btn.textContent = "Last result — " + t + " · Ho " + ho;
  }

  $("themeBtn").addEventListener("click", function () {
    var sun = document.documentElement.getAttribute("data-theme") === "sun";
    document.documentElement.setAttribute("data-theme", sun ? "" : "sun");
    localStorage.setItem(THEME_KEY, sun ? "dark" : "sun");
    $("themeBtn").textContent = sun ? "Sun mode" : "Dark mode";
  });
  if (localStorage.getItem(THEME_KEY) === "sun") {
    document.documentElement.setAttribute("data-theme", "sun");
    $("themeBtn").textContent = "Dark mode";
  }

  $("btnLast").addEventListener("click", function () {
    var last = loadLast();
    if (last) { state.last = last; renderResult(last); show("result"); }
  });
  $("btnCamera").addEventListener("click", function () { startCamera(); });
  $("btnHs").addEventListener("click", function () { show("sight-hs"); $("hsStatus").textContent = ""; });
  $("btnCamHome").addEventListener("click", function () { stopCamera(); show("home"); });
  $("btnHsHome").addEventListener("click", function () { show("home"); });
  $("btnDone").addEventListener("click", function () { stopCamera(); show("home"); refreshLastBtn(); });
  $("btnNewSame").addEventListener("click", function () {
    if (state.path === "sextant") show("sight-hs");
    else startCamera();
  });

  $("btnHsGo").addEventListener("click", function () {
    var deg = parseFloat($("hsDeg").value);
    var min = parseFloat($("hsMin").value);
    if (!isFinite(deg) || !isFinite(min) || min < 0 || min > 60) {
      $("hsStatus").textContent = "failed — minutes must be 0–60; Hs required";
      $("hsStatus").className = "status bad";
      return;
    }
    var hs = C.dms(deg, min, 0);
    finishSight({ path: "sextant", hs_deg: hs, utc: new Date().toISOString() });
  });

  function utcNow() { return new Date(); }

  function finishSight(partial) {
    var utc = new Date(partial.utc);
    var sun = C.sunEquatorial(utc);
    var he = parseFloat($("heM") ? $("heM").value : "3");
    if (!isFinite(he) || he < 0) he = 3;
    var ie = parseFloat($("ieMin") ? $("ieMin").value : "0") || 0;
    var off = $("ieOff") ? $("ieOff").checked : false;
    var limb = partial.path === "camera" ? "center" : "lower";
    var corr = C.correctAltitude(partial.hs_deg, he, ie, off, limb, sun.sd_arcmin, sun.hp_arcmin);
    var rec = {
      path: partial.path,
      utc: utc.toISOString(),
      hs_deg: corr.hs_deg,
      ho_deg: corr.ho_deg,
      dip_arcmin: corr.dip_arcmin,
      refraction_arcmin: corr.refraction_arcmin,
      sd_arcmin: corr.sd_arcmin,
      pa_arcmin: corr.pa_arcmin,
      gha_deg: sun.gha_deg,
      dec_deg: sun.dec_deg,
      shots: partial.shots || null,
      uncertainty: partial.path === "camera" ? "phone ~0.3–1°" : "sextant arc minutes",
      ap_lat: null,
      ap_lon: null,
      ap_source: "none",
      intercept_nm: null,
      toward: null,
      zn_deg: null,
      running_lat: null,
      running_lon: null,
    };
    applyAp(rec);
    state.last = rec;
    state.path = rec.path;
    saveLast(rec);
    stopCamera();
    renderResult(rec);
    show("result");
  }

  function applyAp(rec) {
    var lat = parseFloat($("apLat").value);
    var lon = parseFloat($("apLon").value);
    if (isFinite(lat) && isFinite(lon)) {
      rec.ap_lat = lat;
      rec.ap_lon = lon;
      if (rec.ap_source !== "gps") rec.ap_source = "typed";
      var ic = C.intercept(rec.ho_deg, lat, lon, rec.gha_deg, rec.dec_deg);
      rec.intercept_nm = ic.intercept_nm;
      rec.toward = ic.toward;
      rec.zn_deg = ic.zn_deg;
      rec.hc_deg = ic.hc_deg;
      var hist = loadHist().filter(function (x) { return x.ho_deg != null && x !== rec; });
      var prev = hist.length ? hist[hist.length - 1] : null;
      if (prev && prev.ap_lat != null && prev.zn_deg != null && rec.zn_deg != null) {
        try {
          var course = parseFloat($("crs").value) || 0;
          var dist = parseFloat($("dist").value) || 0;
          var a = {
            lat_deg: prev.ap_lat,
            lon_east_deg: prev.ap_lon,
            zn_deg: prev.zn_deg,
            intercept_nm: prev.intercept_nm,
            toward: prev.toward,
          };
          var b = {
            lat_deg: rec.ap_lat,
            lon_east_deg: rec.ap_lon,
            zn_deg: rec.zn_deg,
            intercept_nm: rec.intercept_nm,
            toward: rec.toward,
          };
          var fx = C.runningFix(a, b, course, dist);
          rec.running_lat = fx[0];
          rec.running_lon = fx[1];
        } catch (e) {
          rec.running_lat = null;
          rec.running_lon = null;
        }
      }
    } else {
      rec.ap_source = rec.ap_source === "gps" ? "none" : rec.ap_source;
      rec.intercept_nm = null;
      rec.zn_deg = null;
      rec.toward = null;
      rec.running_lat = null;
      rec.running_lon = null;
    }
  }

  function renderResult(rec) {
    $("pathStamp").textContent = rec.path === "camera" ? "Camera+IMU" : "Sextant";
    var inter = rec.intercept_nm == null ? EM : (fmt(rec.intercept_nm, 2) + " nmi " + (rec.toward ? "Toward" : "Away"));
    var zn = rec.zn_deg == null ? EM : fmt(rec.zn_deg, 1) + "°";
    var rf = rec.running_lat == null ? EM : fmt(rec.running_lat, 4) + ", " + fmt(rec.running_lon, 4);
    var aps = rec.ap_source || "none";
    var rows = [
      ["UTC", rec.utc || EM],
      ["Hs", fmt(rec.hs_deg, 4) + "°"],
      ["Ho", fmt(rec.ho_deg, 4) + "°"],
      ["Uncertainty", rec.uncertainty],
      ["Intercept + Zn", rec.intercept_nm == null ? EM : inter + " · Zn " + zn],
      ["Running fix", rf],
      ["AP source", aps === "gps" ? "GPS (optional)" : aps === "typed" ? "typed" : "none"],
      ["GHA / Dec", fmt(rec.gha_deg, 3) + "° / " + fmt(rec.dec_deg, 3) + "°"],
    ];
    $("resultRows").innerHTML = rows.map(function (r) {
      return '<div class="row"><span class="k">' + r[0] + '</span><span class="v">' + r[1] + "</span></div>";
    }).join("");
    if (rec.ap_lat != null) { $("apLat").value = rec.ap_lat; $("apLon").value = rec.ap_lon; }
  }

  $("btnGps").addEventListener("click", function () {
    if (!navigator.geolocation) {
      $("apStatus").textContent = "GPS not available";
      $("apStatus").className = "status bad";
      return;
    }
    $("apStatus").textContent = "Requesting GPS (AP only)…";
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        $("apLat").value = pos.coords.latitude.toFixed(5);
        $("apLon").value = pos.coords.longitude.toFixed(5);
        $("apStatus").textContent = "GPS (optional) stamped " + new Date().toISOString();
        $("apStatus").className = "status ok";
        if (state.last) {
          state.last.ap_source = "gps";
          applyAp(state.last);
          saveLast(state.last);
          renderResult(state.last);
        }
      },
      function () {
        $("apStatus").textContent = "GPS denied — type AP or leave " + EM;
        $("apStatus").className = "status bad";
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });

  $("btnRecompute").addEventListener("click", function () {
    if (!state.last) return;
    if (isFinite(parseFloat($("apLat").value))) state.last.ap_source = "typed";
    applyAp(state.last);
    saveLast(state.last);
    renderResult(state.last);
  });

  /* ---------- camera + IMU ---------- */
  function setCam(msg, kind) {
    $("camStatus").textContent = msg;
    $("camStatus").className = "status" + (kind ? " " + kind : "");
  }

  function stopCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach(function (t) { t.stop(); });
      state.stream = null;
    }
    state.horizonLocked = false;
    state.shots = [];
  }

  function requestMotion() {
    return new Promise(function (resolve) {
      function onOrient(ev) {
        if (ev.beta != null && ev.gamma != null) {
          state.beta = ev.beta;
          state.gamma = ev.gamma;
          state.imuReady = true;
        }
      }
      window.addEventListener("deviceorientation", onOrient, true);
      if (typeof DeviceOrientationEvent !== "undefined" &&
          typeof DeviceOrientationEvent.requestPermission === "function") {
        DeviceOrientationEvent.requestPermission()
          .then(function (r) {
            state.imuReady = r === "granted";
            resolve(state.imuReady);
          })
          .catch(function () { resolve(false); });
      } else {
        // Desktop / Android: wait briefly for an event
        setTimeout(function () { resolve(state.imuReady); }, 400);
      }
    });
  }

  function startCamera() {
    state.path = "camera";
    state.horizonLocked = false;
    state.shots = [];
    state.imuReady = false;
    $("btnHorizon").disabled = true;
    $("btnShot").disabled = true;
    $("btnFinishCam").disabled = true;
    show("sight-cam");
    setCam("Requesting camera and motion…");
    var constraints = { video: { facingMode: { ideal: "environment" } }, audio: false };
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then(function (stream) {
        state.stream = stream;
        $("video").srcObject = stream;
        return requestMotion();
      })
      .then(function (imu) {
        if (!imu && !state.imuReady) {
          setCam("IMU not ready — no number. Enable motion, hold the phone, retry.", "bad");
          $("btnHorizon").disabled = true;
          $("btnShot").disabled = true;
          return;
        }
        $("btnHorizon").disabled = false;
        setCam("Align the horizon, then lock. IMU ready.");
        loopDetect();
      })
      .catch(function (err) {
        setCam("failed — camera: " + (err && err.message ? err.message : "denied"), "bad");
      });
  }

  $("btnHorizon").addEventListener("click", function () {
    if (!state.imuReady) {
      setCam("IMU not ready — no number.", "bad");
      return;
    }
    state.horizonLocked = true;
    $("btnShot").disabled = false;
    setCam("Horizon locked. Point at the Sun and take several shots.", "ok");
  });

  $("btnShot").addEventListener("click", function () {
    if (!state.horizonLocked) {
      setCam("failed — no horizon lock", "bad");
      return;
    }
    if (!state.imuReady || state.beta == null) {
      setCam("IMU not ready — no number.", "bad");
      return;
    }
    var blob = detectSun();
    if (!blob) {
      setCam("failed — no Sun in frame (bright compact blob required)", "bad");
      return;
    }
    var hs = altitudeFromImu(state.beta, state.gamma, blob);
    if (hs == null || !isFinite(hs)) {
      setCam("failed — IMU not ready — no number", "bad");
      return;
    }
    state.shots.push(hs);
    $("btnFinishCam").disabled = state.shots.length < 1;
    setCam("Shots OK: " + state.shots.length + " · last Hs " + fmt(hs, 3) + "°", "ok");
  });

  $("btnFinishCam").addEventListener("click", function () {
    if (!state.shots.length) {
      setCam("failed — no valid shots", "bad");
      return;
    }
    var hs = C.trimmedMean(state.shots, 1);
    finishSight({ path: "camera", hs_deg: hs, utc: new Date().toISOString(), shots: state.shots.slice() });
  });

  function altitudeFromImu(beta, gamma, blob) {
    // iOS: beta = front-back tilt (−180..180), 90 ≈ camera pointing at horizon in landscape-ish hold.
    // Phone Hs ≈ |beta| when holding as a sighting tube (camera along long axis, screen up).
    // Compact blob offset in the frame adjusts a few degrees — still honesty band 0.3–1°.
    if (beta == null) return null;
    var pitch = Math.abs(beta);
    // When phone is aimed upward, beta approaches 0 (face-up) or 90 (edge). Use complementary gamma.
    var tilt = Math.sqrt(beta * beta + (gamma || 0) * (gamma || 0));
    var fromHorizon = Math.max(0, Math.min(90, 90 - Math.abs(Math.abs(beta) - 90)));
    // Prefer elevation of the optical axis: 90° − |beta| when beta is pitch from vertical.
    var hs = 90 - Math.abs(beta);
    if (hs < 0) hs = 0;
    if (hs > 90) hs = 90;
    // Small correction from blob vs frame center (vertical FOV ~54° typical).
    if (blob && blob.ny != null) {
      var vfov = 54;
      hs += (0.5 - blob.ny) * vfov;
    }
    if (hs < 0 || hs > 90) return null;
    return hs;
  }

  function detectSun() {
    var video = $("video");
    var work = $("work");
    if (!video.videoWidth) return null;
    var w = work.width;
    var h = work.height;
    var ctx = work.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);
    var img = ctx.getImageData(0, 0, w, h);
    var data = img.data;
    var best = 0;
    var bx = 0, by = 0, n = 0, sx = 0, sy = 0;
    var thresh = 240;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        var r = data[i], g = data[i + 1], b = data[i + 2];
        var yv = 0.299 * r + 0.587 * g + 0.114 * b;
        if (yv >= thresh && r > 200 && g > 160) {
          n++;
          sx += x;
          sy += y;
          if (yv > best) { best = yv; bx = x; by = y; }
        }
      }
    }
    var area = w * h;
    if (n < 4 || n > area * 0.12) return null; // not compact
    var cx = sx / n, cy = sy / n;
    return { x: cx, y: cy, nx: cx / w, ny: cy / h, n: n };
  }

  function loopDetect() {
    var ov = $("overlay");
    var video = $("video");
    function tick() {
      if (!state.stream) return;
      if (video.videoWidth) {
        ov.width = ov.clientWidth * (window.devicePixelRatio || 1);
        ov.height = ov.clientHeight * (window.devicePixelRatio || 1);
        var octx = ov.getContext("2d");
        octx.clearRect(0, 0, ov.width, ov.height);
        var blob = detectSun();
        if (blob) {
          octx.strokeStyle = "#e88c20";
          octx.lineWidth = 4;
          octx.beginPath();
          octx.arc(blob.nx * ov.width, blob.ny * ov.height, 28, 0, Math.PI * 2);
          octx.stroke();
        }
        if (!state.imuReady) {
          /* stay silent number-wise */
        }
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
  refreshLastBtn();
})();
