/* ==========================================================================
   escape-button.js
   Responsible for: the runaway "no" button behavior only.
   Every element with class "no-btn" gets it automatically.
   ========================================================================== */

const ESCAPE_SAFE_PADDING = 24; // px — distance kept from screen edges
const ESCAPE_YES_GAP = 16;      // px — distance kept from the "yes" button

const lastPositionByButton = new WeakMap();

function initEscapeButton() {
  document.querySelectorAll('.no-btn').forEach(bindEscapeBehavior);
}

function bindEscapeBehavior(btn) {
  // Desktop: run as soon as the mouse gets close
  btn.addEventListener('mouseenter', () => moveButton(btn));

  // Mobile: run before the tap can land
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    moveButton(btn);
  }, { passive: false });

  // Safety net (also covers keyboard Enter/Space): a click never does anything
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    moveButton(btn);
  });

  window.addEventListener('resize', () => {
    if (btn.style.position === 'fixed') keepButtonInsideViewport(btn);
  });
}

function moveButton(btn) {
  // First move: take the button out of the flow, keeping its exact size/place
  if (btn.style.position !== 'fixed') {
    const rect = btn.getBoundingClientRect();
    btn.style.width = `${rect.width}px`; // otherwise width:100% on mobile = full screen
    btn.style.position = 'fixed';
    btn.style.left = `${rect.left}px`;
    btn.style.top = `${rect.top}px`;
    btn.style.margin = '0';
    btn.getBoundingClientRect(); // force reflow so the first move animates
  }

  const next = getRandomPosition(btn, lastPositionByButton.get(btn) || null);

  btn.style.transition = 'left var(--transition-base), top var(--transition-base)';
  btn.style.left = `${next.x}px`;
  btn.style.top = `${next.y}px`;

  lastPositionByButton.set(btn, next);
}

/** True if a button placed at (x, y) would cover a "yes" button of the same step. */
function overlapsYesButton(btn, x, y) {
  const step = btn.closest('.step');
  if (!step) return false;
  const w = btn.offsetWidth;
  const h = btn.offsetHeight;

  return Array.from(step.querySelectorAll('.yes-btn')).some((yes) => {
    const r = yes.getBoundingClientRect();
    return (
      x < r.right + ESCAPE_YES_GAP &&
      x + w > r.left - ESCAPE_YES_GAP &&
      y < r.bottom + ESCAPE_YES_GAP &&
      y + h > r.top - ESCAPE_YES_GAP
    );
  });
}

function getRandomPosition(btn, avoid) {
  const w = btn.offsetWidth;
  const h = btn.offsetHeight;

  const minX = ESCAPE_SAFE_PADDING;
  const minY = ESCAPE_SAFE_PADDING;
  const maxX = Math.max(window.innerWidth - w - ESCAPE_SAFE_PADDING, minX);
  const maxY = Math.max(window.innerHeight - h - ESCAPE_SAFE_PADDING, minY);

  let x;
  let y;
  let attempts = 0;

  do {
    x = Math.round(minX + Math.random() * (maxX - minX));
    y = Math.round(minY + Math.random() * (maxY - minY));
    attempts += 1;
  } while (
    attempts < 25 &&
    (overlapsYesButton(btn, x, y) ||
      (avoid && Math.abs(x - avoid.x) < w && Math.abs(y - avoid.y) < h))
  );

  return { x, y };
}

function keepButtonInsideViewport(btn) {
  const maxX = window.innerWidth - btn.offsetWidth - ESCAPE_SAFE_PADDING;
  const maxY = window.innerHeight - btn.offsetHeight - ESCAPE_SAFE_PADDING;

  const left = parseFloat(btn.style.left) || 0;
  const top = parseFloat(btn.style.top) || 0;

  btn.style.left = `${Math.min(Math.max(left, ESCAPE_SAFE_PADDING), Math.max(maxX, ESCAPE_SAFE_PADDING))}px`;
  btn.style.top = `${Math.min(Math.max(top, ESCAPE_SAFE_PADDING), Math.max(maxY, ESCAPE_SAFE_PADDING))}px`;
}
