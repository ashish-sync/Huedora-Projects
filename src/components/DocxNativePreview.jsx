import { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { loadStoredToken } from '../shared/api.js';

const RENDER_OPTIONS = {
  className: 'dhub-docx',
  inWrapper: true,
  ignoreWidth: false,
  ignoreHeight: false,
  ignoreFonts: false,
  breakPages: true,
  ignoreLastRenderedPageBreak: false,
  experimental: true,
  useBase64URL: true,
  renderHeaders: true,
  renderFooters: true,
  renderFootnotes: true,
  renderEndnotes: true,
};

/**
 * Faithful Word (.docx) preview — preserves pages, bold, tables, images.
 * Pass either a local File/Blob (`file`) or a template id (`templateId`) to fetch the stored Word file.
 */
export default function DocxNativePreview({ file, templateId, className = '' }) {
  const bodyRef = useRef(null);
  const styleRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!bodyRef.current) return;
      bodyRef.current.innerHTML = '';
      if (styleRef.current) styleRef.current.innerHTML = '';
      setError('');

      if (!file && !templateId) return;

      setBusy(true);
      try {
        let data = file;
        if (!data && templateId) {
          const token = loadStoredToken();
          const res = await fetch(`/api/v1/templates/${templateId}/file`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            credentials: 'include',
          });
          if (!res.ok) throw new Error('Could not load Word file for preview');
          data = await res.blob();
        }
        if (cancelled || !bodyRef.current) return;
        await renderAsync(data, bodyRef.current, styleRef.current || bodyRef.current, RENDER_OPTIONS);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not render Word preview');
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [file, templateId]);

  if (!file && !templateId) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        Choose a Word file to preview it here before you upload.
      </p>
    );
  }

  return (
    <div className={`docx-native-preview ${className}`.trim()}>
      {busy && <p className="muted docx-native-status">Rendering Word document…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div ref={styleRef} className="docx-native-styles" hidden aria-hidden="true" />
      <div ref={bodyRef} className="docx-native-body" />
    </div>
  );
}
