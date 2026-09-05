import { useEffect, useRef, useState } from 'react';
import {
  collectProductImages,
  productImageUrl,
  removeProductImage,
  resolveProductImageFilename,
  uploadProductImages,
} from '../../shared/productImages.js';
import { isDirectUploadPath, resolveUploadViewUrl } from '../../shared/uploadViewUrl.js';

function ProductThumb({ img }) {
  const [src, setSrc] = useState(() => productImageUrl(img));
  useEffect(() => {
    let cancelled = false;
    const raw = img?.url || '';
    if (!isDirectUploadPath(raw)) {
      setSrc(productImageUrl(img));
      return undefined;
    }
    resolveUploadViewUrl(raw)
      .then((href) => {
        if (!cancelled) setSrc(href);
      })
      .catch(() => {
        if (!cancelled) setSrc(productImageUrl(img));
      });
    return () => {
      cancelled = true;
    };
  }, [img?.url]);

  return (
    <a href={src || '#'} target="_blank" rel="noreferrer" className="product-images-thumb-link">
      <img src={src} alt={img.name || 'Product'} className="product-images-thumb" />
    </a>
  );
}

export default function ProductImagesPanel({
  productId,
  product,
  canWrite = false,
  compact = false,
  showTitle = false,
  title = 'Product images',
  hint,
  onUpdated,
  className = '',
}) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [busyMode, setBusyMode] = useState('');
  const [error, setError] = useState('');
  const images = collectProductImages(product);

  async function handleUpload(fileList) {
    if (!productId || !canWrite || !fileList?.length) return;
    setBusy(true);
    setBusyMode('upload');
    setError('');
    try {
      const updated = await uploadProductImages(productId, fileList);
      onUpdated?.(updated);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setBusy(false);
      setBusyMode('');
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRemove(img) {
    if (!productId || !canWrite) return;
    const filename = resolveProductImageFilename(img);
    if (!filename) {
      setError('Image reference is missing — reload the product and try again');
      return;
    }
    if (!window.confirm('Remove this image from the product?')) return;
    setBusy(true);
    setBusyMode('remove');
    setError('');
    try {
      const updated = await removeProductImage(productId, filename);
      onUpdated?.(updated);
    } catch (err) {
      setError(err.message || 'Remove failed');
    } finally {
      setBusy(false);
      setBusyMode('');
    }
  }

  const actionLabel = busyMode === 'remove'
    ? 'Removing…'
    : busyMode === 'upload'
      ? 'Uploading…'
      : '+ Add images';

  return (
    <div className={`product-images-panel${compact ? ' product-images-panel--compact' : ''} ${className}`.trim()}>
      {!compact && showTitle ? <h4 className="product-images-title">{title}</h4> : null}
      {hint ? <p className="product-images-hint muted">{hint}</p> : null}
      {error ? <p className="product-images-error" role="alert">{error}</p> : null}

      {images.length > 0 ? (
        <ul className="product-images-grid" aria-label={title}>
          {images.map((img) => {
            const key = resolveProductImageFilename(img) || img.url;
            return (
              <li key={key} className="product-images-item">
                <ProductThumb img={img} />
                {canWrite ? (
                  <button
                    type="button"
                    className="product-images-remove inv-link"
                    disabled={busy}
                    onClick={() => handleRemove(img)}
                    aria-label={`Remove ${img.name || 'image'}`}
                  >
                    Remove
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted product-images-empty">No images uploaded yet.</p>
      )}

      {canWrite && productId ? (
        <div className="product-images-actions">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="product-images-file"
            disabled={busy}
            onChange={(e) => handleUpload(e.target.files)}
          />
          <button
            type="button"
            className="btn btn-secondary btn-compact"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {actionLabel}
          </button>
        </div>
      ) : null}

      {!productId && canWrite ? (
        <p className="muted product-images-hint">Save the product first, then add images.</p>
      ) : null}
    </div>
  );
}
