/* ========= AOS ========= */
document.addEventListener("DOMContentLoaded", () => {
  if (window.AOS) AOS.init({ duration: 800 });
});

/* ========= Particles ========= */
document.addEventListener("DOMContentLoaded", () => {
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  // Hanya kalau TIDAK ada hash (#something) di URL → paksa ke top
  if (!location.hash) {
    // Matikan smooth-scroll sementara biar nggak "meluncur" waktu reset
    const root = document.documentElement;
    const prev = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";

    // Reset ke top pada frame berikut (pastikan layout sudah stabil)
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      // balikin setting sebelumnya
      root.style.scrollBehavior = prev || "";
    });
  }
  if (!window.particlesJS) return;
  particlesJS("particles-js", {
    particles: {
      number: { value: 80, density: { enable: true, value_area: 800 } },
      color: { value: "#39b54a" },
      shape: { type: "circle" },
      opacity: { value: 0.5, random: false },
      size: { value: 3, random: true },
      line_linked: { enable: true, distance: 150, color: "#39b54a", opacity: 0.2, width: 1 },
      move: { enable: true, speed: 2, direction: "none", random: false, straight: false, out_mode: "out", bounce: false },
    },
    interactivity: {
      detect_on: "canvas",
      events: { onhover: { enable: true, mode: "grab" }, onclick: { enable: true, mode: "push" }, resize: true },
      modes: { grab: { distance: 140, line_linked: { opacity: 0.5 } }, push: { particles_nb: 4 } },
    },
    retina_detect: true,
  });

  // Forward click di luar canvas -> push particles di posisi klik
  document.addEventListener("click", (e) => {
    const inst = window.pJSDom && window.pJSDom[0];
    if (!inst) return;
    if (e.target === inst.pJS.canvas.el || inst.pJS.canvas.el.contains(e.target)) return;
    const rect = inst.pJS.canvas.el.getBoundingClientRect();
    inst.pJS.interactivity.mouse.pos_x = e.clientX - rect.left;
    inst.pJS.interactivity.mouse.pos_y = e.clientY - rect.top;
    inst.pJS.fn.modes.pushParticles(4);
  });
});

/* ========= Navbar: bg on scroll + anti-flicker ========= */
document.addEventListener("DOMContentLoaded", () => {
  const nav = document.querySelector("nav.navbar");
  const navbarCollapse = document.getElementById("navbarNav");
  if (!nav || !navbarCollapse) return;

  const NAV_BG_THRESHOLD = 8;

  // anti-flicker first paint
  nav.classList.add("no-anim");
  requestAnimationFrame(() => requestAnimationFrame(() => nav.classList.remove("no-anim")));

  const updateNavBg = () => {
    if (window.scrollY > NAV_BG_THRESHOLD) nav.classList.add("is-scrolled");
    else if (!navbarCollapse.classList.contains("show")) nav.classList.remove("is-scrolled");
  };

  navbarCollapse.addEventListener("shown.bs.collapse", () => nav.classList.add("is-scrolled"));
  navbarCollapse.addEventListener("hidden.bs.collapse", updateNavBg);
  window.addEventListener("scroll", updateNavBg, { passive: true });
  window.addEventListener("resize", updateNavBg);
  updateNavBg();
});

/* ========= Smooth scroll + auto-close + active highlight ========= */
/* ========= Smooth scroll + auto-close + active highlight ========= */
document.addEventListener("DOMContentLoaded", () => {
  const navbarCollapse = document.getElementById("navbarNav");
  const toggler = document.querySelector(".navbar-toggler");

  const getOffset = () => {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--anchor-offset");
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 130;
  };

  const smoothScrollTo = (el) => {
    const top = el.getBoundingClientRect().top + window.pageYOffset - getOffset();
    window.scrollTo({ top, behavior: "smooth" });
  };

  // --- Hash utils ---
  const updateHash = (id, replace = false) => {
    if (typeof id !== "string") return;
    const url = new URL(location.href);
    url.hash = id ? `#${id}` : "";
    if (replace) history.replaceState(null, "", url);
    else history.pushState(null, "", url);
  };

  // Hanya sinkron hash & aktif setelah user klik/scroll
  let hashSyncEnabled = !!location.hash;

  // >>> Tambahan: threshold "masih di very top"
  const AT_TOP_THRESHOLD = 24; // px dari atas sebelum kita mulai highlight apa pun

  // Klik nav-link: tutup menu (mobile) + scroll halus + update hash
  document.querySelectorAll('.navbar .nav-link[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const id = link.getAttribute("href").slice(1);
      const target = document.getElementById(id);
      if (!target) return;

      hashSyncEnabled = true; // aktifkan sinkron & highlight
      updateHash(id, /*replace*/ false);

      const isMobile = getComputedStyle(toggler).display !== "none";
      if (isMobile) {
        const bsCollapse = bootstrap.Collapse.getOrCreateInstance(navbarCollapse);
        bsCollapse.hide();
        setTimeout(() => smoothScrollTo(target), 200);
      } else {
        smoothScrollTo(target);
      }
    });
  });

  // Custom active
  const sectionIds = ["features", "security", "download"];
  const sections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
  const linkMap = new Map(Array.from(document.querySelectorAll('.navbar .nav-link[href^="#"]')).map((a) => [a.getAttribute("href").slice(1), a]));

  const clearActive = () => {
    for (const a of linkMap.values()) {
      a.classList.remove("active");
      a.removeAttribute("aria-current");
    }
  };

  const setActive = (id) => {
    for (const [key, a] of linkMap.entries()) {
      const on = key === id;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }
    if (hashSyncEnabled && id) updateHash(id, /*replace*/ true);
  };

  const updateActive = () => {
    // >>> Jika tanpa hash & masih di very top → jangan nyalakan apa pun
    if (!hashSyncEnabled && window.scrollY <= AT_TOP_THRESHOLD) {
      clearActive();
      return;
    }

    const mid = window.innerHeight / 2;
    const off = getOffset();

    // 1) section yang melintasi garis offset
    for (const sec of sections) {
      const r = sec.getBoundingClientRect();
      if (r.top <= off && r.bottom > off) return setActive(sec.id);
    }
    // 2) fallback: terdekat dengan tengah viewport (hanya setelah user mulai)
    let best = { id: null, dist: Infinity };
    for (const sec of sections) {
      const r = sec.getBoundingClientRect();
      const center = r.top + r.height / 2;
      const dist = Math.abs(center - mid);
      if (dist < best.dist) best = { id: sec.id, dist };
    }
    if (best.id) setActive(best.id);
  };

  // Aktifkan sinkronisasi saat user mulai scroll sedikit
  const enableHashSyncOnScroll = () => {
    if (!hashSyncEnabled && window.scrollY > AT_TOP_THRESHOLD) {
      hashSyncEnabled = true;
      updateActive(); // langsung evaluasi setelah “aktif”
    }
  };
  window.addEventListener("scroll", enableHashSyncOnScroll, { passive: true });

  // Inisialisasi (tanpa menyalakan apa pun jika di very top)
  updateActive();
  window.addEventListener("scroll", updateActive, { passive: true });
  window.addEventListener("resize", updateActive);

  // Jika buka dengan hash di URL, scroll pakai offset
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) setTimeout(() => smoothScrollTo(target), 50);
  }
});

/* ========= Launch price countdown (Pro) ========= */
document.addEventListener("DOMContentLoaded", () => {
  const proCard = document.querySelector(".pricing-card.pro");
  const badge = document.getElementById("proPromoBadge");
  const nowEl = document.getElementById("proPriceNow");
  const wasEl = document.getElementById("proPriceWas");
  const cd = document.getElementById("promoCountdown");
  if (!proCard || !badge || !nowEl || !cd) return;

  // Konfigurasi jika promo berakhir:
  const NORMAL_USD = "$6.99";
  const END_ATTR = cd.getAttribute("data-ends");
  if (!END_ATTR) return;

  const endsAt = new Date(END_ATTR).getTime();
  if (Number.isNaN(endsAt)) return;

  const update = () => {
    const now = Date.now();
    const diff = Math.max(0, endsAt - now);

    if (diff <= 0) {
      // Promo selesai → set harga normal, sembunyikan badge & countdown
      proCard.classList.add("is-promo-over");
      nowEl.textContent = NORMAL_USD;
      wasEl.textContent = ""; // biar aman kalau masih ada
      badge.textContent = "BEST VALUE";
      clearInterval(timer);
      return;
    }

    // Tampilkan sisa waktu
    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / (1000 * 60)) % 60);

    const dd = cd.querySelector(".cd-days");
    const hh = cd.querySelector(".cd-hours");
    const mm = cd.querySelector(".cd-mins");
    if (dd) dd.textContent = String(d);
    if (hh) hh.textContent = String(h).padStart(2, "0");
    if (mm) mm.textContent = String(m).padStart(2, "0");
  };

  update();
  const timer = setInterval(update, 30_000); // update tiap 30 detik
});
