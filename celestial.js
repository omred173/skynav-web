/**
 * SKYNAV celestial reference engine (Sun, marine) — JS port of celestial.py
 * Meeus ch. 12 / 22 / 25; Nautical Almanac / Bowditch altitude corrections.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SKYNAV = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DEG2RAD = Math.PI / 180.0;
  var RAD2DEG = 180.0 / Math.PI;
  var ARCSEC_IN_DEG = 3600.0;

  function _norm360(deg) {
    var x = deg % 360.0;
    return x < 0 ? x + 360.0 : x;
  }

  function _norm180(deg) {
    var x = _norm360(deg);
    return x > 180.0 ? x - 360.0 : x;
  }

  function dms(deg, minutes, seconds) {
    minutes = minutes || 0.0;
    seconds = seconds || 0.0;
    var sign = deg < 0 || minutes < 0 || seconds < 0 ? -1.0 : 1.0;
    return sign * (Math.abs(deg) + Math.abs(minutes) / 60.0 + Math.abs(seconds) / 3600.0);
  }

  function deg_to_dms(deg) {
    var sign = deg < 0 ? -1 : 1;
    var a = Math.abs(deg);
    var d = Math.trunc(a);
    var m = (a - d) * 60.0;
    return [sign * d, m];
  }

  function _pyInt(x) {
    return x < 0 ? Math.ceil(x) : Math.floor(x);
  }

  function julian_day(utc) {
    var y, m, d, hour, minute, second, micro;
    if (utc instanceof Date) {
      y = utc.getUTCFullYear();
      m = utc.getUTCMonth() + 1;
      d = utc.getUTCDate();
      hour = utc.getUTCHours();
      minute = utc.getUTCMinutes();
      second = utc.getUTCSeconds();
      micro = utc.getUTCMilliseconds() * 1000;
    } else {
      y = utc.year;
      m = utc.month;
      d = utc.day;
      hour = utc.hour || 0;
      minute = utc.minute || 0;
      second = utc.second || 0;
      micro = utc.microsecond || 0;
    }
    var frac =
      (hour + minute / 60.0 + second / 3600.0 + micro / 3.6e9) / 24.0;
    if (m <= 2) {
      y -= 1;
      m += 12;
    }
    var a = _pyInt(y / 100);
    var b = 2 - a + _pyInt(a / 4);
    var jd0 =
      _pyInt(365.25 * (y + 4716)) + _pyInt(30.6001 * (m + 1)) + d + b - 1524.5;
    return jd0 + frac;
  }

  function julian_centuries(jd) {
    return (jd - 2451545.0) / 36525.0;
  }

  function _greenwich_apparent_sidereal(jd, t, omega_deg, l0_deg, eps_deg) {
    var d = jd - 2451545.0;
    var gmst =
      280.46061837 +
      360.98564736629 * d +
      0.000387933 * t * t -
      (t * t * t) / 38710000.0;
    var dpsi =
      -17.2 * Math.sin(omega_deg * DEG2RAD) -
      1.32 * Math.sin(2 * l0_deg * DEG2RAD);
    var eqeq = (dpsi * Math.cos(eps_deg * DEG2RAD)) / 3600.0;
    return _norm360(gmst + eqeq);
  }

  function sunEquatorial(utc) {
    var jd = julian_day(utc);
    var t = julian_centuries(jd);

    var l0 = _norm360(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
    var m = _norm360(357.52911 + 35999.05029 * t - 0.0001537 * t * t);
    var e = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;

    var mr = m * DEG2RAD;
    var c =
      (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(mr) +
      (0.019993 - 0.000101 * t) * Math.sin(2 * mr) +
      0.000289 * Math.sin(3 * mr);
    var true_lon = l0 + c;
    var true_anom = m + c;
    var r =
      (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(true_anom * DEG2RAD));

    var omega = _norm360(125.04 - 1934.136 * t);
    var orad = omega * DEG2RAD;
    var lam = true_lon - 0.00569 - 0.00478 * Math.sin(orad);

    var eps0 =
      23.0 +
      26.0 / 60.0 +
      21.448 / 3600.0 -
      (46.815 / 3600.0) * t -
      (0.00059 / 3600.0) * t * t +
      (0.001813 / 3600.0) * t * t * t;
    var eps = eps0 + 0.00256 * Math.cos(orad);

    var lam_r = lam * DEG2RAD;
    var eps_r = eps * DEG2RAD;
    var sin_dec = Math.sin(eps_r) * Math.sin(lam_r);
    var dec = Math.asin(sin_dec) * RAD2DEG;
    var ra = Math.atan2(Math.cos(eps_r) * Math.sin(lam_r), Math.cos(lam_r)) * RAD2DEG;
    ra = _norm360(ra);

    var gast = _greenwich_apparent_sidereal(jd, t, omega, l0, eps);
    var gha = _norm360(gast - ra);

    var sd_arcmin = 959.63 / r / 60.0;
    var hp_arcmin = 8.794 / r / 60.0;

  
  function moonEquatorial(utc) {
    var jd = julian_day(utc);
    var t = julian_centuries(jd);
    var Lp = _norm360(218.3164477 + 481267.88123421 * t);
    var D = _norm360(297.8501921 + 445267.1114034 * t);
    var M = _norm360(357.5291092 + 35999.0502909 * t);
    var Mp = _norm360(134.9633964 + 477198.8675055 * t);
    var F = _norm360(93.272095 + 483202.0175233 * t);
    var Dr = D * DEG2RAD, Mr = M * DEG2RAD, Mpr = Mp * DEG2RAD, Fr = F * DEG2RAD;
    var lon =
      Lp +
      6.289 * Math.sin(Mpr) +
      1.274 * Math.sin(2 * Dr - Mpr) +
      0.658 * Math.sin(2 * Dr) -
      0.186 * Math.sin(Mr) -
      0.214 * Math.sin(2 * Mpr) -
      0.114 * Math.sin(2 * Fr);
    var lat =
      5.128 * Math.sin(Fr) +
      0.281 * Math.sin(Mpr + Fr) +
      0.278 * Math.sin(Mpr - Fr) +
      0.173 * Math.sin(2 * Dr - Fr);
    var omega = _norm360(125.04 - 1934.136 * t);
    var l0 = _norm360(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
    var eps0 =
      23.0 + 26.0 / 60.0 + 21.448 / 3600.0 - (46.815 / 3600.0) * t;
    var eps = eps0 + 0.00256 * Math.cos(omega * DEG2RAD);
    var lon_r = lon * DEG2RAD;
    var lat_r = lat * DEG2RAD;
    var eps_r = eps * DEG2RAD;
    var dec = Math.asin(
      Math.sin(lat_r) * Math.cos(eps_r) +
        Math.cos(lat_r) * Math.sin(eps_r) * Math.sin(lon_r)
    ) * RAD2DEG;
    var ra = Math.atan2(
      Math.sin(lon_r) * Math.cos(eps_r) - Math.tan(lat_r) * Math.sin(eps_r),
      Math.cos(lon_r)
    ) * RAD2DEG;
    ra = _norm360(ra);
    var gast = _greenwich_apparent_sidereal(jd, t, omega, l0, eps);
    var gha = _norm360(gast - ra);
    return { gha_deg: gha, dec_deg: dec, ra_deg: ra, gast_deg: gast, name: "ירח" };
  }

  var STARS = [
    { name: "סיריוס", ra: 101.287, dec: -16.716, mag: -1.46 },
    { name: "קאנופוס", ra: 95.988, dec: -52.696, mag: -0.74 },
    { name: "ארקטורוס", ra: 213.915, dec: 19.182, mag: -0.05 },
    { name: "וגה", ra: 279.235, dec: 38.784, mag: 0.03 },
    { name: "קפלה", ra: 79.172, dec: 45.998, mag: 0.08 },
    { name: "ריגל", ra: 78.634, dec: -8.202, mag: 0.13 },
    { name: "פרוקיון", ra: 114.826, dec: 5.225, mag: 0.34 },
    { name: "בטלגז", ra: 88.793, dec: 7.407, mag: 0.5 },
    { name: "אלטאיר", ra: 297.696, dec: 8.868, mag: 0.76 },
    { name: "אלדברן", ra: 68.98, dec: 16.509, mag: 0.85 },
    { name: "אנטארס", ra: 247.352, dec: -26.432, mag: 0.96 },
    { name: "ספיקה", ra: 201.298, dec: -11.161, mag: 0.98 },
    { name: "פולוקס", ra: 116.329, dec: 28.026, mag: 1.14 },
    { name: "פומלאוט", ra: 344.413, dec: -29.622, mag: 1.16 },
    { name: "דנב", ra: 310.358, dec: 45.28, mag: 1.25 },
    { name: "רגולוס", ra: 152.093, dec: 11.967, mag: 1.35 },
    { name: "קסטור", ra: 113.65, dec: 31.888, mag: 1.58 },
    { name: "בלאטריקס", ra: 81.283, dec: 6.35, mag: 1.64 },
    { name: "אליות", ra: 193.507, dec: 55.96, mag: 1.77 },
    { name: "דובה", ra: 165.932, dec: 61.751, mag: 1.79 }
  ];

  function altaz(lat, lon, ra_deg, dec_deg, gast_deg) {
    var lst = _norm360(gast_deg + lon);
    var ha = _norm360(lst - ra_deg);
    var alt = computed_altitude(lat, dec_deg, ha);
    var az = azimuth_zn(lat, dec_deg, ha, alt);
    return { alt: alt, az: az, ha: ha };
  }

  function skyBodies(utc, lat, lon) {
    var sun = sunEquatorial(utc);
    var moon = moonEquatorial(utc);
    var out = [];
    var s = altaz(lat, lon, sun.ra_deg, sun.dec_deg, sun.gast_deg);
    out.push({ name: "שמש", kind: "sun", alt: s.alt, az: s.az, mag: -26 });
    var m = altaz(lat, lon, moon.ra_deg, moon.dec_deg, moon.gast_deg);
    out.push({ name: "ירח", kind: "moon", alt: m.alt, az: m.az, mag: -12 });
    for (var i = 0; i < STARS.length; i++) {
      var st = STARS[i];
      var a = altaz(lat, lon, st.ra, st.dec, sun.gast_deg);
      if (a.alt > -2) out.push({ name: st.name, kind: "star", alt: a.alt, az: a.az, mag: st.mag });
    }
    out.sort(function (x, y) { return x.mag - y.mag; });
    return { sun: sun, moon: moon, bodies: out, night: s.alt < -1 };
  }

  return {
      gha_deg: gha,
      dec_deg: dec,
      ra_deg: ra,
      sd_arcmin: sd_arcmin,
      hp_arcmin: hp_arcmin,
      r_au: r,
      apparent_lon_deg: _norm360(lam),
      epsilon_deg: eps,
      gast_deg: gast,
    };
  }

  function dip(height_eye_m) {
    if (height_eye_m < 0) throw new Error("height of eye must be >= 0");
    return -1.76 * Math.sqrt(height_eye_m);
  }

  function refractionBennett(ha_deg) {
    if (ha_deg < -0.5) return 0.0;
    var arg = (ha_deg + 7.31 / (ha_deg + 4.4)) * DEG2RAD;
    return 1.0 / Math.tan(arg);
  }

  function correctAltitude(
    hs_deg,
    height_eye_m,
    index_error_arcmin,
    index_off_the_arc,
    limb,
    sd_arcmin,
    hp_arcmin
  ) {
    index_error_arcmin = index_error_arcmin == null ? 0.0 : index_error_arcmin;
    index_off_the_arc = !!index_off_the_arc;
    limb = (limb || "lower").toLowerCase();
    sd_arcmin = sd_arcmin == null ? 16.0 : sd_arcmin;
    hp_arcmin = hp_arcmin == null ? 0.1466 : hp_arcmin;

    var ic = index_off_the_arc ? index_error_arcmin : -index_error_arcmin;
    var dipA = dip(height_eye_m);
    var ha = hs_deg + ic / 60.0 + dipA / 60.0;
    var ref = refractionBennett(ha);
    var pa = hp_arcmin * Math.cos(ha * DEG2RAD);
    var ho;
    if (limb === "lower") {
      ho = ha - ref / 60.0 + sd_arcmin / 60.0 + pa / 60.0;
    } else if (limb === "upper") {
      ho = ha - ref / 60.0 - sd_arcmin / 60.0 + pa / 60.0;
    } else if (limb === "center") {
      ho = ha - ref / 60.0 + pa / 60.0;
    } else {
      throw new Error("limb must be lower, upper, or center");
    }
  
  function moonEquatorial(utc) {
    var jd = julian_day(utc);
    var t = julian_centuries(jd);
    var Lp = _norm360(218.3164477 + 481267.88123421 * t);
    var D = _norm360(297.8501921 + 445267.1114034 * t);
    var M = _norm360(357.5291092 + 35999.0502909 * t);
    var Mp = _norm360(134.9633964 + 477198.8675055 * t);
    var F = _norm360(93.272095 + 483202.0175233 * t);
    var Dr = D * DEG2RAD, Mr = M * DEG2RAD, Mpr = Mp * DEG2RAD, Fr = F * DEG2RAD;
    var lon =
      Lp +
      6.289 * Math.sin(Mpr) +
      1.274 * Math.sin(2 * Dr - Mpr) +
      0.658 * Math.sin(2 * Dr) -
      0.186 * Math.sin(Mr) -
      0.214 * Math.sin(2 * Mpr) -
      0.114 * Math.sin(2 * Fr);
    var lat =
      5.128 * Math.sin(Fr) +
      0.281 * Math.sin(Mpr + Fr) +
      0.278 * Math.sin(Mpr - Fr) +
      0.173 * Math.sin(2 * Dr - Fr);
    var omega = _norm360(125.04 - 1934.136 * t);
    var l0 = _norm360(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
    var eps0 =
      23.0 + 26.0 / 60.0 + 21.448 / 3600.0 - (46.815 / 3600.0) * t;
    var eps = eps0 + 0.00256 * Math.cos(omega * DEG2RAD);
    var lon_r = lon * DEG2RAD;
    var lat_r = lat * DEG2RAD;
    var eps_r = eps * DEG2RAD;
    var dec = Math.asin(
      Math.sin(lat_r) * Math.cos(eps_r) +
        Math.cos(lat_r) * Math.sin(eps_r) * Math.sin(lon_r)
    ) * RAD2DEG;
    var ra = Math.atan2(
      Math.sin(lon_r) * Math.cos(eps_r) - Math.tan(lat_r) * Math.sin(eps_r),
      Math.cos(lon_r)
    ) * RAD2DEG;
    ra = _norm360(ra);
    var gast = _greenwich_apparent_sidereal(jd, t, omega, l0, eps);
    var gha = _norm360(gast - ra);
    return { gha_deg: gha, dec_deg: dec, ra_deg: ra, gast_deg: gast, name: "ירח" };
  }

  var STARS = [
    { name: "סיריוס", ra: 101.287, dec: -16.716, mag: -1.46 },
    { name: "קאנופוס", ra: 95.988, dec: -52.696, mag: -0.74 },
    { name: "ארקטורוס", ra: 213.915, dec: 19.182, mag: -0.05 },
    { name: "וגה", ra: 279.235, dec: 38.784, mag: 0.03 },
    { name: "קפלה", ra: 79.172, dec: 45.998, mag: 0.08 },
    { name: "ריגל", ra: 78.634, dec: -8.202, mag: 0.13 },
    { name: "פרוקיון", ra: 114.826, dec: 5.225, mag: 0.34 },
    { name: "בטלגז", ra: 88.793, dec: 7.407, mag: 0.5 },
    { name: "אלטאיר", ra: 297.696, dec: 8.868, mag: 0.76 },
    { name: "אלדברן", ra: 68.98, dec: 16.509, mag: 0.85 },
    { name: "אנטארס", ra: 247.352, dec: -26.432, mag: 0.96 },
    { name: "ספיקה", ra: 201.298, dec: -11.161, mag: 0.98 },
    { name: "פולוקס", ra: 116.329, dec: 28.026, mag: 1.14 },
    { name: "פומלאוט", ra: 344.413, dec: -29.622, mag: 1.16 },
    { name: "דנב", ra: 310.358, dec: 45.28, mag: 1.25 },
    { name: "רגולוס", ra: 152.093, dec: 11.967, mag: 1.35 },
    { name: "קסטור", ra: 113.65, dec: 31.888, mag: 1.58 },
    { name: "בלאטריקס", ra: 81.283, dec: 6.35, mag: 1.64 },
    { name: "אליות", ra: 193.507, dec: 55.96, mag: 1.77 },
    { name: "דובה", ra: 165.932, dec: 61.751, mag: 1.79 }
  ];

  function altaz(lat, lon, ra_deg, dec_deg, gast_deg) {
    var lst = _norm360(gast_deg + lon);
    var ha = _norm360(lst - ra_deg);
    var alt = computed_altitude(lat, dec_deg, ha);
    var az = azimuth_zn(lat, dec_deg, ha, alt);
    return { alt: alt, az: az, ha: ha };
  }

  function skyBodies(utc, lat, lon) {
    var sun = sunEquatorial(utc);
    var moon = moonEquatorial(utc);
    var out = [];
    var s = altaz(lat, lon, sun.ra_deg, sun.dec_deg, sun.gast_deg);
    out.push({ name: "שמש", kind: "sun", alt: s.alt, az: s.az, mag: -26 });
    var m = altaz(lat, lon, moon.ra_deg, moon.dec_deg, moon.gast_deg);
    out.push({ name: "ירח", kind: "moon", alt: m.alt, az: m.az, mag: -12 });
    for (var i = 0; i < STARS.length; i++) {
      var st = STARS[i];
      var a = altaz(lat, lon, st.ra, st.dec, sun.gast_deg);
      if (a.alt > -2) out.push({ name: st.name, kind: "star", alt: a.alt, az: a.az, mag: st.mag });
    }
    out.sort(function (x, y) { return x.mag - y.mag; });
    return { sun: sun, moon: moon, bodies: out, night: s.alt < -1 };
  }

  return {
      hs_deg: hs_deg,
      ic_arcmin: ic,
      dip_arcmin: dipA,
      ha_deg: ha,
      refraction_arcmin: ref,
      sd_arcmin: sd_arcmin,
      pa_arcmin: pa,
      ho_deg: ho,
    };
  }

  function lha_deg(gha_deg, lon_east_deg) {
    return _norm360(gha_deg + lon_east_deg);
  }

  function computed_altitude(lat_deg, dec_deg, lha_deg_) {
    var lat = lat_deg * DEG2RAD;
    var dec = dec_deg * DEG2RAD;
    var lha = lha_deg_ * DEG2RAD;
    var s =
      Math.sin(lat) * Math.sin(dec) +
      Math.cos(lat) * Math.cos(dec) * Math.cos(lha);
    s = Math.max(-1.0, Math.min(1.0, s));
    return Math.asin(s) * RAD2DEG;
  }

  function azimuth_zn(lat_deg, dec_deg, lha_deg_, hc_deg) {
    var lat = lat_deg * DEG2RAD;
    var dec = dec_deg * DEG2RAD;
    var lha = lha_deg_ * DEG2RAD;
    var hc = hc_deg * DEG2RAD;
    var ch = Math.cos(hc);
    if (Math.abs(ch) < 1e-12) return 0.0;
    var sin_z = (-Math.cos(dec) * Math.sin(lha)) / ch;
    var cos_z =
      (Math.sin(dec) - Math.sin(lat) * Math.sin(hc)) / (Math.cos(lat) * ch);
    var zn = Math.atan2(sin_z, cos_z) * RAD2DEG;
    return _norm360(zn);
  }

  function intercept(ho_deg, ap_lat_deg, ap_lon_east_deg, gha_deg, dec_deg) {
    var lha = lha_deg(gha_deg, ap_lon_east_deg);
    var hc = computed_altitude(ap_lat_deg, dec_deg, lha);
    var zn = azimuth_zn(ap_lat_deg, dec_deg, lha, hc);
    var a_nm = (ho_deg - hc) * 60.0;
  
  function moonEquatorial(utc) {
    var jd = julian_day(utc);
    var t = julian_centuries(jd);
    var Lp = _norm360(218.3164477 + 481267.88123421 * t);
    var D = _norm360(297.8501921 + 445267.1114034 * t);
    var M = _norm360(357.5291092 + 35999.0502909 * t);
    var Mp = _norm360(134.9633964 + 477198.8675055 * t);
    var F = _norm360(93.272095 + 483202.0175233 * t);
    var Dr = D * DEG2RAD, Mr = M * DEG2RAD, Mpr = Mp * DEG2RAD, Fr = F * DEG2RAD;
    var lon =
      Lp +
      6.289 * Math.sin(Mpr) +
      1.274 * Math.sin(2 * Dr - Mpr) +
      0.658 * Math.sin(2 * Dr) -
      0.186 * Math.sin(Mr) -
      0.214 * Math.sin(2 * Mpr) -
      0.114 * Math.sin(2 * Fr);
    var lat =
      5.128 * Math.sin(Fr) +
      0.281 * Math.sin(Mpr + Fr) +
      0.278 * Math.sin(Mpr - Fr) +
      0.173 * Math.sin(2 * Dr - Fr);
    var omega = _norm360(125.04 - 1934.136 * t);
    var l0 = _norm360(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
    var eps0 =
      23.0 + 26.0 / 60.0 + 21.448 / 3600.0 - (46.815 / 3600.0) * t;
    var eps = eps0 + 0.00256 * Math.cos(omega * DEG2RAD);
    var lon_r = lon * DEG2RAD;
    var lat_r = lat * DEG2RAD;
    var eps_r = eps * DEG2RAD;
    var dec = Math.asin(
      Math.sin(lat_r) * Math.cos(eps_r) +
        Math.cos(lat_r) * Math.sin(eps_r) * Math.sin(lon_r)
    ) * RAD2DEG;
    var ra = Math.atan2(
      Math.sin(lon_r) * Math.cos(eps_r) - Math.tan(lat_r) * Math.sin(eps_r),
      Math.cos(lon_r)
    ) * RAD2DEG;
    ra = _norm360(ra);
    var gast = _greenwich_apparent_sidereal(jd, t, omega, l0, eps);
    var gha = _norm360(gast - ra);
    return { gha_deg: gha, dec_deg: dec, ra_deg: ra, gast_deg: gast, name: "ירח" };
  }

  var STARS = [
    { name: "סיריוס", ra: 101.287, dec: -16.716, mag: -1.46 },
    { name: "קאנופוס", ra: 95.988, dec: -52.696, mag: -0.74 },
    { name: "ארקטורוס", ra: 213.915, dec: 19.182, mag: -0.05 },
    { name: "וגה", ra: 279.235, dec: 38.784, mag: 0.03 },
    { name: "קפלה", ra: 79.172, dec: 45.998, mag: 0.08 },
    { name: "ריגל", ra: 78.634, dec: -8.202, mag: 0.13 },
    { name: "פרוקיון", ra: 114.826, dec: 5.225, mag: 0.34 },
    { name: "בטלגז", ra: 88.793, dec: 7.407, mag: 0.5 },
    { name: "אלטאיר", ra: 297.696, dec: 8.868, mag: 0.76 },
    { name: "אלדברן", ra: 68.98, dec: 16.509, mag: 0.85 },
    { name: "אנטארס", ra: 247.352, dec: -26.432, mag: 0.96 },
    { name: "ספיקה", ra: 201.298, dec: -11.161, mag: 0.98 },
    { name: "פולוקס", ra: 116.329, dec: 28.026, mag: 1.14 },
    { name: "פומלאוט", ra: 344.413, dec: -29.622, mag: 1.16 },
    { name: "דנב", ra: 310.358, dec: 45.28, mag: 1.25 },
    { name: "רגולוס", ra: 152.093, dec: 11.967, mag: 1.35 },
    { name: "קסטור", ra: 113.65, dec: 31.888, mag: 1.58 },
    { name: "בלאטריקס", ra: 81.283, dec: 6.35, mag: 1.64 },
    { name: "אליות", ra: 193.507, dec: 55.96, mag: 1.77 },
    { name: "דובה", ra: 165.932, dec: 61.751, mag: 1.79 }
  ];

  function altaz(lat, lon, ra_deg, dec_deg, gast_deg) {
    var lst = _norm360(gast_deg + lon);
    var ha = _norm360(lst - ra_deg);
    var alt = computed_altitude(lat, dec_deg, ha);
    var az = azimuth_zn(lat, dec_deg, ha, alt);
    return { alt: alt, az: az, ha: ha };
  }

  function skyBodies(utc, lat, lon) {
    var sun = sunEquatorial(utc);
    var moon = moonEquatorial(utc);
    var out = [];
    var s = altaz(lat, lon, sun.ra_deg, sun.dec_deg, sun.gast_deg);
    out.push({ name: "שמש", kind: "sun", alt: s.alt, az: s.az, mag: -26 });
    var m = altaz(lat, lon, moon.ra_deg, moon.dec_deg, moon.gast_deg);
    out.push({ name: "ירח", kind: "moon", alt: m.alt, az: m.az, mag: -12 });
    for (var i = 0; i < STARS.length; i++) {
      var st = STARS[i];
      var a = altaz(lat, lon, st.ra, st.dec, sun.gast_deg);
      if (a.alt > -2) out.push({ name: st.name, kind: "star", alt: a.alt, az: a.az, mag: st.mag });
    }
    out.sort(function (x, y) { return x.mag - y.mag; });
    return { sun: sun, moon: moon, bodies: out, night: s.alt < -1 };
  }

  return {
      hc_deg: hc,
      ho_deg: ho_deg,
      intercept_nm: Math.abs(a_nm),
      toward: a_nm >= 0.0,
      zn_deg: zn,
      lha_deg: lha,
      ap_lat_deg: ap_lat_deg,
      ap_lon_deg: ap_lon_east_deg,
    };
  }

  function dest_point(lat_deg, lon_east_deg, course_deg, distance_nm) {
    var lat1 = lat_deg * DEG2RAD;
    var lon1 = lon_east_deg * DEG2RAD;
    var tc = course_deg * DEG2RAD;
    var d = (distance_nm / 60.0) * DEG2RAD;
    var lat2 = lat1 + d * Math.cos(tc);
    var dlat = lat2 - lat1;
    var lon2;
    if (Math.abs(Math.cos(lat1)) < 1e-12 && Math.abs(Math.cos(lat2)) < 1e-12) {
      lon2 = lon1;
    } else {
      var q;
      if (Math.abs(dlat) < 1e-12) {
        q = Math.cos(lat1);
      } else {
        q =
          dlat /
          Math.log(
            Math.tan(Math.PI / 4 + lat2 / 2) /
              Math.tan(Math.PI / 4 + lat1 / 2)
          );
      }
      var dlon = Math.abs(q) > 1e-12 ? (d * Math.sin(tc)) / q : 0.0;
      lon2 = lon1 + dlon;
    }
    return [lat2 * RAD2DEG, _norm180(lon2 * RAD2DEG)];
  }

  function lop_point(lop) {
    var course = lop.toward ? lop.zn_deg : _norm360(lop.zn_deg + 180.0);
    return dest_point(lop.lat_deg, lop.lon_east_deg, course, lop.intercept_nm);
  }

  function advance_lop(lop, course_deg, distance_nm) {
    var p = dest_point(lop.lat_deg, lop.lon_east_deg, course_deg, distance_nm);
  
  function moonEquatorial(utc) {
    var jd = julian_day(utc);
    var t = julian_centuries(jd);
    var Lp = _norm360(218.3164477 + 481267.88123421 * t);
    var D = _norm360(297.8501921 + 445267.1114034 * t);
    var M = _norm360(357.5291092 + 35999.0502909 * t);
    var Mp = _norm360(134.9633964 + 477198.8675055 * t);
    var F = _norm360(93.272095 + 483202.0175233 * t);
    var Dr = D * DEG2RAD, Mr = M * DEG2RAD, Mpr = Mp * DEG2RAD, Fr = F * DEG2RAD;
    var lon =
      Lp +
      6.289 * Math.sin(Mpr) +
      1.274 * Math.sin(2 * Dr - Mpr) +
      0.658 * Math.sin(2 * Dr) -
      0.186 * Math.sin(Mr) -
      0.214 * Math.sin(2 * Mpr) -
      0.114 * Math.sin(2 * Fr);
    var lat =
      5.128 * Math.sin(Fr) +
      0.281 * Math.sin(Mpr + Fr) +
      0.278 * Math.sin(Mpr - Fr) +
      0.173 * Math.sin(2 * Dr - Fr);
    var omega = _norm360(125.04 - 1934.136 * t);
    var l0 = _norm360(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
    var eps0 =
      23.0 + 26.0 / 60.0 + 21.448 / 3600.0 - (46.815 / 3600.0) * t;
    var eps = eps0 + 0.00256 * Math.cos(omega * DEG2RAD);
    var lon_r = lon * DEG2RAD;
    var lat_r = lat * DEG2RAD;
    var eps_r = eps * DEG2RAD;
    var dec = Math.asin(
      Math.sin(lat_r) * Math.cos(eps_r) +
        Math.cos(lat_r) * Math.sin(eps_r) * Math.sin(lon_r)
    ) * RAD2DEG;
    var ra = Math.atan2(
      Math.sin(lon_r) * Math.cos(eps_r) - Math.tan(lat_r) * Math.sin(eps_r),
      Math.cos(lon_r)
    ) * RAD2DEG;
    ra = _norm360(ra);
    var gast = _greenwich_apparent_sidereal(jd, t, omega, l0, eps);
    var gha = _norm360(gast - ra);
    return { gha_deg: gha, dec_deg: dec, ra_deg: ra, gast_deg: gast, name: "ירח" };
  }

  var STARS = [
    { name: "סיריוס", ra: 101.287, dec: -16.716, mag: -1.46 },
    { name: "קאנופוס", ra: 95.988, dec: -52.696, mag: -0.74 },
    { name: "ארקטורוס", ra: 213.915, dec: 19.182, mag: -0.05 },
    { name: "וגה", ra: 279.235, dec: 38.784, mag: 0.03 },
    { name: "קפלה", ra: 79.172, dec: 45.998, mag: 0.08 },
    { name: "ריגל", ra: 78.634, dec: -8.202, mag: 0.13 },
    { name: "פרוקיון", ra: 114.826, dec: 5.225, mag: 0.34 },
    { name: "בטלגז", ra: 88.793, dec: 7.407, mag: 0.5 },
    { name: "אלטאיר", ra: 297.696, dec: 8.868, mag: 0.76 },
    { name: "אלדברן", ra: 68.98, dec: 16.509, mag: 0.85 },
    { name: "אנטארס", ra: 247.352, dec: -26.432, mag: 0.96 },
    { name: "ספיקה", ra: 201.298, dec: -11.161, mag: 0.98 },
    { name: "פולוקס", ra: 116.329, dec: 28.026, mag: 1.14 },
    { name: "פומלאוט", ra: 344.413, dec: -29.622, mag: 1.16 },
    { name: "דנב", ra: 310.358, dec: 45.28, mag: 1.25 },
    { name: "רגולוס", ra: 152.093, dec: 11.967, mag: 1.35 },
    { name: "קסטור", ra: 113.65, dec: 31.888, mag: 1.58 },
    { name: "בלאטריקס", ra: 81.283, dec: 6.35, mag: 1.64 },
    { name: "אליות", ra: 193.507, dec: 55.96, mag: 1.77 },
    { name: "דובה", ra: 165.932, dec: 61.751, mag: 1.79 }
  ];

  function altaz(lat, lon, ra_deg, dec_deg, gast_deg) {
    var lst = _norm360(gast_deg + lon);
    var ha = _norm360(lst - ra_deg);
    var alt = computed_altitude(lat, dec_deg, ha);
    var az = azimuth_zn(lat, dec_deg, ha, alt);
    return { alt: alt, az: az, ha: ha };
  }

  function skyBodies(utc, lat, lon) {
    var sun = sunEquatorial(utc);
    var moon = moonEquatorial(utc);
    var out = [];
    var s = altaz(lat, lon, sun.ra_deg, sun.dec_deg, sun.gast_deg);
    out.push({ name: "שמש", kind: "sun", alt: s.alt, az: s.az, mag: -26 });
    var m = altaz(lat, lon, moon.ra_deg, moon.dec_deg, moon.gast_deg);
    out.push({ name: "ירח", kind: "moon", alt: m.alt, az: m.az, mag: -12 });
    for (var i = 0; i < STARS.length; i++) {
      var st = STARS[i];
      var a = altaz(lat, lon, st.ra, st.dec, sun.gast_deg);
      if (a.alt > -2) out.push({ name: st.name, kind: "star", alt: a.alt, az: a.az, mag: st.mag });
    }
    out.sort(function (x, y) { return x.mag - y.mag; });
    return { sun: sun, moon: moon, bodies: out, night: s.alt < -1 };
  }

  return {
      lat_deg: p[0],
      lon_east_deg: p[1],
      zn_deg: lop.zn_deg,
      intercept_nm: lop.intercept_nm,
      toward: lop.toward,
    };
  }

  function intersect_lops(a, b) {
    var p1 = lop_point(a);
    var p2 = lop_point(b);
    var mean_lat = 0.5 * (p1[0] + p2[0]) * DEG2RAD;
    function to_xy(lat, lon, lat0, lon0) {
      var y = (lat - lat0) * 60.0;
      var x = (lon - lon0) * 60.0 * Math.cos(mean_lat);
      return [x, y];
    }
    var lat0 = p1[0];
    var lon0 = p1[1];
    var x1 = 0.0,
      y1 = 0.0;
    var xy2 = to_xy(p2[0], p2[1], lat0, lon0);
    var x2 = xy2[0],
      y2 = xy2[1];
    var z1 = (a.zn_deg + 90.0) * DEG2RAD;
    var z2 = (b.zn_deg + 90.0) * DEG2RAD;
    var d1x = Math.sin(z1),
      d1y = Math.cos(z1);
    var d2x = Math.sin(z2),
      d2y = Math.cos(z2);
    var det = d1x * -d2y - -d2x * d1y;
    if (Math.abs(det) < 1e-9) {
      throw new Error("LOPs are parallel; no unique running fix");
    }
    var t = ((x2 - x1) * -d2y - -d2x * (y2 - y1)) / det;
    var x = x1 + t * d1x;
    var y = y1 + t * d1y;
    var lat = lat0 + y / 60.0;
    var lon =
      lon0 +
      x /
        (Math.abs(Math.cos(mean_lat)) > 1e-9
          ? 60.0 * Math.cos(mean_lat)
          : 60.0);
    return [lat, _norm180(lon)];
  }

  function runningFix(first, second, course_deg, distance_nm) {
    var transferred = advance_lop(first, course_deg, distance_nm);
    return intersect_lops(transferred, second);
  }

  function trimmedMean(values, trim_count) {
    trim_count = trim_count == null ? 1 : trim_count;
    if (!values || !values.length) throw new Error("no samples");
    var xs = values.slice().sort(function (a, b) {
      return a - b;
    });
    if (xs.length >= 3 && trim_count > 0) {
      var k = Math.min(trim_count, Math.floor((xs.length - 1) / 2));
      xs = xs.length - 2 * k >= 1 ? xs.slice(k, xs.length - k) : xs;
    }
    var sum = 0;
    for (var i = 0; i < xs.length; i++) sum += xs[i];
    return sum / xs.length;
  }


  function moonEquatorial(utc) {
    var jd = julian_day(utc);
    var t = julian_centuries(jd);
    var Lp = _norm360(218.3164477 + 481267.88123421 * t);
    var D = _norm360(297.8501921 + 445267.1114034 * t);
    var M = _norm360(357.5291092 + 35999.0502909 * t);
    var Mp = _norm360(134.9633964 + 477198.8675055 * t);
    var F = _norm360(93.272095 + 483202.0175233 * t);
    var Dr = D * DEG2RAD, Mr = M * DEG2RAD, Mpr = Mp * DEG2RAD, Fr = F * DEG2RAD;
    var lon =
      Lp +
      6.289 * Math.sin(Mpr) +
      1.274 * Math.sin(2 * Dr - Mpr) +
      0.658 * Math.sin(2 * Dr) -
      0.186 * Math.sin(Mr) -
      0.214 * Math.sin(2 * Mpr) -
      0.114 * Math.sin(2 * Fr);
    var lat =
      5.128 * Math.sin(Fr) +
      0.281 * Math.sin(Mpr + Fr) +
      0.278 * Math.sin(Mpr - Fr) +
      0.173 * Math.sin(2 * Dr - Fr);
    var omega = _norm360(125.04 - 1934.136 * t);
    var l0 = _norm360(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
    var eps0 =
      23.0 + 26.0 / 60.0 + 21.448 / 3600.0 - (46.815 / 3600.0) * t;
    var eps = eps0 + 0.00256 * Math.cos(omega * DEG2RAD);
    var lon_r = lon * DEG2RAD;
    var lat_r = lat * DEG2RAD;
    var eps_r = eps * DEG2RAD;
    var dec = Math.asin(
      Math.sin(lat_r) * Math.cos(eps_r) +
        Math.cos(lat_r) * Math.sin(eps_r) * Math.sin(lon_r)
    ) * RAD2DEG;
    var ra = Math.atan2(
      Math.sin(lon_r) * Math.cos(eps_r) - Math.tan(lat_r) * Math.sin(eps_r),
      Math.cos(lon_r)
    ) * RAD2DEG;
    ra = _norm360(ra);
    var gast = _greenwich_apparent_sidereal(jd, t, omega, l0, eps);
    var gha = _norm360(gast - ra);
    return { gha_deg: gha, dec_deg: dec, ra_deg: ra, gast_deg: gast, name: "ירח" };
  }

  var STARS = [
    { name: "סיריוס", ra: 101.287, dec: -16.716, mag: -1.46 },
    { name: "קאנופוס", ra: 95.988, dec: -52.696, mag: -0.74 },
    { name: "ארקטורוס", ra: 213.915, dec: 19.182, mag: -0.05 },
    { name: "וגה", ra: 279.235, dec: 38.784, mag: 0.03 },
    { name: "קפלה", ra: 79.172, dec: 45.998, mag: 0.08 },
    { name: "ריגל", ra: 78.634, dec: -8.202, mag: 0.13 },
    { name: "פרוקיון", ra: 114.826, dec: 5.225, mag: 0.34 },
    { name: "בטלגז", ra: 88.793, dec: 7.407, mag: 0.5 },
    { name: "אלטאיר", ra: 297.696, dec: 8.868, mag: 0.76 },
    { name: "אלדברן", ra: 68.98, dec: 16.509, mag: 0.85 },
    { name: "אנטארס", ra: 247.352, dec: -26.432, mag: 0.96 },
    { name: "ספיקה", ra: 201.298, dec: -11.161, mag: 0.98 },
    { name: "פולוקס", ra: 116.329, dec: 28.026, mag: 1.14 },
    { name: "פומלאוט", ra: 344.413, dec: -29.622, mag: 1.16 },
    { name: "דנב", ra: 310.358, dec: 45.28, mag: 1.25 },
    { name: "רגולוס", ra: 152.093, dec: 11.967, mag: 1.35 },
    { name: "קסטור", ra: 113.65, dec: 31.888, mag: 1.58 },
    { name: "בלאטריקס", ra: 81.283, dec: 6.35, mag: 1.64 },
    { name: "אליות", ra: 193.507, dec: 55.96, mag: 1.77 },
    { name: "דובה", ra: 165.932, dec: 61.751, mag: 1.79 }
  ];

  function altaz(lat, lon, ra_deg, dec_deg, gast_deg) {
    var lst = _norm360(gast_deg + lon);
    var ha = _norm360(lst - ra_deg);
    var alt = computed_altitude(lat, dec_deg, ha);
    var az = azimuth_zn(lat, dec_deg, ha, alt);
    return { alt: alt, az: az, ha: ha };
  }

  function skyBodies(utc, lat, lon) {
    var sun = sunEquatorial(utc);
    var moon = moonEquatorial(utc);
    var out = [];
    var s = altaz(lat, lon, sun.ra_deg, sun.dec_deg, sun.gast_deg);
    out.push({ name: "שמש", kind: "sun", alt: s.alt, az: s.az, mag: -26 });
    var m = altaz(lat, lon, moon.ra_deg, moon.dec_deg, moon.gast_deg);
    out.push({ name: "ירח", kind: "moon", alt: m.alt, az: m.az, mag: -12 });
    for (var i = 0; i < STARS.length; i++) {
      var st = STARS[i];
      var a = altaz(lat, lon, st.ra, st.dec, sun.gast_deg);
      if (a.alt > -2) out.push({ name: st.name, kind: "star", alt: a.alt, az: a.az, mag: st.mag });
    }
    out.sort(function (x, y) { return x.mag - y.mag; });
    return { sun: sun, moon: moon, bodies: out, night: s.alt < -1 };
  }

  return {
    DEG2RAD: DEG2RAD,
    RAD2DEG: RAD2DEG,
    ARCSEC_IN_DEG: ARCSEC_IN_DEG,
    dms: dms,
    deg_to_dms: deg_to_dms,
    julian_day: julian_day,
    julian_centuries: julian_centuries,
    sunEquatorial: sunEquatorial,
    moonEquatorial: moonEquatorial,
    STARS: STARS,
    altaz: altaz,
    skyBodies: skyBodies,
    dip: dip,
    dip_arcmin: dip,
    refractionBennett: refractionBennett,
    refraction_bennett_arcmin: refractionBennett,
    correctAltitude: correctAltitude,
    correct_altitude: correctAltitude,
    lha_deg: lha_deg,
    computed_altitude: computed_altitude,
    azimuth_zn: azimuth_zn,
    intercept: intercept,
    dest_point: dest_point,
    lop_point: lop_point,
    advance_lop: advance_lop,
    intersect_lops: intersect_lops,
    runningFix: runningFix,
    running_fix: runningFix,
    trimmedMean: trimmedMean,
    trimmed_mean: trimmedMean,
    _norm360: _norm360,
    _norm180: _norm180,
  };
});
