(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  const els = {
    body: document.body,
    answer: $("#answer"),
    quip: $("#quip"),
    aside: $("#aside"),
    form: $("#search"),
    input: $("#place"),
    more: $("#more-btn"),
    retry: $("#retry-btn"),
    details: $("#details"),
    elsewhere: $("#elsewhere"),
  };

  const LANG = navigator.language || "en-GB";
  const IMPERIAL = /^en-(US|LR|MM)$/i.test(LANG);

  const QUIPS = {
    rain: [
      "Bring a coat. Or don't. I'm a website, not your mum.",
      "The sky is doing the thing again.",
      "Classic.",
      "Umbrella o'clock.",
      "Not my fault, for the record.",
      "Sorry. Well. Not sorry. It's weather.",
    ],
    drizzle: [
      "Technically. It's the annoying fine stuff.",
      "Barely. But enough to ruin your hair.",
      "Sort of. The kind you can't see but can definitely feel.",
    ],
    heavy: [
      "Properly. Like, a lot.",
      "Biblically, frankly.",
      "Don't even think about it.",
      "Extremely. Stay in, put the kettle on.",
    ],
    storm: [
      "With added thunder, for drama.",
      "And it's being very loud about it.",
      "Yes, and the sky is shouting.",
    ],
    freezing: [
      "And it's freezing on contact. Genuinely, stay in.",
      "The icy kind. Walk like a penguin.",
    ],
    no: [
      "Off you go then.",
      "Go outside. Or don't. Not my business.",
      "Nothing's falling out of the sky. Enjoy that.",
      "Leave the umbrella. Live a little.",
      "Dry. For now. Probably.",
      "Not a drop. Carry on.",
    ],
    snow: [
      "It's snowing, though. Which is a whole other thing.",
      "It's snow. Different department.",
    ],
  };

  /* ---------- Rain on the glass ---------- */

  // How each kind of rain looks. Sizes are relative to normal rain (1).
  const LOOKS = {
    drizzle:  { count: 110, speed: 0.22, len: 0.22, width: 1,   alpha: 0.3,  slant: 0.04, sway: 22 },
    rain:     { count: 170, speed: 1,    len: 1,    width: 1,   alpha: 0.38, slant: 0.14 },
    freezing: { count: 150, speed: 0.7,  len: 0.55, width: 1.4, alpha: 0.55, slant: 0.08, color: "236, 248, 255" },
    heavy:    { count: 420, speed: 1.55, len: 1.7,  width: 1.5, alpha: 0.46, slant: 0.24, splash: true },
    storm:    { count: 480, speed: 1.75, len: 1.9,  width: 1.5, alpha: 0.5,  slant: 0.48, splash: true, lightning: true },
  };

  const rain = (() => {
    const cv = $("#rain");
    const ctx = cv.getContext("2d");
    const flash = $("#flash");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const LAYERS = [0.45, 0.7, 1]; // far, middle, near
    let look = null, drops = [], splashes = [], bolt = null;
    let raf = 0, w = 0, h = 0, last = 0, nextBolt = 0;

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(d, anywhere) {
      const z = LAYERS[d.layer];
      const r = () => 0.75 + Math.random() * 0.5;
      d.x = Math.random() * (w + h * look.slant + 40);
      d.y = anywhere ? Math.random() * h : -Math.random() * 80 - 20;
      d.l = 22 * look.len * z * r();
      d.v = 900 * look.speed * z * r();
      d.phase = Math.random() * Math.PI * 2;
      return d;
    }

    /* Lightning: a jagged main bolt with a few forks, flickering on and off. */
    function makeBolt() {
      const paths = [];
      const fork = (x, y, angle, length, depth) => {
        const pts = [[x, y]];
        const steps = 12 + ((Math.random() * 8) | 0);
        const step = length / steps;
        for (let i = 0; i < steps; i++) {
          angle += (Math.random() - 0.5) * 0.8;
          angle = Math.max(-0.9, Math.min(0.9, angle));
          x += Math.sin(angle) * step;
          y += Math.cos(angle) * step;
          pts.push([x, y]);
          if (depth < 2 && Math.random() < 0.16) {
            const turn = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5);
            fork(x, y, angle + turn, length * 0.35, depth + 1);
          }
        }
        paths.push({ pts, width: depth === 0 ? 3 : depth === 1 ? 1.6 : 1 });
      };
      fork(w * (0.12 + Math.random() * 0.76), -10, (Math.random() - 0.5) * 0.5, h * (0.55 + Math.random() * 0.35), 0);
      return { paths, born: performance.now() };
    }

    // Two quick strikes, then a fade: how real lightning flickers.
    function brightness(ms) {
      if (ms < 70) return 1;
      if (ms < 130) return 0.15;
      if (ms < 230) return 0.9;
      if (ms < 700) return 0.9 * (1 - (ms - 230) / 470);
      return 0;
    }

    function drawBolt(now) {
      const b = brightness(now - bolt.born);
      flash.style.opacity = (b * 0.55).toFixed(3);
      if (b <= 0) { bolt = null; return; }
      ctx.save();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.shadowColor = "rgba(200, 220, 255, 0.9)";
      ctx.shadowBlur = 24;
      for (const p of bolt.paths) {
        ctx.beginPath();
        p.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.strokeStyle = `rgba(245, 248, 255, ${b})`;
        ctx.lineWidth = p.width;
        ctx.stroke();
      }
      ctx.restore();
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      ctx.clearRect(0, 0, w, h);
      const color = look.color || "214, 228, 240";

      for (let li = 0; li < LAYERS.length; li++) {
        const z = LAYERS[li];
        ctx.beginPath();
        ctx.lineWidth = look.width * (0.6 + z * 0.4);
        ctx.lineCap = "round";
        ctx.strokeStyle = `rgba(${color}, ${look.alpha * z})`;
        for (const d of drops) {
          if (d.layer !== li) continue;
          const dy = d.v * dt;
          d.y += dy;
          d.x -= dy * look.slant;
          if (look.sway) d.x += Math.sin(now / 900 + d.phase) * look.sway * z * dt;
          ctx.moveTo(d.x + d.l * look.slant, d.y - d.l);
          ctx.lineTo(d.x, d.y);
          if (d.y > h || d.x < -40) {
            if (look.splash && li === 2 && d.y > h) {
              splashes.push({ x: d.x, y: h - Math.random() * h * 0.08, age: 0 });
            }
            spawn(d, false);
          }
        }
        ctx.stroke();
      }

      if (splashes.length) {
        ctx.lineWidth = 1;
        for (let i = splashes.length - 1; i >= 0; i--) {
          const s = splashes[i];
          s.age += dt;
          const t = s.age / 0.35;
          if (t >= 1) { splashes.splice(i, 1); continue; }
          ctx.strokeStyle = `rgba(${color}, ${0.5 * (1 - t)})`;
          ctx.beginPath();
          ctx.ellipse(s.x, s.y, 2 + t * 9, 0.6 + t * 2.4, 0, Math.PI, 2 * Math.PI);
          ctx.stroke();
        }
      }

      if (look.lightning) {
        if (!bolt && now >= nextBolt) {
          bolt = makeBolt();
          nextBolt = now + 3500 + Math.random() * 6500;
        }
        if (bolt) drawBolt(now);
      }

      raf = requestAnimationFrame(frame);
    }

    addEventListener("resize", () => look && resize());

    return {
      start(kind) {
        this.stop();
        if (reduce.matches || !LOOKS[kind]) return;
        look = LOOKS[kind];
        resize();
        // Fewer drops on small screens so a phone isn't a wall of lines.
        const scale = Math.max(0.45, Math.min(1.4, (w * h) / (1280 * 800)));
        drops = Array.from({ length: Math.round(look.count * scale) }, (_, i) =>
          spawn({ layer: i % LAYERS.length }, true)
        );
        last = performance.now();
        nextBolt = last + 1200;
        raf = requestAnimationFrame(frame);
      },
      stop() {
        cancelAnimationFrame(raf);
        look = null;
        bolt = null;
        drops = [];
        splashes = [];
        flash.style.opacity = "0";
        ctx.clearRect(0, 0, w, h);
      },
    };
  })();

  /* ---------- Data ---------- */

  async function getWeather(lat, lon) {
    const p = new URLSearchParams({
      latitude: lat.toFixed(3),
      longitude: lon.toFixed(3),
      current: "precipitation,rain,showers,snowfall,weather_code,temperature_2m,apparent_temperature,wind_speed_10m",
      minutely_15: "precipitation",
      forecast_minutely_15: "12",
      timezone: "auto",
      timeformat: "unixtime",
      temperature_unit: IMPERIAL ? "fahrenheit" : "celsius",
      wind_speed_unit: IMPERIAL ? "mph" : "kmh",
    });
    const r = await fetch("https://api.open-meteo.com/v1/forecast?" + p);
    if (!r.ok) throw new Error("Weather request failed: " + r.status);
    return r.json();
  }

  async function reverseName(lat, lon) {
    try {
      const p = new URLSearchParams({ latitude: lat, longitude: lon, localityLanguage: "en" });
      const r = await fetch("https://api.bigdatacloud.net/data/reverse-geocode-client?" + p);
      if (!r.ok) return null;
      const j = await r.json();
      const town = j.city || j.locality;
      return [town, j.countryName].filter(Boolean).join(", ") || null;
    } catch {
      return null;
    }
  }

  async function geocode(name) {
    const p = new URLSearchParams({ name, count: "1", language: "en", format: "json" });
    const r = await fetch("https://geocoding-api.open-meteo.com/v1/search?" + p);
    if (!r.ok) throw new Error("Geocoding failed: " + r.status);
    const j = await r.json();
    const g = j.results && j.results[0];
    if (!g) return null;
    return { lat: g.latitude, lon: g.longitude, name: [g.name, g.country].filter(Boolean).join(", ") };
  }

  /* ---------- Deciding things ---------- */

  // WMO weather codes: https://open-meteo.com/en/docs
  function classify(c) {
    const code = c.weather_code;
    const wet = (c.rain || 0) + (c.showers || 0);
    if ([95, 96, 99].includes(code)) return "storm";
    if ([56, 57, 66, 67].includes(code)) return "freezing";
    if ([71, 73, 75, 77, 85, 86].includes(code) && wet < 0.1) return "snow";
    if ([51, 53, 55].includes(code)) return "drizzle";
    if ([61, 63, 65, 80, 81, 82].includes(code)) {
      return code === 65 || code === 82 || wet >= 4 ? "heavy" : "rain";
    }
    if (wet >= 0.1) return "rain";
    if ((c.snowfall || 0) > 0) return "snow";
    return "no";
  }

  function fmtWait(sec) {
    const m = Math.max(5, Math.round(sec / 60 / 5) * 5);
    if (m < 60) return `about ${m} minutes`;
    if (m < 90) return "about an hour";
    return `about ${Math.round(m / 60)} hours`;
  }

  // Each minutely_15 value is the total for the 15 minutes *ending* at its timestamp.
  function forecastLine(raining, slots, now) {
    if (!slots.length) return "";
    if (raining) {
      const dry = slots.find((s, i) => i > 0 && s.p < 0.1);
      if (!dry) return "And it's not stopping for at least two hours. Settle in.";
      return `Should ease off in ${fmtWait(dry.t - 900 - now)}.`;
    }
    const wet = slots.find((s) => s.p >= 0.1);
    if (!wet) return "";
    const wait = wet.t - 900 - now;
    if (wait <= 600) return "But it's about to. Brace.";
    return `But it might in ${fmtWait(wait)}. Just saying.`;
  }

  /* ---------- Rendering ---------- */

  function show(state, answer, quip, aside = "", kind = "") {
    els.body.dataset.state = state;
    els.body.dataset.kind = kind;
    els.answer.textContent = answer;
    els.quip.textContent = quip;
    els.aside.textContent = aside;
    const theme = getComputedStyle(els.body).getPropertyValue("--bg").trim();
    document.querySelector('meta[name="theme-color"]').content = theme;
  }

  function setLoading(msg = "Looking out the window.") {
    rain.stop();
    show("loading", "Checking…", msg);
    els.more.hidden = true;
    els.retry.hidden = true;
    els.form.hidden = true;
    collapse();
  }

  function askForPlace(msg) {
    rain.stop();
    show("unknown", "Dunno.", msg, "Tell me where you are and I'll have a look.");
    document.title = "Is It Raining?";
    els.more.hidden = true;
    els.retry.hidden = true;
    els.form.hidden = false;
    els.input.focus();
  }

  function showError() {
    rain.stop();
    show("unknown", "Hmm.", "Couldn't reach the weather people. Try a window?");
    els.more.hidden = true;
    els.retry.hidden = false;
    els.form.hidden = true;
  }

  function render(wx, name, pretend) {
    const c = wx.current;
    const kind = pretend || classify(c);
    const now = c.time;
    const m = wx.minutely_15 || { time: [], precipitation: [] };
    const slots = m.time
      .map((t, i) => ({ t, p: m.precipitation[i] || 0 }))
      .filter((s) => s.t > now)
      .slice(0, 8);

    const raining = kind !== "no" && kind !== "snow";
    const answer = raining ? "Yes." : "No.";
    show(raining ? "yes" : kind === "snow" ? "snow" : "no", answer, pick(QUIPS[kind]), forecastLine(raining, slots, now), kind);
    document.title = `${answer} — Is It Raining?`;

    if (raining) rain.start(kind);
    else rain.stop();

    fillDetails(c, wx.current_units, slots, name);
    els.form.hidden = true;
    els.retry.hidden = true;
    els.more.hidden = false;
  }

  function fillDetails(c, units, slots, name) {
    const t = (v) => `${Math.round(v)}°`;
    $("#d-place").textContent = name || "Wherever you are";
    $("#d-temp").textContent = t(c.temperature_2m);
    $("#d-feels").textContent = t(c.apparent_temperature);
    $("#d-wind").textContent = `${Math.round(c.wind_speed_10m)} ${units.wind_speed_10m}`;
    $("#d-precip").textContent = `${(c.precipitation || 0).toFixed(1)} mm`;

    const bars = $("#d-bars");
    bars.replaceChildren();
    const max = Math.max(1, ...slots.map((s) => s.p));
    for (const s of slots) {
      const b = document.createElement("div");
      b.style.height = `${(s.p / max) * 100}%`;
      const at = new Date(s.t * 1000).toLocaleTimeString(LANG, { hour: "2-digit", minute: "2-digit" });
      b.title = `${s.p.toFixed(1)} mm by ${at}`;
      bars.append(b);
    }
    const dry = slots.every((s) => s.p < 0.1);
    $("#d-chart-note").textContent = dry ? "— a flat line. Riveting." : "";

    const at = new Date().toLocaleTimeString(LANG, { hour: "2-digit", minute: "2-digit" });
    $("#d-meta").textContent = `Checked at ${at}. I'll check again if you come back later.`;
  }

  function collapse() {
    els.details.hidden = true;
    els.more.setAttribute("aria-expanded", "false");
    els.more.textContent = "Fine, tell me more";
  }

  /* ---------- Flow ---------- */

  let last = null;
  let checkedAt = 0;
  const params = new URLSearchParams(location.search);
  const pretend = QUIPS[params.get("pretend")] ? params.get("pretend") : null;

  async function check(loc) {
    setLoading();
    try {
      const [wx, name] = await Promise.all([
        getWeather(loc.lat, loc.lon),
        loc.name ? loc.name : reverseName(loc.lat, loc.lon),
      ]);
      last = { ...loc, name };
      checkedAt = Date.now();
      render(wx, name, pretend);
    } catch (e) {
      console.error(e);
      last = loc;
      showError();
    }
  }

  async function searchPlace(name) {
    setLoading(`Looking up ${name}.`);
    try {
      const loc = await geocode(name);
      if (!loc) return askForPlace(`Never heard of “${name}”. Try somewhere else.`);
      check(loc);
    } catch (e) {
      console.error(e);
      showError();
    }
  }

  function locate() {
    if (params.has("lat") && params.has("lon")) {
      return check({ lat: +params.get("lat"), lon: +params.get("lon") });
    }
    if (params.get("q")) return searchPlace(params.get("q"));
    if (!("geolocation" in navigator)) {
      return askForPlace("Your browser won't tell me where you are.");
    }
    setLoading("Working out where you are.");
    navigator.geolocation.getCurrentPosition(
      (p) => check({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (err) =>
        askForPlace(
          err.code === 1
            ? "You didn't let me see where you are. Fair enough."
            : "Couldn't work out where you are."
        ),
      { timeout: 12000, maximumAge: 10 * 60 * 1000 }
    );
  }

  els.more.addEventListener("click", () => {
    const open = els.details.hidden;
    els.details.hidden = !open;
    els.more.setAttribute("aria-expanded", String(open));
    els.more.textContent = open ? "Okay, that's plenty" : "Fine, tell me more";
  });

  els.retry.addEventListener("click", () => (last ? check(last) : locate()));

  els.elsewhere.addEventListener("click", () => {
    collapse();
    els.more.hidden = true;
    els.form.hidden = false;
    els.input.value = "";
    els.input.focus();
  });

  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = els.input.value.trim();
    if (q) searchPlace(q);
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && last && Date.now() - checkedAt > 10 * 60 * 1000) check(last);
  });

  locate();
})();
