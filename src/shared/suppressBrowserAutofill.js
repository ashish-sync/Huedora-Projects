import { useEffect } from 'react';

const LOGIN_AUTOCOMPLETE = new Set(['username', 'current-password', 'new-password']);
/** Chrome respects this token and skips login/password save prompts on business forms. */
export const BUSINESS_AUTOCOMPLETE = 'one-time-code';

const IGNORE_DATA_ATTRS = {
  'data-lpignore': 'true',
  'data-1p-ignore': '',
  'data-bwignore': '',
  'data-form-type': 'other',
};

const CREDENTIAL_NAME_RE = /^(username|user|email|e-mail|mail|password|pass|login|signin|sign-in|phone|mobile|tel)$/i;

let patching = false;

function isLoginContext(el) {
  return Boolean(el.closest('[data-allow-autocomplete="login"]'));
}

function shouldPatchInput(input) {
  if (input.dataset.autofillBlock === '1') return false;
  if (isLoginContext(input)) return false;
  if (input.closest('.autofill-decoy-fields')) return false;
  if (input.getAttribute('data-autofill-decoy') === 'true') return false;

  const type = String(input.type || 'text').toLowerCase();
  if (type === 'password') {
    const ac = String(input.getAttribute('autocomplete') || '').toLowerCase();
    return !LOGIN_AUTOCOMPLETE.has(ac);
  }
  if (type === 'hidden' || type === 'checkbox' || type === 'radio' || type === 'file' || type === 'submit' || type === 'button') {
    return false;
  }
  const ac = String(input.getAttribute('autocomplete') || '').toLowerCase();
  if (LOGIN_AUTOCOMPLETE.has(ac)) return false;
  return true;
}

function neutralizeCredentialName(input) {
  const name = String(input.getAttribute('name') || '').trim();
  if (!name || !CREDENTIAL_NAME_RE.test(name)) return;
  if (input.dataset.credentialNameNeutralized === '1') return;
  input.dataset.credentialNameNeutralized = '1';
  input.dataset.originalInputName = name;
  input.setAttribute('name', `camp-field-${name}`);
}

function ensureFormDecoys(form) {
  if (form.querySelector('[data-autofill-decoy], .autofill-decoy-fields')) return;

  const wrap = document.createElement('div');
  wrap.className = 'autofill-decoy-fields';
  wrap.setAttribute('aria-hidden', 'true');

  const username = document.createElement('input');
  username.type = 'text';
  username.name = 'username';
  username.setAttribute('data-autofill-decoy', 'true');
  username.setAttribute('autocomplete', 'username');
  username.tabIndex = -1;

  const password = document.createElement('input');
  password.type = 'password';
  password.name = 'password';
  password.setAttribute('data-autofill-decoy', 'true');
  password.setAttribute('autocomplete', 'current-password');
  password.tabIndex = -1;

  Object.assign(wrap.style, {
    position: 'absolute',
    left: '-9999px',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    opacity: '0',
    pointerEvents: 'none',
  });

  wrap.append(username, password);
  form.prepend(wrap);
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
  Object.entries(IGNORE_DATA_ATTRS).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });

  neutralizeCredentialName(el);
}

function patchSelectElement(el) {
  if (el.dataset.autofillBlock === '1') return;
  if (isLoginContext(el) || el.dataset.autofillPatched === '1') return;
  el.dataset.autofillPatched = '1';
  el.setAttribute('autocomplete', BUSINESS_AUTOCOMPLETE);
  Object.entries(IGNORE_DATA_ATTRS).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });
}

/** Prevent password managers from treating business forms as login/sign-up flows. */
export function patchAutofillElements(root) {
  if (!root || patching) return;

  patching = true;
  try {
    const forms = root.matches?.('form')
      ? [root, ...root.querySelectorAll('form')]
      : [...(root.querySelectorAll?.('form') || [])];

    forms.forEach((form) => {
      if (form.dataset.allowAutocomplete === 'login') return;
      if (form.dataset.autofillFormPatched === '1') return;
      form.dataset.autofillFormPatched = '1';
      form.setAttribute('autocomplete', 'off');
      form.setAttribute('data-form-type', 'other');
      ensureFormDecoys(form);
    });

    root.querySelectorAll?.('input, textarea').forEach(patchInputElement);
    root.querySelectorAll?.('select').forEach(patchSelectElement);
  } finally {
    patching = false;
  }
}

function mergeFocusBlurHandlers(existingFocus, existingBlur) {
  return {
    onFocus: (event) => {
      existingFocus?.(event);
    },
    onBlur: (event) => {
      existingBlur?.(event);
    },
  };
}

/** React-friendly props for business selects (no readonly). */
export function bindAutofillBlockSelect(props = {}) {
  return {
    ...IGNORE_DATA_ATTRS,
    autoComplete: BUSINESS_AUTOCOMPLETE,
    'data-autofill-block': '1',
    ...props,
  };
}

/** React-friendly props for business inputs (survives re-renders). */
export function bindAutofillBlock({
  onFocus,
  onBlur,
  readOnly: _readOnlyProp,
  autoComplete,
  ...rest
} = {}) {
  const handlers = mergeFocusBlurHandlers(onFocus, onBlur);
  const useBlock = autoComplete !== 'username'
    && autoComplete !== 'current-password'
    && autoComplete !== 'new-password';

  if (!useBlock) {
    return { onFocus, onBlur, autoComplete, ...rest };
  }

  return {
    ...IGNORE_DATA_ATTRS,
    autoComplete: autoComplete === 'off' || !autoComplete ? BUSINESS_AUTOCOMPLETE : autoComplete,
    'data-autofill-block': '1',
    ...handlers,
    ...rest,
  };
}

/** Hidden username/password pair — see AutofillDecoyFields.jsx */
export { AutofillDecoyFields } from './AutofillDecoyFields.jsx';

/**
 * Patch dynamically added fields inside a container (e.g. portal modals).
 * Call once when a modal opens — do not attach a document-level observer.
 */
export function patchAutofillContainer(root) {
  patchAutofillElements(root);
}

export function useSuppressBrowserAutofill(containerRef) {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;

    let frame = 0;
    const schedulePatch = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => patchAutofillElements(root));
    };

    patchAutofillElements(root);

    const observer = new MutationObserver((records) => {
      const hasNewNodes = records.some(
        (record) => record.type === 'childList'
          && (record.addedNodes.length > 0 || record.removedNodes.length > 0),
      );
      if (!hasNewNodes) return;
      schedulePatch();
    });

    observer.observe(root, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [containerRef]);
}

/** @deprecated Body-wide observer caused page freezes — use patchAutofillContainer in modals instead. */
export function useSuppressCampPortalAutofill() {
  // Intentionally no-op. Portal modals use AutofillDecoyFields + patchAutofillContainer on mount.
}

/** @deprecated Use bindAutofillBlock — kept for existing imports. */
export const PASSWORD_MANAGER_IGNORE = {
  autoComplete: BUSINESS_AUTOCOMPLETE,
  'data-autofill-block': '1',
  ...IGNORE_DATA_ATTRS,
};
