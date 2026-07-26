import { useRef, useState } from 'react';
import {
  collectProductImages,
  productImageUrl,
  removeProductImage,
  uploadProductImages,
} from '../../shared/productImages.js';

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
  const [error, setError] = useState('');
  const images = collectProductImages(product);

  async function handleUpload(fileList) {
    if (!productId || !canWrite || !fileList?.length) return;
    setBusy(true);
    setError('');
    try {
      const updated = await uploadProductImages(productId, fileList);
      onUpdated?.(updated);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleRemove(filename) {
    if (!productId || !canWrite || !filename) return;
    if (!window.confirm('Remove this image from the product?')) return;
    setBusy(true);
    setError('');
    try {
      const updated = await removeProductImage(productId, filename);
      onUpdated?.(updated);
    } catch (err) {
      setError(err.message || 'Remove failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`product-images-panel${compact ? ' product-images-panel--compact' : ''} ${className}`.trim()}>
      {!compact && showTitle ? <h4 className="product-images-title">{title}</h4> : null}
      {hint ? <p className="product-images-hint muted">{hint}</p> : null}
      {error ? <p className="product-images-error">{error}</p> : null}

      {images.length > 0 ? (
        <ul className="product-images-grid" aria-label={title}>
          {images.map((img) => (
            <li key={img.filename || img.url} className="product-images-item">
              <a
                href={productImageUrl(img)}
                target="_blank"
                rel="noreferrer"
                className="product-images-thumb-link"
                title={img.name || 'View image'}
              >
                <img src={productImageUrl(img)} alt={img.name || 'Product'} className="product-images-thumb" />
              </a>
              {canWrite ? (
                <button
                  type="button"
                  className="product-images-remove inv-link"
                  disabled={busy}
                  onClick={() => handleRemove(img.filename)}
                  aria-label={`Remove ${img.name || 'image'}`}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
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
            {busy ? 'Uploading…' : '+ Add images'}
          </button>
        </div>
      ) : null}

      {!productId && canWrite ? (
        <p className="muted product-images-hint">Save the product first, then add images.</p>
      ) : null}
    </div>
  );
}
