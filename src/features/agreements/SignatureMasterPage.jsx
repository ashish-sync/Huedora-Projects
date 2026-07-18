import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadExcel } from '../../shared/api.js';
import { MODULE } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import FilePicker from '../../components/ui/FilePicker.jsx';

const ROLES_FALLBACK = [
  'HR',
  'Director Finance',
  'CFO',
  'CEO',
  'Legal',
  'Asset Manager',
  'Procurement',
  'Operations',
  'Verifier',
  'Other',
];

const empty = {
  name: '',
  roleLabel: 'HR',
  email: '',
  department: '',
  notes: '',
  signatureType: 'DRAWN',
  typedName: '',
  uploadPreview: '',
};

function bindCanvasDraw(canvas, drawingRef) {
  const ctx = canvas.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0b1a24';
  ctx.lineWidth = 2.5;

  const point = (e) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  };

  const start = (e) => {
    drawingRef.current = true;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.preventDefault();
  };
  const move = (e) => {
    if (!drawingRef.current) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    e.preventDefault();
  };
  const end = () => {
    drawingRef.current = false;
  };

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

  return () => {
    canvas.removeEventListener('mousedown', start);
    canvas.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', end);
    canvas.removeEventListener('touchstart', start);
    canvas.removeEventListener('touchmove', move);
    canvas.removeEventListener('touchend', end);
  };
}

export default function SignatureMasterPage({ embedded = false } = {}) {
  const { can } = useAuth();
  const canWrite = can('agreements:write');
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState(ROLES_FALLBACK);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  const load = () => {
    const params = new URLSearchParams({ all: 'true', limit: '200' });
    if (q) params.set('q', q);
    return api(`/signatures?${params}`)
      .then((r) => setRows(r.data))
      .catch((e) => setError(e.message));
  };

  const downloadMaster = async () => {
    setError('');
    setExportBusy(true);
    try {
      await downloadExcel('/signatures/export', 'Signature_Master.xlsx');
    } catch (err) {
      setError(err.message);
    } finally {
      setExportBusy(false);
    }
  };

  useEffect(() => {
    load();
    api('/signatures/meta/roles')
      .then((r) => {
        if (r.data?.roles?.length) setRoles(r.data.roles);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || form.signatureType !== 'DRAWN') return undefined;
    return bindCanvasDraw(canvas, drawing);
  }, [form.signatureType, editId]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const resetForm = () => {
    setForm(empty);
    setEditId(null);
    clearCanvas();
  };

  const onUploadFile = (file) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      setError('Upload a PNG, JPG, or WebP image');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Signature image must be under 2 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        signatureType: 'UPLOADED',
        uploadPreview: String(reader.result || ''),
      }));
      setError('');
    };
    reader.onerror = () => setError('Could not read the image file');
    reader.readAsDataURL(file);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!canWrite) return;
    setError('');
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        roleLabel: form.roleLabel,
        email: form.email,
        department: form.department,
        notes: form.notes,
        signatureType: form.signatureType,
      };
      if (form.signatureType === 'TYPED') {
        payload.typedName = form.typedName || form.name;
      } else if (form.signatureType === 'UPLOADED') {
        if (!form.uploadPreview?.startsWith('data:image')) {
          throw new Error('Upload a signature image');
        }
        payload.signatureData = form.uploadPreview;
      } else {
        payload.signatureData = canvasRef.current?.toDataURL('image/png');
      }

      if (editId) {
        await api(`/signatures/${editId}`, { method: 'PATCH', body: payload });
      } else {
        await api('/signatures', { method: 'POST', body: payload });
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (row) => {
    setEditId(row._id);
    const type =
      row.signatureType === 'UPLOADED'
        ? 'UPLOADED'
        : row.signatureType === 'TYPED'
          ? 'TYPED'
          : 'DRAWN';
    setForm({
      name: row.name || '',
      roleLabel: row.roleLabel || 'Other',
      email: row.email || '',
      department: row.department || '',
      notes: row.notes || '',
      signatureType: type,
      typedName: row.signatureType === 'TYPED' ? row.signatureData || row.name : row.name,
      uploadPreview: type === 'UPLOADED' ? row.signatureData || '' : '',
    });
    setTimeout(() => {
      if (type === 'DRAWN' && canvasRef.current && row.signatureData?.startsWith('data:image')) {
        const img = new Image();
        img.onload = () => {
          const ctx = canvasRef.current.getContext('2d');
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
        };
        img.src = row.signatureData;
      }
    }, 50);
  };

  const deactivate = async (id) => {
    if (!canWrite) return;
    try {
      await api(`/signatures/${id}`, { method: 'DELETE' });
      if (editId === id) resetForm();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className={embedded ? 'esign-shell esign-shell--embedded' : 'esign-shell'}>
      {!embedded ? (
      <div className="esign-top">
        <div>
          <p className="eyebrow">
            <Link to="/">{MODULE.HOME}</Link>
            <span className="crumb-sep" aria-hidden="true">/</span>
            <Link to="/agreements">{MODULE.ASSET_AGREEMENT}</Link>
            <span className="crumb-sep" aria-hidden="true">/</span>
            <span>{MODULE.DIGITAL_SIGNATURE_MASTER}</span>
          </p>
          <h1>{MODULE.DIGITAL_SIGNATURE_MASTER}</h1>
          <p className="muted esign-sub">
            Save reusable signatures for HR, Director Finance, and other roles. Draw, upload an image, or type a name, then apply when a document needs that sign-off.
          </p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            className="btn secondary"
            type="button"
            disabled={exportBusy}
            onClick={downloadMaster}
          >
            {exportBusy ? 'Downloading…' : 'Download Excel'}
          </button>
          <Link className="btn secondary" to="/agreements/new">
            New document
          </Link>
        </div>
      </div>
      ) : (
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button
            className="btn secondary"
            type="button"
            disabled={exportBusy}
            onClick={downloadMaster}
          >
            {exportBusy ? 'Downloading…' : 'Download Excel'}
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="esign-detail-grid">
        <section className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            <input
              className="esign-search"
              placeholder="Search name, role, email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
            />
            <button className="btn secondary" type="button" onClick={load}>
              Search
            </button>
          </div>

          <div className="sig-master-grid">
            {rows.map((row) => (
              <article
                key={row._id}
                className={`sig-master-card ${!row.isActive ? 'is-inactive' : ''} ${
                  editId === row._id ? 'is-selected' : ''
                }`}
              >
                <div className="sig-master-card-head">
                  <div>
                    <span className="badge tone-ok">{row.roleLabel}</span>
                    {!row.isActive && <span className="badge">Inactive</span>}
                  </div>
                  <strong>{row.name}</strong>
                  <span className="muted mono-sm">
                    {[row.email, row.department].filter(Boolean).join(' · ') || '-'}
                  </span>
                </div>
                <div className="sig-master-preview">
                  {(row.signatureType === 'DRAWN' || row.signatureType === 'UPLOADED') &&
                  row.signatureData?.startsWith('data:image') ? (
                    <img src={row.signatureData} alt={`Signature of ${row.name}`} />
                  ) : (
                    <div className="esign-typed-sig">{row.signatureData || row.name}</div>
                  )}
                </div>
                <span className="muted mono-sm">
                  {row.signatureType === 'UPLOADED'
                    ? 'Uploaded'
                    : row.signatureType === 'DRAWN'
                      ? 'Drawn'
                      : 'Typed'}
                </span>
                {canWrite && (
                  <div className="row">
                    <button className="btn secondary btn-compact" type="button" onClick={() => startEdit(row)}>
                      Edit
                    </button>
                    {row.isActive && (
                      <button className="btn danger btn-compact" type="button" onClick={() => deactivate(row._id)}>
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))}
            {!rows.length && <p className="muted">No stored signatures yet.</p>}
          </div>
        </section>

        {canWrite && (
          <form className="card" onSubmit={save}>
            <h3 style={{ marginTop: 0 }}>{editId ? 'Update signature' : 'Add signature'}</h3>
            <div className="field">
              <label>Person name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value, typedName: form.typedName || e.target.value })}
                placeholder="e.g. Priya Sharma"
              />
            </div>
            <div className="field">
              <label>Role / designation *</label>
              <AdaptiveSelect
                required
                value={form.roleLabel}
                onChange={(e) => setForm({ ...form, roleLabel: e.target.value })}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </AdaptiveSelect>
            </div>
            <div className="row">
              <div className="field" style={{ flex: 1 }}>
                <label>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Department</label>
                <input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label>Notes</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional"
              />
            </div>

            <div className="esign-sign-modes">
              <button
                type="button"
                className={`btn secondary ${form.signatureType === 'DRAWN' ? 'is-selected' : ''}`}
                onClick={() => setForm({ ...form, signatureType: 'DRAWN', uploadPreview: '' })}
              >
                Draw
              </button>
              <button
                type="button"
                className={`btn secondary ${form.signatureType === 'UPLOADED' ? 'is-selected' : ''}`}
                onClick={() => setForm({ ...form, signatureType: 'UPLOADED' })}
              >
                Upload
              </button>
              <button
                type="button"
                className={`btn secondary ${form.signatureType === 'TYPED' ? 'is-selected' : ''}`}
                onClick={() =>
                  setForm({
                    ...form,
                    signatureType: 'TYPED',
                    uploadPreview: '',
                    typedName: form.typedName || form.name,
                  })
                }
              >
                Type
              </button>
            </div>

            {form.signatureType === 'TYPED' ? (
              <div className="field">
                <label>Typed signature *</label>
                <input
                  className="esign-typed-input"
                  required
                  value={form.typedName}
                  onChange={(e) => setForm({ ...form, typedName: e.target.value })}
                  placeholder="Type the signature name"
                />
                {form.typedName && (
                  <div className="sig-master-preview" style={{ marginTop: 10 }}>
                    <div className="esign-typed-sig">{form.typedName}</div>
                  </div>
                )}
              </div>
            ) : form.signatureType === 'UPLOADED' ? (
              <div className="field">
                <label>Upload signature image *</label>
                <FilePicker
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => onUploadFile(e.target.files?.[0])}
                />
                <p className="muted" style={{ marginBottom: 0 }}>
                  PNG, JPG, or WebP. Transparent PNG works best.
                </p>
                {form.uploadPreview?.startsWith('data:image') && (
                  <div className="sig-master-preview" style={{ marginTop: 10 }}>
                    <img src={form.uploadPreview} alt="Upload preview" />
                  </div>
                )}
              </div>
            ) : (
              <div>
                <canvas ref={canvasRef} className="esign-canvas" width={640} height={180} />
                <button className="btn secondary btn-compact" type="button" onClick={clearCanvas}>
                  Clear pad
                </button>
              </div>
            )}

            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" type="submit" disabled={busy}>
                {busy ? 'Saving…' : editId ? 'Save changes' : 'Save signature'}
              </button>
              {editId && (
                <button className="btn secondary" type="button" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
