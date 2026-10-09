(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SVG = "http://www.w3.org/2000/svg";

  /* ---------- smooth, weighted scrolling ---------- */

  let lenis = null;
  if (window.Lenis && !reduceMotion) {
    lenis = new window.Lenis({
      lerp: 0.075,          // lower = slower, silkier glide
      wheelMultiplier: 0.9,
      smoothWheel: true,
    });
    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }

  // in-page links glide to their section instead of jumping
  document.querySelectorAll('a[href^="#"]:not(.skip)').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      const target = id === "#top" ? document.body : document.querySelector(id);
      if (!lenis || !target) return;
      e.preventDefault();
      lenis.scrollTo(id === "#top" ? 0 : target, {
        offset: id === "#top" ? 0 : -80,
        duration: 1.8,
        easing: (t) => 1 - Math.pow(1 - t, 4),
      });
      history.replaceState(null, "", id);
    });
  });

  /* ---------- rosette: a 12-point star like the carved door in the portrait ---------- */

  const pt = (r, deg) => {
    const a = (deg * Math.PI) / 180;
    return [+(r * Math.cos(a)).toFixed(3), +(r * Math.sin(a)).toFixed(3)];
  };

  // star polygon {n/k} on radius r, rotated by `rot` degrees
  const star = (n, k, r, rot = 0) => {
    const pts = [];
    let i = 0;
    do {
      pts.push(pt(r, rot - 90 + (360 / n) * i));
      i = (i + k) % n;
    } while (i !== 0);
    return "M" + pts.map((p) => p.join(" ")).join("L") + "Z";
  };

  const make = (tag, attrs) => {
    const el = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };

  function buildRosette(svg, baseDelay = 0) {
    const g = make("g", { class: "rosette__spin" });
    const layers = [
      { tag: "circle", attrs: { r: 97, class: "r-stone" } },
      { tag: "path", attrs: { d: star(12, 5, 92), class: "r-cedar" } },
      { tag: "circle", attrs: { r: 70, class: "r-stone" } },
      { tag: "path", attrs: { d: star(12, 5, 58, 15), class: "r-cedar" } },
      { tag: "path", attrs: { d: star(6, 2, 34), class: "r-stone" } },
      { tag: "path", attrs: { d: star(6, 2, 34, 30), class: "r-stone" } },
      { tag: "circle", attrs: { r: 15, class: "r-cedar" } },
    ];

    // spokes tie the outer and inner stars together
    let spokes = "";
    for (let i = 0; i < 12; i++) {
      const a = pt(58, i * 30 - 75);
      const b = pt(92, i * 30 - 75);
      spokes += `M${a.join(" ")}L${b.join(" ")}`;
    }
    layers.splice(4, 0, { tag: "path", attrs: { d: spokes, class: "r-stone" } });

    layers.forEach((layer, i) => {
      const el = make(layer.tag, { ...layer.attrs, pathLength: 1 });
      el.style.setProperty("--d", `${baseDelay + i * 0.18}s`);
      g.appendChild(el);
    });

    // small blooms at the outer star tips
    for (let i = 0; i < 12; i++) {
      const [x, y] = pt(92, i * 30 - 90);
      const dot = make("circle", { cx: x, cy: y, r: 1.3, class: "r-dot" });
      dot.style.setProperty("--d", `${baseDelay + 1.6 + i * 0.05}s`);
      g.appendChild(dot);
    }
    svg.appendChild(g);
  }

  const heroRosette = document.getElementById("rosette");
  if (heroRosette) buildRosette(heroRosette, 0.2);

  // contact rosette draws when it scrolls into view
  document.querySelectorAll("[data-rosette]").forEach((svg) => {
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        buildRosette(svg, 0.1);
        io.disconnect();
      }
    }, { threshold: 0.2 });
    io.observe(svg);
  });

  // gentle parallax on the hero rosette
  const visual = document.getElementById("heroVisual");
  if (visual && heroRosette && !reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const tick = () => {
      cx += (tx - cx) * 0.06;
      cy += (ty - cy) * 0.06;
      heroRosette.style.transform = `translate(${cx}px, ${cy}px)`;
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.1 ? requestAnimationFrame(tick) : 0;
    };
    window.addEventListener("pointermove", (e) => {
      tx = (e.clientX / window.innerWidth - 0.5) * -24;
      ty = (e.clientY / window.innerHeight - 0.5) * -24;
      if (!raf) raf = requestAnimationFrame(tick);
    });
  }

  /* ---------- hero name: split into letters ---------- */

  document.querySelectorAll(".split").forEach((el, line) => {
    const text = el.textContent;
    el.textContent = "";
    [...text].forEach((ch, i) => {
      const span = document.createElement("span");
      span.className = "ch";
      span.textContent = ch;
      span.style.setProperty("--i", line * 4 + i);
      el.appendChild(span);
    });
  });

  /* ---------- scroll reveal ---------- */

  const revealEls = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

    // stagger siblings that enter together (skill rows, entries)
    revealEls.forEach((el) => {
      const siblings = [...el.parentElement.children].filter((c) => c.hasAttribute("data-reveal"));
      const idx = siblings.indexOf(el);
      if (siblings.length > 2) el.style.setProperty("--rd", `${Math.min(idx, 6) * 0.07}s`);
      io.observe(el);
    });
  } else {
    revealEls.forEach((el) => el.classList.add("is-in"));
  }

  /* ---------- nav: solid on scroll, hide on scroll down, progress, active link ---------- */

  const nav = document.getElementById("nav");
  const progress = document.getElementById("progress");
  const links = document.getElementById("navLinks");
  const toggle = document.getElementById("navToggle");
  let lastY = window.scrollY;
  const heroText = document.querySelector(".hero__text");
  const wide = window.matchMedia("(min-width: 961px)");

  const onScroll = () => {
    const y = window.scrollY;

    // hero layers drift apart as you leave it — the photo lags behind the text
    if (!reduceMotion && wide.matches && y < window.innerHeight * 1.2) {
      heroText.style.transform = `translate3d(0, ${y * -0.08}px, 0)`;
      heroText.style.opacity = String(Math.max(0, 1 - y / (window.innerHeight * 0.9)));
      if (visual) visual.style.transform = `translate3d(0, ${y * 0.12}px, 0)`;
    }

    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    nav.classList.toggle("is-solid", y > 20);
    const menuOpen = links.classList.contains("is-open");
    nav.classList.toggle("is-hidden", !menuOpen && y > lastY && y > 400);
    lastY = y;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const navAnchors = [...links.querySelectorAll("a")];
  const sections = navAnchors.map((a) => document.querySelector(a.getAttribute("href")));
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navAnchors.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${entry.target.id}`));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => s && spy.observe(s));

  const closeMenu = () => {
    links.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "Menu";
  };
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = open ? "Close" : "Menu";
  });
  navAnchors.forEach((a) => a.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (e) => e.key === "Escape" && closeMenu());

  /* ---------- live previews: scale a 1440px-wide page into its frame ---------- */

  const previews = document.querySelectorAll("[data-preview]");
  const ro = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.style.setProperty("--s", entry.contentRect.width / 1440);
    });
  });
  previews.forEach((p) => ro.observe(p));

  /* ---------- copy email ---------- */

  const toast = document.getElementById("toast");
  let toastTimer;
  const showToast = (msg) => {
    toast.textContent = msg;
    toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-on"), 2200);
  };

  const copyBtn = document.getElementById("copyEmail");
  copyBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(copyBtn.dataset.email);
      showToast("Email copied");
    } catch {
      showToast(copyBtn.dataset.email);
    }
  });
})();
