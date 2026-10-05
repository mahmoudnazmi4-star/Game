/* ==========================================================================
   steps.js
   Responsible for: transitioning between steps (show/hide + animations).
   ========================================================================== */

const STEP_LEAVE_DURATION = 350; // ms — must match .step.leaving animation length

let currentStepEl = null;
let isTransitioning = false; // blocks double-clicks mid-transition
const stepHistory = [];

function showStep(stepId) {
  if (isTransitioning) return;

  const nextStepEl = document.getElementById(stepId);
  if (!nextStepEl) {
    console.warn(`showStep: no step found with id "${stepId}"`);
    return;
  }

  if (!currentStepEl) {
    currentStepEl = document.querySelector('.step.active');
  }
  if (currentStepEl === nextStepEl) return;

  const previousStepEl = currentStepEl;
  currentStepEl = nextStepEl;

  if (!previousStepEl) {
    activateStep(nextStepEl);
    return;
  }

  isTransitioning = true;
  stepHistory.push(previousStepEl.id);
  previousStepEl.classList.add('leaving');

  window.setTimeout(() => {
    previousStepEl.classList.remove('active', 'leaving');
    activateStep(nextStepEl);
    isTransitioning = false;
  }, STEP_LEAVE_DURATION);
}

function activateStep(stepEl) {
  stepEl.classList.add('active', 'entering');
  stepEl.setAttribute('tabindex', '-1');
  stepEl.focus({ preventScroll: true });

  // lets app.js update the progress bar without steps.js knowing about it
  document.dispatchEvent(new CustomEvent('stepchange', { detail: { stepEl } }));

  window.setTimeout(() => {
    stepEl.classList.remove('entering');
  }, 600);
}

function nextStep(stepId) {
  showStep(stepId);
}

function previousStep() {
  const lastStepId = stepHistory.pop();
  if (lastStepId) showStep(lastStepId);
}
