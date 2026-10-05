/* ==========================================================================
   app.js
   Responsible for: building the steps from questions.js, wiring events,
   progress bar, and the "comment" alert.
   ========================================================================== */

let finalReached = false;
let totalSteps = 1; // number of steps after the first one (used for progress %)

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  renderSteps();
  renderAlert();
  initEscapeButton();
  initAnswerNavigation();
  document.addEventListener('stepchange', (e) => updateProgress(e.detail.stepEl));
  updateProgress(document.querySelector('.step.active'));

  // best-effort: warn before closing/leaving the final page until a message was sent
  window.addEventListener('beforeunload', (e) => {
    if (finalReached && !messageSent) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  document.addEventListener('stepchange', (e) => {
    if (e.detail.stepEl.querySelector('.message-box')) finalReached = true;
  });
}

/** Small helper: create an element with optional class and text. */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Flatten LEVELS into one ordered list of steps (intro / question / final). */
function buildSequence() {
  const seq = [];
  LEVELS.forEach((level, li) => {
    if (level.intro) {
      seq.push({ type: 'intro', intro: level.intro });
    }
    level.questions.forEach((item, qi) => {
      seq.push({
        type: 'question',
        item,
        label: `اللفل ${li + 1} · ${qi + 1} / ${level.questions.length}`,
      });
    });
  });
  seq.push({ type: 'final' });
  return seq;
}

function renderSteps() {
  const container = document.getElementById('steps');
  const sequence = buildSequence();
  totalSteps = Math.max(sequence.length - 1, 1);

  sequence.forEach((entry, i) => {
    const section = el('section', i === 0 ? 'step active' : 'step');
    section.id = `step-${i + 1}`;
    section.dataset.index = i;

    const nextId = `step-${i + 2}`;
    const content = el('div', 'content');

    if (entry.type === 'intro') buildIntro(content, entry.intro, nextId);
    else if (entry.type === 'question') buildQuestion(content, entry, nextId);
    else buildFinal(content);

    section.appendChild(content);
    container.appendChild(section);
  });
}

function buildIntro(content, intro, nextId) {
  content.classList.add('level-intro');
  content.appendChild(el('h1', 'question level-title', intro.title));
  if (intro.subtitle) content.appendChild(el('p', 'level-sub', intro.subtitle));

  const answers = el('div', 'answers');
  const go = el('button', 'answer-btn yes-btn', intro.button || 'يلا');
  go.type = 'button';
  go.dataset.next = nextId;
  answers.appendChild(go);
  content.appendChild(answers);
}

function buildQuestion(content, entry, nextId) {
  const { item } = entry;
  content.appendChild(el('p', 'counter', entry.label));
  content.appendChild(el('h1', 'question', item.q));

  // text-input question: the answer is emailed via Formspree, then we move on
  if (item.input) {
    content.appendChild(buildInputQuestion(item, nextId));
    return;
  }

  // multiple-choice question (no escaping button): every choice goes to the next step
  if (Array.isArray(item.choices)) {
    const answers = el('div', 'answers');
    item.choices.forEach((c) => {
      const b = el('button', 'answer-btn yes-btn choice-btn', c.text);
      b.type = 'button';
      b.dataset.next = nextId;
      if (c.comment) b.dataset.comment = c.comment;
      answers.appendChild(b);
    });
    content.appendChild(answers);
    return;
  }

  const yesBtn = el('button', 'answer-btn yes-btn', item.yes);
  yesBtn.type = 'button';
  yesBtn.dataset.next = nextId;
  if (item.comment) yesBtn.dataset.comment = item.comment;

  const noBtn = el('button', 'answer-btn no-btn', item.no);
  noBtn.type = 'button';

  const answers = el('div', 'answers');
  (item.noFirst ? [noBtn, yesBtn] : [yesBtn, noBtn]).forEach((b) => answers.appendChild(b));
  content.appendChild(answers);
}

/** Question answered in a textarea: must be delivered before moving on. */
function buildInputQuestion(item, nextId) {
  const cfg = item.input;
  const wrap = el('div', 'message-box');

  const input = el('textarea', 'message-input');
  input.rows = 3;
  input.maxLength = 500;
  input.placeholder = cfg.placeholder || '';
  input.setAttribute('aria-label', cfg.placeholder || item.q);

  const send = el('button', 'answer-btn yes-btn message-send', cfg.button || 'ابعتي 💌');
  send.type = 'button';

  const status = el('p', 'message-status');
  status.setAttribute('role', 'status');

  send.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }

    send.disabled = true;
    send.textContent = cfg.sending || 'ثانية واحدة...';
    status.textContent = '';
    status.classList.remove('is-error');

    try {
      const res = await postToForm({
        question: item.q,
        message: text,
        _subject: 'إجابة جديدة من لعبة الرخامة 🍵',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      input.disabled = true;
      if (item.comment) showAlert(item.comment, () => nextStep(nextId));
      else nextStep(nextId);
    } catch (err) {
      console.error('answer send failed:', err);
      send.disabled = false;
      send.textContent = cfg.button || 'ابعتي 💌';
      status.textContent = cfg.error || 'حصلت مشكلة، جربي تاني.';
      status.classList.add('is-error');
    }
  });

  wrap.append(input, send, status);
  return wrap;
}

/** Sends data to Formspree (arrives in your email). Returns the fetch promise. */
function postToForm(data, options = {}) {
  return fetch(CONFIG.formEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
    ...options,
  });
}

let messageSent = false; // true only after Formspree confirmed the message

function buildFinal(content) {
  content.appendChild(el('h1', 'question', FINAL_STEP.title));

  const buttons = [];
  const hint = el('p', 'message-status final-hint', FINAL_STEP.lockedHint);
  const result = el('p', 'message-status final-result');
  result.setAttribute('role', 'status');

  function unlockButtons() {
    messageSent = true;
    hint.hidden = true;
    buttons.forEach((b) => {
      b.classList.remove('is-disabled');
      b.setAttribute('aria-disabled', 'false');
    });
  }

  if (FINAL_STEP.messageBox) content.appendChild(buildMessageBox(FINAL_STEP.messageBox, unlockButtons));
  content.appendChild(hint);

  const answers = el('div', 'answers');
  FINAL_STEP.links.forEach((link) => {
    const btn = el('button', 'answer-btn d-block yes-btn is-disabled', link.text);
    btn.type = 'button';
    btn.setAttribute('aria-disabled', 'true');
    btn.addEventListener('click', () => {
      // locked until a message was actually delivered
      if (!messageSent) {
        hint.hidden = false;
        const input = content.querySelector('.message-input');
        if (input) input.focus();
        return;
      }
      if (btn.dataset.done) return;

      buttons.forEach((b) => {
        b.dataset.done = '1';
        b.classList.add('is-disabled');
        b.setAttribute('aria-disabled', 'true');
      });
      if (link.notify) {
        postToForm(
          { message: link.notify, _subject: 'ضغطة جديدة في لعبة الرخامة 🍵' },
          { keepalive: true }
        ).catch(() => {});
      }
      result.textContent = FINAL_STEP.afterLink;

      // لو الزرار له لينك، افتحه (في تاب جديدة، ولو المتصفح منعها يفتحه في نفس التاب)
      if (link.url) {
        const win = window.open(link.url, '_blank');
        if (!win) window.location.href = link.url;
      }
    });
    buttons.push(btn);
    answers.appendChild(btn);
  });
  content.appendChild(answers);
  content.appendChild(result);
}

/** Textarea + send button: posts the text to Formspree (arrives in your email). */
function buildMessageBox(cfg, onSent) {
  const wrap = el('div', 'message-box');

  const input = el('textarea', 'message-input');
  input.rows = 3;
  input.maxLength = 500;
  input.placeholder = cfg.placeholder;
  input.setAttribute('aria-label', cfg.placeholder);

  const send = el('button', 'answer-btn yes-btn message-send', cfg.button);
  send.type = 'button';

  const status = el('p', 'message-status');
  status.setAttribute('role', 'status');

  send.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }

    send.disabled = true;
    send.textContent = cfg.sending;
    status.textContent = '';
    status.classList.remove('is-error');

    try {
      const res = await postToForm({ message: text, _subject: 'رسالة جديدة من لعبة الرخامة 🍵' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      input.value = '';
      input.disabled = true;
      send.hidden = true;
      status.textContent = cfg.sent;
      if (onSent) onSent();
    } catch (err) {
      console.error('message send failed:', err);
      send.disabled = false;
      send.textContent = cfg.button;
      status.textContent = cfg.error;
      status.classList.add('is-error');
    }
  });

  wrap.append(input, send, status);
  return wrap;
}

/* ---------------------------- Alert ---------------------------- */

let alertOnClose = null;

function renderAlert() {
  const overlay = el('div', 'alert-overlay');
  overlay.id = 'alert-overlay';
  overlay.hidden = true;

  const box = el('div', 'alert-box');
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'alert-text');

  const text = el('p', 'alert-text');
  text.id = 'alert-text';

  const ok = el('button', 'answer-btn yes-btn alert-ok', 'ماشي 😒');
  ok.type = 'button';
  ok.addEventListener('click', closeAlert);

  box.append(text, ok);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) closeAlert();
  });
}

function showAlert(message, onClose) {
  const overlay = document.getElementById('alert-overlay');
  document.getElementById('alert-text').textContent = message;
  alertOnClose = onClose;
  overlay.hidden = false;
  overlay.querySelector('.alert-ok').focus();
}

function closeAlert() {
  const overlay = document.getElementById('alert-overlay');
  if (overlay.hidden) return;
  overlay.hidden = true;

  const callback = alertOnClose;
  alertOnClose = null;
  if (callback) callback();
}

/* ------------------------- Navigation ------------------------- */

function initAnswerNavigation() {
  document.querySelectorAll('[data-next]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.next;
      const comment = btn.dataset.comment;

      if (comment) showAlert(comment, () => nextStep(target));
      else nextStep(target);
    });
  });
}

function updateProgress(stepEl) {
  const bar = document.getElementById('progress-bar');
  if (!bar || !stepEl) return;
  const index = Number(stepEl.dataset.index || 0);
  bar.style.width = `${Math.round((index / totalSteps) * 100)}%`;
}
