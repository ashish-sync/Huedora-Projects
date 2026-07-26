export default function PreviewFrame({ url, loading, error, placeholder, title = 'Document preview' }) {
  if (error) {
    return (
      <div className="doc-preview-frame doc-preview-frame--error">
        <p>{error}</p>
      </div>
    );
  }

  if (loading && !url) {
    return (
      <div className="doc-preview-frame doc-preview-frame--loading">
        <span className="doc-preview-spinner" aria-hidden="true" />
        <span>Rendering preview…</span>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="doc-preview-frame doc-preview-frame--empty">
        {placeholder || 'Preview will appear as you edit'}
      </div>
    );
  }

  return (
    <iframe
      title={title}
      className="doc-preview-frame doc-preview-frame--pdf"
      src={url}
    />
  );
}
