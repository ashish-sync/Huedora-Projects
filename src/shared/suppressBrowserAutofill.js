import { useEffect } from 'react';

const LOGIN_AUTOCOMPLETE = new Set(['username', 'current-password', 'new-password']);
/** Chrome respects this token and skips login/password save prompts on business forms. */
const BUSINESS_AUTOCOMPLETE = 'one-time-code';

function isLoginContext(el) {
  return Boolean(el.closest('[data-allow-autocomplete="login"]'));
}

function shouldPatchInput(input) {
  if (isLoginContext(input)) return false;
  const type = String(input.type || 'text').toLowerCase();
  if (type === 'password') {
    const ac = String(input.getAttribute('autocomplete') || '').toLowerCase();
    return !LOGIN_AUTOCOMPLETE.has(ac);
  }
  if (type === 'hidden' || type === 'checkbox' || type === 'radio' || type === 'file') {
    return false;
  }
  const ac = String(input.getAttribute('autocomplete') || '').toLowerCase();
  if (LOGIN_AUTOCOMPLETE.has(ac)) return false;
  return true;
}

function ensureFormDecoy(form) {
  if (form.querySelector('[data-autofill-decoy]')) return;
  const decoy = document.createElement('input');
  decoy.type = 'password';
  decoy.setAttribute('data-autofill-decoy', 'true');
  decoy.setAttribute('autocomplete', 'new-password');
  decoy.tabIndex = -1;
  decoy.setAttribute('aria-hidden', 'true');
  Object.assign(decoy.style, {
    position: 'absolute',
    opacity: '0',
    width: '0',
    height: '0',
    pointerEvents: 'none',
  });
  form.prepend(decoy);
}

function patchInputElement(el) {
  if (!shouldPatchInput(el)) return;
  if (el.dataset.autofillPatched === '1') return;
  el.dataset.autofillPatched = '1';

  const type = String(el.type || 'text').toLowerCase();
  if (type === 'email') {
    el.type = 'text';
    el.setAttribute('inputmode', 'email');
    el.setAttribute('autocapitalize', 'none');
  }

  el.setAttribute('autocomplete', BUSINESS_AUTOCOMPLETE);
  el.setAttribute('data-lpignore', 'true');
  el.setAttribute('data-1p-ignore', '');
  el.setAttribute('data-bwignore', '');
  el.setAttribute('data-form-type', 'other');

  if (!el.readOnly && !el.disabled) {
    el.setAttribute('readonly', 'readonly');
    el.addEventListener(
      'focus',
      () => {
        el.removeAttribute('readonly');
      },
      { once: true }
    );
  }
}

/** Prevent password managers from treating business forms as login/sign-up flows. */
export function patchAutofillElements(root) {
  if (!root) return;

  root.querySelectorAll('form').forEach((form) => {
    if (form.dataset.allowAutocomplete === 'login') return;
    form.setAttribute('autocomplete', 'off');
    form.setAttribute('data-form-type', 'other');
    ensureFormDecoy(form);
  });

  root.querySelectorAll('input, textarea, select').forEach(patchInputElement);
}

export function useSuppressBrowserAutofill(containerRef) {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;

    const run = () => patchAutofillElements(root);
    run();

    const observer = new MutationObserver(run);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['type'] });
    return () => observer.disconnect();
  }, [containerRef]);
}

export const PASSWORD_MANAGER_IGNORE = {
  autoComplete: BUSINESS_AUTOCOMPLETE,
  readOnly: true,
  onFocus: (event) => {
    event.currentTarget.removeAttribute('readonly');
  },
  'data-lpignore': 'true',
  'data-1p-ignore': '',
  'data-bwignore': '',
  'data-form-type': 'other',
};
