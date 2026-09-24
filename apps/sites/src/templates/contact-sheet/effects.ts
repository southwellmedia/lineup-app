// Contact Sheet interactions. Vanilla TS; every block is optional, so a
// section switched off in the editor just skips its behavior.

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) =>
  r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) =>
  Array.from(r.querySelectorAll<T>(s));
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Nav: frosted once you scroll; full-screen menu on phones. */
const nav = $("[data-nav]");
const onScrollNav = () => nav?.classList.toggle("scrolled", window.scrollY > 24);
window.addEventListener("scroll", onScrollNav, { passive: true });
onScrollNav();

const menuBtn = $<HTMLButtonElement>("[data-menu-btn]");
const menu = $("[data-menu]");
const setMenu = (open: boolean) => {
  if (!menuBtn || !menu) return;
  menuBtn.setAttribute("aria-expanded", String(open));
  menu.hidden = !open;
  document.body.style.overflow = open ? "hidden" : "";
};
menuBtn?.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
menu?.addEventListener("click", (e) => {
  if ((e.target as HTMLElement).closest("a,button")) setMenu(false);
});

/* Darkroom develop: photos below the fold start washed out and develop in view. */
if ("IntersectionObserver" in window && !reduced) {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.remove("undeveloped");
        io.unobserve(en.target);
      }),
    { rootMargin: "0px 0px -12% 0px" },
  );
  $$(".develop").forEach((el) => {
    if (el.getBoundingClientRect().top > window.innerHeight) {
      el.classList.add("undeveloped");
      io.observe(el);
    }
  });
}

/* A gentle parallax drift on prints, desktop only. */
const drifters = $$("[data-parallax]");
if (!reduced && drifters.length && window.matchMedia("(min-width: 901px)").matches) {
  let ticking = false;
  const update = () => {
    const vh = window.innerHeight;
    drifters.forEach((el) => {
      const r = el.getBoundingClientRect();
      const offset = r.top + r.height / 2 - vh / 2;
      const d = Math.max(-40, Math.min(40, -offset * Number(el.dataset.parallax || 0)));
      el.style.setProperty("--drift", `${d.toFixed(1)}px`);
    });
    ticking = false;
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

/* Loupe: magnifies the About portrait under the pointer; rests on the upper third. */
const frame = $("[data-loupe-frame]");
const loupe = $("[data-loupe]");
const loupeImg = $<HTMLImageElement>("[data-loupe-img]");
if (frame && loupe && loupeImg) {
  const ZOOM = 2.3;
  const place = (fx: number, fy: number) => {
    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    const nw = loupeImg.naturalWidth || fw;
    const nh = loupeImg.naturalHeight || fh;
    const s = Math.max(fw / nw, fh / nh);
    const rw = nw * s;
    const rh = nh * s;
    const ox = (fw - rw) * 0.5;
    const oy = (fh - rh) * 0.32;
    const size = loupe.offsetWidth;
    loupe.style.setProperty("--lx", `${fx}px`);
    loupe.style.setProperty("--ly", `${fy}px`);
    loupe.style.backgroundSize = `${rw * ZOOM}px ${rh * ZOOM}px`;
    loupe.style.backgroundPosition = `${-((fx - ox) * ZOOM - size / 2)}px ${-((fy - oy) * ZOOM - size / 2)}px`;
  };
  const rest = () => place(frame.clientWidth * 0.55, frame.clientHeight * 0.35);
  if (loupeImg.complete) rest();
  else loupeImg.addEventListener("load", rest);
  window.addEventListener("resize", rest);
  if (window.matchMedia("(hover: hover)").matches) {
    frame.addEventListener("pointermove", (e) => {
      const r = frame.getBoundingClientRect();
      loupe.classList.add("tracking");
      place(
        Math.max(0, Math.min(r.width, e.clientX - r.left)),
        Math.max(0, Math.min(r.height, e.clientY - r.top)),
      );
    });
    frame.addEventListener("pointerleave", () => {
      loupe.classList.remove("tracking");
      rest();
    });
  }
}

/* The service sheet: circle one cut plus any add-ons, then book them together. */
const sheet = $("[data-sheet]");
if (sheet) {
  const buttons = $$<HTMLButtonElement>("[data-service]", sheet);
  const picked = $("[data-picked]", sheet);
  const empty = $("[data-empty]", sheet);
  const needsMain = $("[data-needs-main]", sheet);
  const totalEl = $("[data-total]", sheet);
  const durEl = $("[data-duration]", sheet);
  const choose = $<HTMLAnchorElement>("[data-choose-time]", sheet);
  const base = sheet.dataset.bookBase ?? "";

  const selected = new Set(
    buttons.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.service!),
  );
  const isAddon = (b: HTMLElement) => b.dataset.addon === "1";
  const fmtDur = (m: number) => {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return m ? `${h ? `${h} hr` : ""}${h && r ? " " : ""}${r ? `${r} min` : ""}` : "—";
  };
  const escape = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  const render = () => {
    const chosen = buttons.filter((b) => selected.has(b.dataset.service!));
    buttons.forEach((b) =>
      b.setAttribute("aria-pressed", String(selected.has(b.dataset.service!))),
    );
    if (picked) {
      picked.innerHTML = chosen
        .map(
          (b) =>
            `<li><span class="p-name">${escape(b.dataset.name ?? "")}</span><span class="p-price">${isAddon(b) ? "+" : ""}$${b.dataset.price}</span></li>`,
        )
        .join("");
    }
    const hasMain = chosen.some((b) => !isAddon(b));
    if (empty) empty.hidden = chosen.length > 0;
    if (needsMain) needsMain.hidden = chosen.length === 0 || hasMain;
    const total = chosen.reduce((sum, b) => sum + Number(b.dataset.price), 0);
    if (totalEl) {
      const next = `$${total}`;
      if (totalEl.textContent !== next && !reduced) {
        totalEl.classList.remove("bump");
        void totalEl.offsetWidth;
        totalEl.classList.add("bump");
      }
      totalEl.textContent = next;
    }
    if (durEl)
      durEl.textContent = fmtDur(chosen.reduce((sum, b) => sum + Number(b.dataset.min), 0));
    if (choose && base) {
      const url = new URL(base);
      if (hasMain) url.searchParams.set("service", chosen.map((b) => b.dataset.service).join(","));
      choose.href = url.toString();
      choose.setAttribute("aria-disabled", String(chosen.length > 0 && !hasMain));
    }
  };

  buttons.forEach((b) =>
    b.addEventListener("click", () => {
      const id = b.dataset.service!;
      if (selected.has(id)) selected.delete(id);
      else {
        // One main service per visit: circling another swaps it.
        if (!isAddon(b))
          buttons.filter((o) => !isAddon(o)).forEach((o) => selected.delete(o.dataset.service!));
        selected.add(id);
      }
      render();
    }),
  );
  render();
}

/* Mobile bar: hides while the footer is in view. */
const mbar = $("[data-mbar]");
const footer = $(".footer");
if (mbar && footer && "IntersectionObserver" in window) {
  new IntersectionObserver(([en]) =>
    mbar.classList.toggle("hidden-bar", Boolean(en?.isIntersecting)),
  ).observe(footer);
}
