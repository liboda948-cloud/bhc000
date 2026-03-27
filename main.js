const app = document.getElementById("app");

const registry = (() => {
  if (!window.__spaModules) window.__spaModules = Object.create(null);
  return window.__spaModules;
})();

const getRoute = () => {
  const raw = window.location.hash || "#/";
  if (!raw.startsWith("#/")) return "/";
  const path = raw.slice(1);
  return path || "/";
};

const setRoute = (path) => {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  window.location.hash = `#${normalized}`;
};

const isInternalNav = (href) => typeof href === "string" && href.startsWith("#/");

const updateActiveNav = () => {
  const route = getRoute().split("?")[0];
  const navRoute = route === "/project" ? "/work" : route;
  const links = Array.from(document.querySelectorAll(".topbar-link"));
  links.forEach((link) => {
    const href = link.getAttribute("href") || "";
    const isHome = navRoute === "/" && (href === "#/" || href === "#");
    const isMatch = href === `#${navRoute}`;
    if (isHome || isMatch) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
};

const renderLoading = () => {
  if (!app) return;
  app.innerHTML = `<section class="view view-loading" aria-label="加载中"><div class="container"><p class="loading">加载中…</p></div></section>`;
};

const renderError = (message, retry) => {
  if (!app) return;
  const safe = message || "模块加载失败";
  app.innerHTML = `
    <section class="view view-error" aria-label="加载失败">
      <div class="container">
        <h1 class="error-title">加载失败</h1>
        <p class="error-desc">${safe}</p>
        <button class="button button-primary" type="button" id="retryBtn">重试</button>
        <a class="button" href="#/">返回封面</a>
      </div>
    </section>
  `;
  const btn = document.getElementById("retryBtn");
  if (btn) btn.addEventListener("click", retry);
};

function createParticleController(canvas) {
  if (!(canvas instanceof HTMLCanvasElement)) return null;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return null;

  const prefersReduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let raf = 0;
  let width = 1;
  let height = 1;
  let dpr = 1;
  let token = 0;
  let particles = [];
  let targets = [];
  let pointerX = 0;
  let pointerY = 0;
  let pointerActive = false;
  let pointerDown = false;
  let time = 0;
  let lastMoveAt = 0;
  let mode = "hero";
  let enabled = true;

  const off = document.createElement("canvas");
  const offCtx = off.getContext("2d", { willReadFrequently: true });
  if (!offCtx) return null;

  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const gaussian = () => Math.random() + Math.random() + Math.random() + Math.random() - 2;
  const TAU = Math.PI * 2;

  const ribbonAt = (u, v, t) => {
    const tt = ((u + t * 0.00008) % 1 + 1) % 1;
    const a1 = tt * TAU;
    const a2 = tt * TAU * 2.0 + 1.1;

    const cx = width * (0.60 + 0.26 * Math.sin(a1));
    const cy = height * (0.52 + 0.30 * Math.sin(a2));

    const eps = 0.0022;
    const tt2 = ((tt + eps) % 1 + 1) % 1;
    const b1 = tt2 * TAU;
    const b2 = tt2 * TAU * 2.0 + 1.1;
    const cx2 = width * (0.60 + 0.26 * Math.sin(b1));
    const cy2 = height * (0.52 + 0.30 * Math.sin(b2));

    let dx = cx2 - cx;
    let dy = cy2 - cy;
    const len = Math.max(0.001, Math.hypot(dx, dy));
    dx /= len;
    dy /= len;
    const nx = -dy;
    const ny = dx;

    const thickness = 28 + 12 * Math.sin(a1 * 1.8 + v * 0.8);
    const jitter = 3.5;
    const ox = v * thickness + gaussian() * jitter;
    const x = cx + nx * ox;
    const y = cy + ny * ox;
    const z = Math.sin(a2 + v * 1.4) * 240 + v * 220 + Math.sin(a1 + v * 0.8) * 120;

    return { x, y, z };
  };

  const buildTargets = () => {
    const scale = clamp(window.devicePixelRatio || 1, 1, 1.5);
    const w = Math.floor(width * scale);
    const h = Math.floor(height * scale);
    off.width = w;
    off.height = h;
    offCtx.setTransform(1, 0, 0, 1, 0, 0);
    offCtx.clearRect(0, 0, w, h);

    const pad = Math.floor(w * 0.08);
    const fontSize = clamp(Math.floor(Math.min(w, h) * 0.22), 84, 220);
    offCtx.fillStyle = "#ffffff";
    offCtx.textBaseline = "middle";
    offCtx.textAlign = "left";
    offCtx.font = `600 ${fontSize}px Inter, Arial, sans-serif`;

    const text = "BHC";
    const x = pad;
    const y = Math.floor(h * 0.44);
    offCtx.fillText(text, x, y);

    const img = offCtx.getImageData(0, 0, w, h).data;
    const step = clamp(Math.floor(fontSize / 22), 4, 10);
    const candidates = [];
    for (let yy = 0; yy < h; yy += step) {
      for (let xx = 0; xx < w; xx += step) {
        const a = img[(yy * w + xx) * 4 + 3];
        if (a < 16) continue;
        candidates.push({ x: xx / scale, y: yy / scale });
      }
    }

    const area = width * height;
    const maxPoints = clamp(Math.floor(area / 380), 1600, 6500);
    const ribbonKeep = clamp(Math.floor(maxPoints * 0.7), 1100, 5200);
    const textKeep = mode === "hero" ? Math.max(0, Math.min(candidates.length, maxPoints - ribbonKeep)) : 0;

    const pickRandom = (arr, count) => {
      const out = [];
      for (let i = 0; i < count; i += 1) {
        const idx = Math.floor(Math.random() * arr.length);
        out.push(arr[idx]);
        arr[idx] = arr[arr.length - 1];
        arr.pop();
        if (arr.length === 0) break;
      }
      return out;
    };

    const chosenText = pickRandom(candidates, textKeep).map((p) => ({
      kind: "text",
      x: p.x,
      y: p.y,
      z: rand(-120, 120),
    }));

    const chosenRibbon = Array.from({ length: ribbonKeep }, () => ({
      kind: "ribbon",
      u: Math.random(),
      v: clamp(gaussian() * 0.9, -1.6, 1.6),
    }));

    targets = chosenText.concat(chosenRibbon);
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    dpr = clamp(window.devicePixelRatio || 1, 1, 1.5);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildTargets();
    const count = targets.length;
    particles = Array.from({ length: count }, (_, i) => {
      const t = targets[i];
      const isRibbon = t && t.kind === "ribbon";
      const pos = isRibbon ? ribbonAt(t.u, t.v, 0) : { x: t.x, y: t.y, z: t.z };
      return {
        kind: isRibbon ? "ribbon" : "text",
        x: rand(0, width),
        y: rand(0, height),
        z: rand(-320, 320),
        vx: 0,
        vy: 0,
        vz: 0,
        tx: pos.x,
        ty: pos.y,
        tz: pos.z,
        u: isRibbon ? t.u : null,
        v: isRibbon ? t.v : 0,
        r: rand(0.95, 2.25),
        a: rand(0.22, 0.8),
        s: rand(0, TAU),
      };
    });

    const ambientCount = clamp(Math.floor((width * height) / 5200), 260, 1200);
    const ambient = Array.from({ length: ambientCount }, () => ({
      kind: "ambient",
      x: rand(0, width),
      y: rand(0, height),
      z: rand(-520, 220),
      vx: rand(-0.16, 0.16),
      vy: rand(-0.16, 0.16),
      vz: rand(-0.08, 0.08),
      tx: 0,
      ty: 0,
      tz: 0,
      u: null,
      v: 0,
      r: rand(0.55, 1.2),
      a: rand(0.08, 0.28),
      s: rand(0, TAU),
    }));

    const fogCount = clamp(Math.floor((width * height) / 22000), 44, 140);
    const fog = Array.from({ length: fogCount }, () => ({
      kind: "fog",
      x: rand(0, width),
      y: rand(0, height),
      z: rand(-820, -160),
      vx: rand(-0.08, 0.08),
      vy: rand(-0.08, 0.08),
      vz: rand(-0.04, 0.04),
      tx: 0,
      ty: 0,
      tz: 0,
      u: null,
      v: 0,
      r: rand(10, 26),
      a: rand(0.015, 0.06),
      s: rand(0, TAU),
    }));

    particles = particles.concat(fog, ambient);
  };

  const toLocalPointer = () => {
    const rect = canvas.getBoundingClientRect();
    return { x: pointerX - rect.left, y: pointerY - rect.top };
  };

  const onMove = (event) => {
    pointerActive = true;
    pointerX = event.clientX;
    pointerY = event.clientY;
    lastMoveAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  };

  const onLeave = () => {
    pointerActive = false;
  };

  const onDown = (event) => {
    pointerDown = true;
    pointerActive = true;
    pointerX = event.clientX;
    pointerY = event.clientY;
    lastMoveAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  };

  const onUp = () => {
    pointerDown = false;
  };

  const onTouchMove = (event) => {
    const t = event.touches && event.touches[0];
    if (!t) return;
    pointerActive = true;
    pointerX = t.clientX;
    pointerY = t.clientY;
    lastMoveAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  };

  const onTouchStart = (event) => {
    const t = event.touches && event.touches[0];
    if (!t) return;
    pointerDown = true;
    pointerActive = true;
    pointerX = t.clientX;
    pointerY = t.clientY;
    lastMoveAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  };

  const onTouchEnd = () => {
    pointerDown = false;
    pointerActive = false;
  };

  const draw = () => {
    ctx.clearRect(0, 0, width, height);

    const cx = width * 0.52;
    const cy = height * 0.48;
    const focal = 620;
    const { x: px, y: py } = toLocalPointer();

    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const influence = pointerActive && now - lastMoveAt < 1200 ? 1 : 0;
    const repelRadius = Math.min(360, Math.max(160, Math.floor(Math.min(width, height) * 0.28)));
    const repel2 = repelRadius * repelRadius;
    const push = pointerDown ? 1.25 : 1.0;
    const idleTiltX = Math.sin(time * 0.0021) * 0.12;
    const idleTiltY = Math.cos(time * 0.0017) * 0.10;
    const tiltX = influence ? clamp((px - cx) / Math.max(1, width), -0.5, 0.5) : idleTiltX;
    const tiltY = influence ? clamp((py - cy) / Math.max(1, height), -0.5, 0.5) : idleTiltY;

    ctx.shadowBlur = 14;
    ctx.shadowColor = "rgba(255,255,255,0.32)";

    for (const p of particles) {
      p.s += 0.012;
      let tx = p.tx;
      let ty = p.ty;
      let tz = p.tz;

      if (p.kind === "fog") {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const swirl = 0.00005;
        p.vx += -dy * swirl;
        p.vy += dx * swirl;
        p.vx += Math.sin((p.y / Math.max(1, height)) * TAU + time * 0.002 + p.s) * 0.012;
        p.vy += Math.cos((p.x / Math.max(1, width)) * TAU + time * 0.002 + p.s) * 0.012;
        p.vz += Math.sin(time * 0.001 + p.s) * 0.006;
      } else if (p.kind === "ambient") {
        const dx = p.x - cx;
        const dy = p.y - cy;
        const swirl = 0.00009;
        p.vx += -dy * swirl;
        p.vy += dx * swirl;
        p.vx += Math.sin((p.y / Math.max(1, height)) * TAU + time * 0.004 + p.s) * 0.018;
        p.vy += Math.cos((p.x / Math.max(1, width)) * TAU + time * 0.003 + p.s) * 0.018;
        p.vz += Math.sin(time * 0.002 + p.s) * 0.010;
      } else if (p.u !== null) {
        const t = ribbonAt(p.u, p.v, time);
        tx = t.x;
        ty = t.y;
        tz = t.z;
        p.tx = tx;
        p.ty = ty;
        p.tz = tz;
      } else {
        const wobble = Math.sin(p.s + time * 0.003) * 12;
        const wobble2 = Math.cos(p.s * 1.4 + time * 0.002) * 9;
        tx += wobble;
        ty += wobble2;
        tz += Math.sin(p.s + time * 0.001) * 50;
      }

      if (p.kind !== "ambient" && p.kind !== "fog") {
        const ax = (tx - p.x) * 0.012;
        const ay = (ty - p.y) * 0.012;
        const az = (tz - p.z) * 0.010;

        p.vx = (p.vx + ax) * 0.88;
        p.vy = (p.vy + ay) * 0.88;
        p.vz = (p.vz + az) * 0.88;
      } else {
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.vz *= 0.985;
      }

      if (influence) {
        const dx = p.x - px;
        const dy = p.y - py;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.001 && d2 < repel2) {
          const d = Math.sqrt(d2);
          const f = (1 - d / repelRadius) * 2.2 * push;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
          p.vz += f * 2.6;
        }
      }

      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;

      if (p.kind === "ambient") {
        if (p.x < -40) p.x = width + 40;
        if (p.x > width + 40) p.x = -40;
        if (p.y < -40) p.y = height + 40;
        if (p.y > height + 40) p.y = -40;
        if (p.z < -700) p.z = 240;
        if (p.z > 260) p.z = -620;
      } else if (p.kind === "fog") {
        if (p.x < -80) p.x = width + 80;
        if (p.x > width + 80) p.x = -80;
        if (p.y < -80) p.y = height + 80;
        if (p.y > height + 80) p.y = -80;
        if (p.z < -980) p.z = -120;
        if (p.z > 120) p.z = -920;
      }

      const rx = (p.x - cx) * (1 + tiltX * 0.08) + cx;
      const ry = (p.y - cy) * (1 + tiltY * 0.08) + cy;
      const z = p.z + tiltX * 180 + tiltY * 140;
      const s = focal / (focal + z);
      const sx = cx + (rx - cx) * s;
      const sy = cy + (ry - cy) * s;

      let alpha = clamp(p.a * (0.55 + s * 0.72), 0.02, 0.95);
      if (p.kind === "ribbon") alpha = clamp(alpha * 1.35, 0.08, 1);
      if (p.kind === "text") alpha = clamp(alpha * 1.05, 0.06, 0.95);
      if (p.kind === "ambient") alpha = clamp(alpha * 0.9, 0.03, 0.35);
      if (p.kind === "fog") alpha = clamp(alpha * 0.7, 0.01, 0.12);

      let r = clamp(p.r * (0.58 + s * 1.2), 0.6, 2.9);
      if (p.kind === "fog") r = clamp(p.r * (0.9 + s * 0.7), 6, 34);

      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      if (p.kind === "fog") {
        ctx.shadowBlur = 42;
        ctx.shadowColor = "rgba(255,255,255,0.22)";
      } else {
        ctx.shadowBlur = 14;
        ctx.shadowColor = "rgba(255,255,255,0.32)";
      }
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
  };

  const step = () => {
    const currentToken = token;
    time += 1;
    draw();
    if (token !== currentToken) return;
    raf = window.requestAnimationFrame(step);
  };

  const stop = () => {
    token += 1;
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
    ctx.clearRect(0, 0, width, height);
  };

  const start = () => {
    token += 1;
    resize();
    if (!enabled) {
      ctx.clearRect(0, 0, width, height);
      return;
    }
    if (prefersReduced) {
      time = 0;
      draw();
      return;
    }
    raf = window.requestAnimationFrame(step);
  };

  start();

  window.addEventListener("resize", start);
  window.addEventListener("mousemove", onMove, { passive: true });
  window.addEventListener("mouseleave", onLeave, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchend", onTouchEnd, { passive: true });

  const setMode = (nextMode) => {
    if (nextMode === "off") {
      if (!enabled) return;
      enabled = false;
      stop();
      return;
    }

    enabled = true;
    const normalized = nextMode === "hero" ? "hero" : "background";
    if (mode === normalized && raf) return;
    mode = normalized;
    start();
  };

  const destroy = () => {
    token += 1;
    if (raf) window.cancelAnimationFrame(raf);
    window.removeEventListener("resize", start);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseleave", onLeave);
    window.removeEventListener("pointerdown", onDown);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchend", onTouchEnd);
  };

  return { setMode, destroy };
}

const particleController = (() => {
  const canvas = document.getElementById("bgParticles");
  if (!(canvas instanceof HTMLCanvasElement)) return null;
  return createParticleController(canvas);
})();

const renderHome = ({ mount }) => {
  mount.innerHTML = `
    <section class="landing view" aria-label="主页面">
      <div class="landing-shell">
        <div class="landing-copy">
          <h1 class="landing-title">BHC.</h1>
          <p class="landing-sub">VISUAL COMMUNICATION DESIGN</p>
          <div class="landing-row">
            <p class="landing-caption">留白即内容 · Minimal, but precise.</p>
            <span class="landing-arrow" aria-hidden="true">→</span>
          </div>
          <p class="landing-small">进入作品集</p>
          <a class="landing-button" href="#/work">WORK</a>
        </div>
      </div>
    </section>
  `;
  return null;
};

const encodePath = (path) => {
  try {
    return encodeURI(path);
  } catch {
    return path;
  }
};

const IMAGE_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%221200%22%20height=%22900%22%20viewBox=%220%200%201200%20900%22%3E%3Crect%20width=%221200%22%20height=%22900%22%20fill=%22%23121214%22/%3E%3Crect%20x=%2270%22%20y=%2270%22%20width=%221060%22%20height=%22760%22%20rx=%2248%22%20fill=%22none%22%20stroke=%22%23ffffff%22%20stroke-opacity=%220.10%22%20stroke-width=%223%22/%3E%3C/svg%3E";

const createTaskQueue = (limit = 2) => {
  let active = 0;
  const pending = [];

  const runNext = () => {
    if (active >= limit) return;
    const task = pending.shift();
    if (!task) return;
    active += 1;
    Promise.resolve()
      .then(task)
      .catch(() => {})
      .finally(() => {
        active -= 1;
        runNext();
      });
  };

  return (task) => {
    pending.push(task);
    runNext();
  };
};

const loadImgInto = async (imgEl, src) => {
  const temp = new Image();
  temp.decoding = "async";
  temp.src = src;
  try {
    if (typeof temp.decode === "function") await temp.decode();
  } catch {}
  imgEl.src = src;
  imgEl.classList.add("is-loaded");
  imgEl.removeAttribute("data-src");
};

const setupLazyImages = (mount) => {
  const imgs = Array.from(mount.querySelectorAll("img[data-src]")).filter((el) => el instanceof HTMLImageElement);
  if (imgs.length === 0) return () => {};

  const enqueue = createTaskQueue(2);
  let stopped = false;

  const requestLoad = (img) => {
    const src = img.getAttribute("data-src");
    if (!src) return;
    if (!img.classList.contains("is-loading")) img.classList.add("is-loading");

    enqueue(async () => {
      if (stopped) return;
      const current = img.getAttribute("data-src");
      if (!current) return;
      await loadImgInto(img, current);
      img.classList.remove("is-loading");
    });
  };

  imgs
    .sort((a, b) => (a.getAttribute("data-priority") === "high" ? -1 : 1) - (b.getAttribute("data-priority") === "high" ? -1 : 1))
    .forEach((img) => requestLoad(img));

  return () => {
    stopped = true;
  };
};

const works = [
  {
    title: "针对于盲人的智能调味瓶设计",
    tag: "Product / 工业设计",
    desc: "以可触知信息与交互反馈为核心，提升无障碍使用体验。",
    images: [
      "./针对于盲人的智能调味瓶设计/p1.jpg",
      "./针对于盲人的智能调味瓶设计/p2.jpg",
      "./针对于盲人的智能调味瓶设计/p3.jpg",
      "./针对于盲人的智能调味瓶设计/p4.jpg",
      "./针对于盲人的智能调味瓶设计/p5.jpg",
      "./针对于盲人的智能调味瓶设计/p6.jpg",
    ],
  },
  {
    title: "“稻野原香”大米包装设计",
    tag: "Packaging / 包装",
    desc: "以主视觉与信息层级统一包装体系，强化货架识别。",
    images: [
      "./“稻野原香”大米包装设计/米1.jpg",
      "./“稻野原香”大米包装设计/米2.jpg",
      "./“稻野原香”大米包装设计/米3.jpg",
      "./“稻野原香”大米包装设计/米4.jpg",
      "./“稻野原香”大米包装设计/米5.jpg",
    ],
  },
  {
    title: "松辞白酒包装设计",
    tag: "Packaging / 白酒",
    desc: "以材质与版式秩序建立高级克制的品牌气质。",
    images: [
      "./松辞白酒包装设计/酒1.jpg",
      "./松辞白酒包装设计/酒2.jpg",
      "./松辞白酒包装设计/酒3.jpg",
      "./松辞白酒包装设计/酒4.jpg",
      "./松辞白酒包装设计/酒5.jpg",
    ],
  },
  {
    title: "仙玉叶茶叶包装设计",
    tag: "Packaging / 茶叶",
    desc: "在低饱和中建立质感对比，突出品牌识别与信息层级。",
    images: ["./仙玉叶茶叶包装设计/茶1.jpg", "./仙玉叶茶叶包装设计/茶2.jpg", "./仙玉叶茶叶包装设计/茶3.jpg", "./仙玉叶茶叶包装设计/茶4.jpg"],
  },
  {
    title: "悠悠酸奶包装设计",
    tag: "Packaging / 食品",
    desc: "以简洁信息架构与主视觉统一系列包装表达。",
    images: ["./悠悠酸奶包装设计/奶1.png", "./悠悠酸奶包装设计/奶2.jpg", "./悠悠酸奶包装设计/奶3.jpg"],
  },
];

const renderAbout = ({ mount }) => {
  mount.innerHTML = `
    <section class="section about view" aria-label="关于我">
      <div class="container about-wrap">
        <div class="about-grid">
          <div class="about-titlecol">
            <p class="about-kicker">ABOUT</p>
            <h2 class="about-title">诠释更好的包装。</h2>
          </div>
          <div class="about-copy">
            <p class="about-paragraph">
              我专注于包装与品牌视觉方向，偏好以系统化的方法处理信息层级、版式秩序与系列化延展。对“绿色包装”更敏感：在材料选择、结构减量、可回收标识与使用路径上，把可持续从概念转为可执行的设计细节。
            </p>
            <p class="about-paragraph">
              在“智能包装”层面，我更关注交互与可读性：用更清晰的视觉规范承载溯源信息、使用提示与反馈机制，让包装不仅好看，更能在真实场景中降低理解成本、提升使用体验与品牌信任。
            </p>
          </div>
        </div>

        <div class="about-divider" role="separator" aria-hidden="true"></div>

        <div class="about-grid">
          <div class="about-titlecol">
            <h2 class="about-title">绿色 × 智能，是新的包装语言。</h2>
          </div>
          <div class="about-copy">
            <p class="about-paragraph">
              我相信好的包装需要同时满足三件事：货架识别、信息效率、与可持续落地。通过统一的视觉系统把复杂信息变得更易读；通过结构与材质策略减少不必要的消耗；通过数字化提示让每一次开封、取用、保存都更顺畅。
            </p>
          </div>
        </div>
      </div>
    </section>
  `;

  return null;
};

const renderContact = ({ mount }) => {
  const year = String(new Date().getFullYear());

  mount.innerHTML = `
    <footer class="footer view" aria-label="联系方式">
      <div class="container footer-inner">
        <div class="footer-head">
          <h2 class="section-title">CONTACT</h2>
          <p class="section-desc">保持简洁的联系路径：邮箱优先，其次社交链接与PDF。</p>
        </div>
        <div class="footer-body">
          <a class="footer-link" href="mailto:3341366511@qq.com">3341366511@qq.com</a>
          <a class="footer-link" href="https://www.xiaohongshu.com/user/profile/4273133583" target="_blank" rel="noreferrer">小红书：4273133583</a>
          <a class="footer-link" href="https://www.instagram.com/" target="_blank" rel="noreferrer">Instagram</a>
          <a class="button button-primary" href="./portfolio.pdf" download>下载 PDF</a>
        </div>
      </div>
      <div class="container footer-bottom">
        <p class="fineprint">© ${year}</p>
        <p class="fineprint">Built with restraint.</p>
      </div>
    </footer>
  `;

  return null;
};

const renderNotFound = ({ mount }) => {
  mount.innerHTML = `
    <section class="view view-error" aria-label="页面不存在">
      <div class="container">
        <h1 class="error-title">404</h1>
        <p class="error-desc">页面不存在</p>
        <a class="button button-primary" href="#/">返回封面</a>
      </div>
    </section>
  `;
  return null;
};

const getProjectIndexFromHash = () => {
  const raw = window.location.hash || "";
  const qIndex = raw.indexOf("?");
  if (qIndex < 0) return null;
  const query = raw.slice(qIndex + 1);
  const params = new URLSearchParams(query);
  const i = Number(params.get("i"));
  return Number.isFinite(i) ? i : null;
};

const renderWork = ({ mount, navigate }) => {
  mount.innerHTML = `
    <section class="section works view" aria-label="作品展示">
      <div class="container">
        <div class="section-head">
          <h2 class="section-title">WORK</h2>
        </div>
        <div class="works-grid" role="list">
          ${works
            .map((w, idx) => {
              const cover = w.images[0] ? encodePath(w.images[0]) : "";
              const title = w.title.replaceAll('"', "&quot;");
              const tag = w.tag.replaceAll('"', "&quot;");
              const priority = idx < 3 ? "high" : "low";
              return `
                <article class="work" role="listitem" tabindex="0" aria-label="打开作品：${title}" data-index="${idx}">
                  <figure class="work-media" aria-hidden="true">
                    <img class="work-image" alt="${title} 封面" loading="lazy" decoding="async" src="${IMAGE_PLACEHOLDER}" data-src="${cover}" data-priority="${priority}" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%221200%22%20height=%22900%22%20viewBox=%220%200%201200%20900%22%3E%3Crect%20width=%221200%22%20height=%22900%22%20fill=%22%23121214%22/%3E%3Crect%20x=%2270%22%20y=%2270%22%20width=%221060%22%20height=%22760%22%20rx=%2248%22%20fill=%22none%22%20stroke=%22%23ffffff%22%20stroke-opacity=%220.12%22%20stroke-width=%223%22/%3E%3Ctext%20x=%2260%22%20y=%22480%22%20fill=%22%23ffffff%22%20fill-opacity=%220.45%22%20font-family=%22Inter,Arial%22%20font-size=%2244%22%20letter-spacing=%226%22%3EIMAGE%20MISSING%3C/text%3E%3C/svg%3E';" />
                  </figure>
                  <div class="work-overlay">
                    <p class="work-tag">${tag}</p>
                    <h3 class="work-title">${title}</h3>
                    <p class="work-desc">点击查看</p>
                  </div>
                </article>
              `;
            })
            .join("")}
          <article class="work" data-coming-soon="true" tabindex="0" role="listitem" aria-label="尽请期待">
            <figure class="work-media" aria-hidden="true" style="display: flex; align-items: center; justify-content: center; background: var(--n-1);">
              <p style="margin: 0; color: var(--muted-2); font-size: 14px; letter-spacing: 0.2em; text-align: center;">尽请期待<br><br>COMING SOON</p>
            </figure>
            <div class="work-overlay">
              <p class="work-tag">Coming Soon</p>
              <h3 class="work-title">更多作品正在筹备中</h3>
              <p class="work-desc">Stay tuned</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  `;

  const onClickWork = (event) => {
    const card = event.target instanceof Element ? event.target.closest(".work") : null;
    if (!card) return;
    if (card.hasAttribute("data-coming-soon")) {
      alert("更多作品正在筹备中，敬请期待！");
      return;
    }
    const idx = Number(card.getAttribute("data-index"));
    if (!Number.isFinite(idx) || !works[idx]) return;
    if (typeof navigate === "function") navigate(`/project?i=${idx}`);
  };

  const onKeyOpen = (event) => {
    if (!(event.target instanceof Element)) return;
    const card = event.target.closest(".work");
    if (!card) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (card.hasAttribute("data-coming-soon")) {
      alert("更多作品正在筹备中，敬请期待！");
      return;
    }
    const idx = Number(card.getAttribute("data-index"));
    if (!Number.isFinite(idx) || !works[idx]) return;
    if (typeof navigate === "function") navigate(`/project?i=${idx}`);
  };

  mount.addEventListener("click", onClickWork);
  mount.addEventListener("keydown", onKeyOpen);
  const cleanupLazy = setupLazyImages(mount);

  return () => {
    mount.removeEventListener("click", onClickWork);
    mount.removeEventListener("keydown", onKeyOpen);
    cleanupLazy();
  };
};

const renderProject = ({ mount }) => {
  const idx = getProjectIndexFromHash();
  if (!Number.isFinite(idx) || !works[idx]) {
    return renderNotFound({ mount });
  }
  const work = works[idx];
  const title = (work.title || "").replaceAll('"', "&quot;");
  const tag = (work.tag || "").replaceAll('"', "&quot;");
  const images = Array.isArray(work.images) ? work.images : [];
  const hero = images[0] ? encodePath(images[0]) : "";

  mount.innerHTML = `
    <section class="section project view" aria-label="作品详情">
      <div class="container project-head">
        <a class="project-back" href="#/work">← 返回</a>
        <h1 class="project-title">${title}</h1>
        <p class="project-tag">${tag}</p>
      </div>

      <div class="project-hero">
        <img class="project-hero-image" alt="${title} 主图" loading="eager" decoding="async" src="${IMAGE_PLACEHOLDER}" data-src="${hero}" data-priority="high" />
      </div>

      <div class="container project-body">
        <div class="project-info">
          <div class="project-meta">
            <p class="meta-label">作品名称</p>
            <p class="meta-value">${title}</p>
            <p class="meta-label">作品类别</p>
            <p class="meta-value">${tag}</p>
          </div>
          <div class="project-desc">
            <p class="desc-title">项目介绍</p>
            <p class="desc-text">${work.desc || ""}</p>
          </div>
        </div>

        <div class="project-gallery" aria-label="作品展示">
          ${images
            .map((src, i) => {
              const url = encodePath(src);
              const priority = i <= 1 ? "high" : "low";
              return `<figure class="project-shot"><img class="project-image" alt="${title} 图${i + 1}" loading="lazy" decoding="async" src="${IMAGE_PLACEHOLDER}" data-src="${url}" data-priority="${priority}" /></figure>`;
            })
            .join("")}
        </div>
      </div>
    </section>
  `;

  window.scrollTo(0, 0);
  const cleanupLazy = setupLazyImages(mount);
  return () => {
    cleanupLazy();
  };
};

registry["/"] = renderHome;
registry["/work"] = renderWork;
registry["/project"] = renderProject;
registry["/about"] = renderAbout;
registry["/contact"] = renderContact;
registry["/notfound"] = renderNotFound;

let cleanup = null;
let currentRoute = null;

const renderRoute = async () => {
  if (!app) return;

  const full = getRoute();
  const route = full.split("?")[0];
  currentRoute = route;
  updateActiveNav();
  const noParticles = route === "/project" || route.startsWith("/project") || route === "/about" || route.startsWith("/about");
  document.documentElement.classList.toggle("no-particles", noParticles);
  if (particleController) particleController.setMode(noParticles ? "off" : route === "/" ? "hero" : "background");

  if (cleanup) {
    try {
      cleanup();
    } catch {}
    cleanup = null;
  }

  if (route === "/") {
    cleanup = renderHome({ mount: app, route, navigate: setRoute }) || null;
    app.focus();
    return;
  }

  renderLoading();

  try {
    const mod = registry[route] || registry["/notfound"];
    if (typeof mod !== "function") throw new Error("模块入口缺失");
    cleanup = mod({ mount: app, route, navigate: setRoute }) || null;
    app.focus();
  } catch (e) {
    if (currentRoute !== route) return;
    const msg = e instanceof Error ? e.message : String(e);
    renderError(msg, () => renderRoute());
  }
};

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const link = target?.closest("a");
  if (!link) return;
  const href = link.getAttribute("href");
  if (!isInternalNav(href)) return;
  event.preventDefault();
  setRoute(href.slice(1));
});

window.addEventListener("hashchange", renderRoute);

if (!window.location.hash) setRoute("/");
renderRoute();
