import { Link } from 'react-router-dom';
import { FileDrop, readFileAsDataUrl } from './documentGenerator/formUi.jsx';

function ReadRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="org-master-read-row">
      <span className="org-master-read-label">{label}</span>
      <span className="org-master-read-value">{value}</span>
    </div>
  );
}

export default function CommercialOrgMasterCard({ master, compact = false, variant = 'card' }) {
  if (variant === 'banner') {
    if (!master) {
      return (
        <div className="org-master-banner org-master-banner--empty">
          <span className="org-master-banner-hint">Set up organisation master for letterhead &amp; bank</span>
          <Link to="/finance/master" className="org-master-banner-link">
            Set up →
          </Link>
        </div>
      );
    }

    return (
      <div className="org-master-banner">
        {master.logoDataUrl ? (
          <img src={master.logoDataUrl} alt="" className="org-master-banner-logo" />
        ) : null}
        <span className="org-master-banner-name">{master.legalName || 'Company'}</span>
        <span className="org-master-banner-sep" aria-hidden="true">
          ·
        </span>
        <span className="org-master-banner-hint">Letterhead &amp; bank</span>
        <Link to="/finance/master" className="org-master-banner-link">
          Edit
        </Link>
      </div>
    );
  }

  if (!master) {
    return (
      <div className="org-master-card org-master-card--empty">
        <p className="org-master-card-title">Organisation master</p>
        <p className="org-master-card-desc muted">
          Logo, company details, bank info, and payment QR are managed in one place for all documents.
        </p>
        <Link to="/finance/master" className="org-master-card-link">
          Set up organisation master →
        </Link>
      </div>
    );
  }

  return (
    <div className={`org-master-card${compact ? ' org-master-card--compact' : ''}`}>
      <div className="org-master-card-head">
        <div>
          <p className="org-master-card-eyebrow">Organisation master</p>
          <p className="org-master-card-title">{master.legalName || 'Company name not set'}</p>
          {master.brandLine ? <p className="org-master-card-tagline">{master.brandLine}</p> : null}
        </div>
        <Link to="/finance/master" className="org-master-card-edit">
          Edit master
        </Link>
      </div>

      <div className="org-master-card-body">
        {master.logoDataUrl ? (
          <img src={master.logoDataUrl} alt="" className="org-master-card-logo" />
        ) : null}
        <div className="org-master-card-grid">
          <ReadRow label="Address" value={master.registeredOffice} />
          <ReadRow label="Email" value={master.email} />
          <ReadRow label="Phone" value={master.phone} />
          <ReadRow label="Website" value={master.website} />
          <ReadRow label="Account holder" value={master.accountHolder} />
          <ReadRow label="Bank" value={master.bankName} />
          <ReadRow label="A/C No" value={master.accountNumber} />
          <ReadRow label="Branch" value={master.bankBranch} />
          <ReadRow label="IFSC" value={master.ifscCode} />
        </div>
        {master.paymentQrDataUrl ? (
          <div className="org-master-qr-preview">
            <span className="org-master-read-label">Payment QR</span>
            <img src={master.paymentQrDataUrl} alt="Payment QR" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CommercialOrgMasterForm({ form, setForm, disabled }) {
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="org-master-form">
      <section className="org-master-form-section">
        <h3 className="org-master-form-section-title">Company identity</h3>
        <p className="org-master-form-section-desc">
          Used on Invoice, Purchase Order, Proforma, and Credit Note.
        </p>
        <div className="org-master-form-grid">
          <div className="org-master-form-span-2">
            <label className="org-master-field-label">Upload Logo</label>
            <FileDrop
              label="Drop logo image or click to browse"
              previewUrl={form.logoDataUrl}
              onFile={(file) => readFileAsDataUrl(file, (url) => update('logoDataUrl', url))}
            />
          </div>
          <div>
            <label className="org-master-field-label">Full Name</label>
            <input
              className="org-master-input"
              value={form.legalName || ''}
              disabled={disabled}
              onChange={(e) => update('legalName', e.target.value)}
              placeholder="Legal / company name"
            />
          </div>
          <div>
            <label className="org-master-field-label">Tagline</label>
            <input
              className="org-master-input"
              value={form.brandLine || ''}
              disabled={disabled}
              onChange={(e) => update('brandLine', e.target.value)}
              placeholder="Brand line or tagline"
            />
          </div>
          <div className="org-master-form-span-2">
            <label className="org-master-field-label">Registered Address</label>
            <textarea
              className="org-master-input"
              rows={3}
              value={form.registeredOffice || ''}
              disabled={disabled}
              onChange={(e) => update('registeredOffice', e.target.value)}
            />
          </div>
          <div>
            <label className="org-master-field-label">Email</label>
            <input
              className="org-master-input"
              type="email"
              value={form.email || ''}
              disabled={disabled}
              onChange={(e) => update('email', e.target.value)}
            />
          </div>
          <div>
            <label className="org-master-field-label">Phone</label>
            <input
              className="org-master-input"
              value={form.phone || ''}
              disabled={disabled}
              onChange={(e) => update('phone', e.target.value)}
            />
          </div>
          <div className="org-master-form-span-2">
            <label className="org-master-field-label">Website</label>
            <input
              className="org-master-input"
              value={form.website || ''}
              disabled={disabled}
              onChange={(e) => update('website', e.target.value)}
              placeholder="www.example.com"
            />
          </div>
        </div>
      </section>

      <section className="org-master-form-section">
        <h3 className="org-master-form-section-title">Bank &amp; payment</h3>
        <div className="org-master-form-grid">
          <div>
            <label className="org-master-field-label">Account Holder</label>
            <input
              className="org-master-input"
              value={form.accountHolder || ''}
              disabled={disabled}
              onChange={(e) => update('accountHolder', e.target.value)}
            />
          </div>
          <div>
            <label className="org-master-field-label">Bank</label>
            <input
              className="org-master-input"
              value={form.bankName || ''}
              disabled={disabled}
              onChange={(e) => update('bankName', e.target.value)}
            />
          </div>
          <div>
            <label className="org-master-field-label">A/C No</label>
            <input
              className="org-master-input"
              value={form.accountNumber || ''}
              disabled={disabled}
              onChange={(e) => update('accountNumber', e.target.value)}
            />
          </div>
          <div>
            <label className="org-master-field-label">Branch</label>
            <input
              className="org-master-input"
              value={form.bankBranch || ''}
              disabled={disabled}
              onChange={(e) => update('bankBranch', e.target.value)}
            />
          </div>
          <div>
            <label className="org-master-field-label">IFSC</label>
            <input
              className="org-master-input"
              value={form.ifscCode || ''}
              disabled={disabled}
              onChange={(e) => update('ifscCode', e.target.value)}
            />
          </div>
          <div>
            <label className="org-master-field-label">UPI ID (optional)</label>
            <input
              className="org-master-input"
              value={form.upiId || ''}
              disabled={disabled}
              onChange={(e) => update('upiId', e.target.value)}
              placeholder="name@upi — used if no QR image"
            />
          </div>
          <div className="org-master-form-span-2">
            <label className="org-master-field-label">Payment QR Code</label>
            <FileDrop
              label="Upload payment QR image"
              previewUrl={form.paymentQrDataUrl}
              onFile={(file) => readFileAsDataUrl(file, (url) => update('paymentQrDataUrl', url))}
            />
          </div>
        </div>
      </section>

      <section className="org-master-form-section org-master-form-section--tax">
        <h3 className="org-master-form-section-title">Tax registration (optional)</h3>
        <p className="org-master-form-section-desc">GSTIN, PAN, and state code for tax documents.</p>
        <div className="org-master-form-grid">
          <div>
            <label className="org-master-field-label">GSTIN</label>
            <input
              className="org-master-input"
              value={form.gstin || ''}
              disabled={disabled}
              onChange={(e) => update('gstin', e.target.value)}
            />
          </div>
          <div>
            <label className="org-master-field-label">PAN</label>
            <input
              className="org-master-input"
              value={form.pan || ''}
              disabled={disabled}
              onChange={(e) => update('pan', e.target.value)}
            />
          </div>
          <div>
            <label className="org-master-field-label">CIN</label>
            <input
              className="org-master-input"
              value={form.cin || ''}
              disabled={disabled}
              onChange={(e) => update('cin', e.target.value)}
            />
          </div>
          <div>
            <label className="org-master-field-label">State code</label>
            <input
              className="org-master-input"
              value={form.stateCode || ''}
              disabled={disabled}
              onChange={(e) => update('stateCode', e.target.value)}
              placeholder="e.g. 27"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
