// Respected throughout this file: autonomous/decorative motion (parallax,
// spotlight, background drift, the magnetic Work-section snap, slide-up
// reveals) is gated off for users who've asked for less motion. Direct
// 1:1 responses to the user's own input (the custom cursor, :active press
// states) aren't autonomous motion and are left as-is.
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Smooth-scroll same-page anchor links (nav, hero CTAs, etc.) via JS
// instead of CSS `scroll-behavior: smooth`, which fights scroll-snap.
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;
  const id = link.getAttribute('href').slice(1);
  const target = id ? document.getElementById(id) : null;
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  history.pushState(null, '', `#${id}`);
});

// Subtle magnetic snap for the Work section: once scrolling settles, if a
// project is already close to aligned at the top, ease the rest of the way
// there. Native CSS scroll-snap has no "strength" knob and pulled from too
// far away, which felt like the page was fighting the scroll — this only
// ever nudges a short, deliberate distance, never yanks from far off.
// Skipped entirely under reduced motion: it's an auto-correction the user
// didn't ask for, and scroll position should stay exactly where they left it.
const snapScenes = [...document.querySelectorAll('.scene')];
if (snapScenes.length && !prefersReducedMotion) {
  const CAPTURE_PX = 60;
  const header = document.querySelector('.site-header');
  let snapTimer = null;

  window.addEventListener('scroll', () => {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => {
      const headerOffset = header ? header.offsetHeight : 0;
      let nearestDist = Infinity;
      snapScenes.forEach((el) => {
        const dist = el.getBoundingClientRect().top - headerOffset;
        if (Math.abs(dist) < Math.abs(nearestDist)) nearestDist = dist;
      });
      // Scroll by the exact remaining distance rather than using
      // scrollIntoView, which aligns to the viewport top and ignores the
      // sticky header — that overshoot was hiding the project under it.
      if (Math.abs(nearestDist) > 3 && Math.abs(nearestDist) < CAPTURE_PX) {
        window.scrollTo({ top: window.scrollY + nearestDist, behavior: 'smooth' });
      }
    }, 140);
  }, { passive: true });
}

// Reveal sections as they enter the viewport. Under reduced motion this
// keeps only a short opacity fade — no slide — per the "gentler
// equivalent, not nothing" rule for scroll-triggered motion.
const revealTargets = document.querySelectorAll('.fact, .contact-link, .scene-content, .scene-media, .scene-text');

revealTargets.forEach((el) => {
  el.style.opacity = '0';
  if (prefersReducedMotion) {
    el.style.transition = 'opacity 0.3s ease';
  } else {
    el.style.transform = 'translateY(14px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  }
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      if (!prefersReducedMotion) entry.target.style.transform = 'translateY(0)';
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

revealTargets.forEach((el) => observer.observe(el));

// Header background intensifies on scroll (rAF-throttled, like every other
// scroll listener below, and toggled as a class so the transition lives in
// CSS instead of being reset via inline styles on every scroll tick).
const header = document.querySelector('.site-header');
let headerTicking = false;
window.addEventListener('scroll', () => {
  if (!headerTicking) {
    requestAnimationFrame(() => {
      header.classList.toggle('is-scrolled', window.scrollY > 20);
      headerTicking = false;
    });
    headerTicking = true;
  }
}, { passive: true });

// Blueprint grid background drifts gently as you scroll. The grid element
// only overscans its edges by a fixed amount (see .grain's `inset` in
// style.css), so the drift must be clamped well within that buffer —
// otherwise on a long page it eventually slides past its own edge and
// exposes bare background underneath.
const grid = document.querySelector('.grain');
let gridTicking = false;
if (grid && !prefersReducedMotion) {
  const clamp = (n, max) => Math.max(-max, Math.min(max, n));
  window.addEventListener('scroll', () => {
    if (!gridTicking) {
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dx = clamp(y * 0.02, 12);
        const dy = clamp(y * 0.06, 36);
        grid.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
        gridTicking = false;
      });
      gridTicking = true;
    }
  }, { passive: true });
}

// Spotlight that follows the pointer, illuminating the grid behind content.
// Opaque cards paint over this layer, so they never appear "lit".
const spotlight = document.querySelector('.spotlight');
if (spotlight && !prefersReducedMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  let spotlightTicking = false;
  let pendingX = 0;
  let pendingY = 0;

  window.addEventListener('mousemove', (e) => {
    pendingX = e.clientX;
    pendingY = e.clientY;
    if (!spotlightTicking) {
      requestAnimationFrame(() => {
        spotlight.style.setProperty('--sx', `${pendingX}px`);
        spotlight.style.setProperty('--sy', `${pendingY}px`);
        spotlight.classList.add('is-active');
        spotlightTicking = false;
      });
      spotlightTicking = true;
    }
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    spotlight.classList.remove('is-active');
  });
}

// Section labels/eyebrow get a short accent tick that draws in on scroll
const tickTargets = document.querySelectorAll('.section-label, .eyebrow');
const tickObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      tickObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.4 });
tickTargets.forEach((el) => tickObserver.observe(el));

// Scroll-linked parallax: elements with [data-parallax] drift at a
// different rate than the page scroll, for a sense of depth.
const parallaxTargets = [...document.querySelectorAll('[data-parallax]')].map((el) => ({
  el,
  img: el.tagName === 'IMG' ? el : el.querySelector('img'),
  strength: parseFloat(el.dataset.parallaxStrength) || 40,
}));

let parallaxTicking = false;
function updateParallax() {
  const viewportH = window.innerHeight;
  parallaxTargets.forEach(({ el, img, strength }) => {
    const target = img || el;
    const rect = el.getBoundingClientRect();
    // progress: -1 when section is fully below viewport, 0 centered, 1 fully above
    const progress = (viewportH - rect.top) / (viewportH + rect.height) - 0.5;
    target.style.transform = `translate3d(0, ${(progress * strength).toFixed(1)}px, 0) scale(1.12)`;
  });
  parallaxTicking = false;
}
if (parallaxTargets.length && !prefersReducedMotion) {
  updateParallax();
  window.addEventListener('scroll', () => {
    if (!parallaxTicking) {
      requestAnimationFrame(updateParallax);
      parallaxTicking = true;
    }
  }, { passive: true });
  window.addEventListener('resize', updateParallax);
}

// Custom cursor: a small ring that follows the pointer and swells over
// clickable elements. Only on devices with a real mouse.
const cursor = document.getElementById('customCursor');
if (cursor && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.documentElement.classList.add('has-custom-cursor');

  let cursorX = -100;
  let cursorY = -100;
  window.addEventListener('mousemove', (e) => {
    cursorX = e.clientX;
    cursorY = e.clientY;
    cursor.style.setProperty('--cx', `${cursorX}px`);
    cursor.style.setProperty('--cy', `${cursorY}px`);
    cursor.classList.add('is-active');
  }, { passive: true });

  document.addEventListener('mouseleave', () => cursor.classList.remove('is-active'));
  document.addEventListener('mousedown', () => cursor.classList.add('is-down'));
  document.addEventListener('mouseup', () => cursor.classList.remove('is-down'));

  const hoverables = 'a, button';
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest(hoverables)) cursor.classList.add('is-hover');
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest(hoverables)) cursor.classList.remove('is-hover');
  });

  // Scrolling (including the magnetic snap) moves content under a
  // stationary pointer, which fires neither mousemove nor mouseout — the
  // cursor could grow while hovering a link and then get stuck large after
  // scrolling away from it without the mouse itself moving. Re-derive the
  // hover state from what's actually under the pointer whenever the page
  // settles from a scroll.
  let cursorScrollTimer = null;
  window.addEventListener('scroll', () => {
    clearTimeout(cursorScrollTimer);
    cursorScrollTimer = setTimeout(() => {
      const atPoint = document.elementFromPoint(cursorX, cursorY);
      cursor.classList.toggle('is-hover', !!(atPoint && atPoint.closest(hoverables)));
    }, 120);
  }, { passive: true });
}
