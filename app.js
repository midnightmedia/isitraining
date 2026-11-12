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

  const rain = (() => {
    const cv = $("#rain");
    const ctx = cv.getContext("2d");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    let drops = [], raf = 0, w = 0, h = 0, running = false, flashTimer = 0;
    let look = { speed: 1, len: 1, alpha: 0.32 };

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function drop(anyY) {
      return {
        x: Math.random() * (w + 200),
        y: anyY ? Math.random() * h : -30 - Math.random() * 100,
        l: (10 + Math.random() * 20) * look.len,
        v: (9 + Math.random() * 8) * look.speed,
      };
    }
    function frame() {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = `rgba(214, 228, 240, ${look.alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of drops) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.l * 0.18, d.y + d.l);
        d.y += d.v; d.x -= d.v * 0.18;
        if (d.y > h) Object.assign(d, drop(false));
      }
      ctx.stroke();
      raf = requestAnimationFrame(frame);
    }
    function scheduleFlash() {
      flashTimer = setTimeout(() => {
        els.body.classList.remove("flash");
        void els.body.offsetWidth;
        els.body.classList.add("flash");
        scheduleFlash();
      }, 5000 + Math.random() * 9000);
    }
    addEventListener("resize", () => running && resize());

    return {
      start({ count, thunder = false, speed = 1, len = 1, alpha = 0.32 }) {
        this.stop();
        if (reduce.matches) return;
        look = { speed, len, alpha };
        running = true;
        resize();
        drops = Array.from({ length: count }, () => drop(true));
        frame();
        if (thunder) scheduleFlash();
      },
      stop() {
        running = false;
        cancelAnimationFrame(raf);
        clearTimeout(flashTimer);
        els.body.classList.remove("flash");
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

  function show(state, answer, quip, aside = "") {
    els.body.dataset.state = state;
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
    show(raining ? "yes" : kind === "snow" ? "snow" : "no", answer, pick(QUIPS[kind]), forecastLine(raining, slots, now));
    document.title = `${answer} — Is It Raining?`;

    if (raining) {
      const looks = {
        drizzle: { count: 45, speed: 0.4, len: 0.55, alpha: 0.2 },
        rain: { count: 150 },
        freezing: { count: 150 },
        heavy: { count: 280 },
        storm: { count: 280, thunder: true },
      };
      rain.start(looks[kind]);
    } else {
      rain.stop();
    }

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
