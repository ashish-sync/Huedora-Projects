import { useEffect } from 'react';

const LOGIN_AUTOCOMPLETE = new Set(['username', 'current-password', 'new-password']);

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
  const ac = String(input.getAttribute('autocomplete') || '').toLowerCase();
  if (LOGIN_AUTOCOMPLETE.has(ac)) return false;
  return true;
}

/** Prevent password managers from treating business forms as login/sign-up flows. */
export function patchAutofillElements(root) {
  if (!root) return;

  root.querySelectorAll('form').forEach((form) => {
    if (form.dataset.allowAutocomplete === 'login') return;
    form.setAttribute('autocomplete', 'off');
    form.setAttribute('data-form-type', 'other');
  });

  root.querySelectorAll('input, textarea, select').forEach((el) => {
    if (!shouldPatchInput(el)) return;
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('data-lpignore', 'true');
    el.setAttribute('data-1p-ignore', '');
    el.setAttribute('data-bwignore', '');
    el.setAttribute('data-form-type', 'other');
  });
}

export function useSuppressBrowserAutofill(containerRef) {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;

    const run = () => patchAutofillElements(root);
    run();

    const observer = new MutationObserver(run);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [containerRef]);
}

export const PASSWORD_MANAGER_IGNORE = {
  autoComplete: 'off',
  'data-lpignore': 'true',
  'data-1p-ignore': '',
  'data-bwignore': '',
  'data-form-type': 'other',
};
