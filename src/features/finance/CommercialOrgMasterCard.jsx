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

function Field({
  label,
  hint,
  children,
  className = '',
}) {
  return (
    <div className={className}>
      <label className="org-master-field-label">
        {label}
        {hint ? <span className="org-master-field-hint">{hint}</span> : null}
      </label>
      {children}
    </div>
  );
}

function Section({ index, title, note, children }) {
  return (
    <section className="org-master-form-section">
      <div className="org-master-form-section-head">
        <div className="org-master-form-section-title-row">
          <span className="org-master-form-section-index" aria-hidden="true">
            {index}
          </span>
          <h3 className="org-master-form-section-title">{title}</h3>
        </div>
        {note ? <span className="org-master-form-section-note">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

export default function CommercialOrgMasterCard({ master, compact = false, variant = 'card' }) {
  if (variant === 'banner') {
    if (!master) {
      return (
        <div className="org-master-banner org-master-banner--empty">
          <span className="org-master-banner-hint">
            Set up organisation master for Identity, Bank, Tax &amp; Signature
          </span>
          <Link to="/finance-one/organisation" className="org-master-banner-link">
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
        <span className="org-master-banner-hint">Identity · Bank · Tax · Signature</span>
        <Link to="/finance-one/organisation" className="org-master-banner-link">
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
          Logo, company details, bank info, and digital signature are managed in one place for all
          documents.
        </p>
        <Link to="/finance-one/organisation" className="org-master-card-link">
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
        <Link to="/finance-one/organisation" className="org-master-card-edit">
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
          <ReadRow label="Website" value={master.website} />
          <ReadRow label="GSTIN" value={master.gstin} />
          <ReadRow label="CIN" value={master.cin} />
          <ReadRow label="Udyam" value={master.udyam} />
          <ReadRow label="Account holder" value={master.accountHolder} />
          <ReadRow label="Bank" value={master.bankName} />
          <ReadRow label="A/C No" value={master.accountNumber} />
          <ReadRow label="Branch" value={master.bankBranch} />
          <ReadRow label="IFSC" value={master.ifscCode} />
          <ReadRow label="Signatory" value={master.signatoryName} />
        </div>
        {master.signatureDataUrl ? (
          <div className="org-master-qr-preview">
            <span className="org-master-read-label">Digital signature</span>
            <img src={master.signatureDataUrl} alt="Digital signature" />
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
        <Section index="01" title="Identity" note="Letterhead line 1">
          <div className="org-master-identity-row">
            <div className="org-master-media-field">
              <label className="org-master-field-label">Logo</label>
              <FileDrop
                className="doc-file-drop--logo"
                label="Upload logo"
                previewUrl={form.logoDataUrl}
                onFile={(file) => readFileAsDataUrl(file, (url) => update('logoDataUrl', url))}
              />
            </div>
            <div className="org-master-identity-fields">
              <div className="org-master-form-grid org-master-form-grid--2">
                <Field label="Legal name" hint="header" className="org-master-form-span-2">
                  <input
                    className="org-master-input"
                    value={form.legalName || ''}
                    disabled={disabled}
                    onChange={(e) => update('legalName', e.target.value)}
                    placeholder="Tylo Care Private Limited"
                  />
                </Field>
                <Field label="Tagline">
                  <input
                    className="org-master-input"
                    value={form.brandLine || ''}
                    disabled={disabled}
                    onChange={(e) => update('brandLine', e.target.value)}
                    placeholder="Bringing Healthcare Closer"
                  />
                </Field>
                <Field label="Email" hint="header">
                  <input
                    className="org-master-input"
                    type="email"
                    value={form.email || ''}
                    disabled={disabled}
                    onChange={(e) => update('email', e.target.value)}
                    placeholder="growth@tylocare.com"
                  />
                </Field>
                <Field label="Website" hint="header" className="org-master-form-span-2">
                  <input
                    className="org-master-input"
                    value={form.website || ''}
                    disabled={disabled}
                    onChange={(e) => update('website', e.target.value)}
                    placeholder="tylocare.com"
                  />
                </Field>
                <Field label="Registered address" hint="header" className="org-master-form-span-2">
                  <textarea
                    className="org-master-input org-master-input--textarea"
                    rows={2}
                    value={form.registeredOffice || ''}
                    disabled={disabled}
                    onChange={(e) => update('registeredOffice', e.target.value)}
                    placeholder="C-1207, Sahara Tower CHS Ltd., C Wing, Sahar Road, International Airport, Mumbai – 400099"
                  />
                </Field>
              </div>
            </div>
          </div>
        </Section>

        <Section index="02" title="Tax registration" note="Letterhead line 2">
          <div className="org-master-form-grid org-master-form-grid--3">
            <Field label="GSTIN" hint="header">
              <input
                className="org-master-input"
                value={form.gstin || ''}
                disabled={disabled}
                onChange={(e) => update('gstin', e.target.value)}
                placeholder="27AANCT2428H1Z4"
              />
            </Field>
            <Field label="CIN" hint="header">
              <input
                className="org-master-input"
                value={form.cin || ''}
                disabled={disabled}
                onChange={(e) => update('cin', e.target.value)}
                placeholder="U86909MH2026PTC472417"
              />
            </Field>
            <Field label="Udyam Registration No." hint="header">
              <input
                className="org-master-input"
                value={form.udyam || ''}
                disabled={disabled}
                onChange={(e) => update('udyam', e.target.value)}
                placeholder="UDYAM-MH-19-0446179"
              />
            </Field>
            <Field label="State">
              <input
                className="org-master-input"
                value={form.state || ''}
                disabled={disabled}
                onChange={(e) => update('state', e.target.value)}
                placeholder="Maharashtra"
              />
            </Field>
            <Field label="State code">
              <input
                className="org-master-input"
                value={form.stateCode || ''}
                disabled={disabled}
                onChange={(e) => update('stateCode', e.target.value)}
                placeholder="27"
              />
            </Field>
          </div>
        </Section>

        <div className="org-master-form-pair">
          <Section index="03" title="Bank details" note="Document footer">
            <div className="org-master-form-grid org-master-form-grid--2">
              <Field label="Account holder" className="org-master-form-span-2">
                <input
                  className="org-master-input"
                  value={form.accountHolder || ''}
                  disabled={disabled}
                  onChange={(e) => update('accountHolder', e.target.value)}
                  placeholder="Same as legal name if blank"
                />
              </Field>
              <Field label="Bank">
                <input
                  className="org-master-input"
                  value={form.bankName || ''}
                  disabled={disabled}
                  onChange={(e) => update('bankName', e.target.value)}
                />
              </Field>
              <Field label="A/C No">
                <input
                  className="org-master-input"
                  value={form.accountNumber || ''}
                  disabled={disabled}
                  onChange={(e) => update('accountNumber', e.target.value)}
                />
              </Field>
              <Field label="Branch">
                <input
                  className="org-master-input"
                  value={form.bankBranch || ''}
                  disabled={disabled}
                  onChange={(e) => update('bankBranch', e.target.value)}
                />
              </Field>
              <Field label="IFSC">
                <input
                  className="org-master-input"
                  value={form.ifscCode || ''}
                  disabled={disabled}
                  onChange={(e) => update('ifscCode', e.target.value)}
                />
              </Field>
            </div>
          </Section>

          <Section index="04" title="Digital signature" note="Document footer">
            <div className="org-master-sig-block">
              <div className="org-master-media-field">
                <label className="org-master-field-label">Signature image</label>
                <FileDrop
                  className="doc-file-drop--logo doc-file-drop--signature"
                  label="Upload signature"
                  previewUrl={form.signatureDataUrl}
                  onFile={(file) =>
                    readFileAsDataUrl(file, (url) => update('signatureDataUrl', url))
                  }
                />
              </div>
              <Field label="Signatory name">
                <input
                  className="org-master-input"
                  value={form.signatoryName || ''}
                  disabled={disabled}
                  onChange={(e) => update('signatoryName', e.target.value)}
                  placeholder="Optional name under signature"
                />
              </Field>
            </div>
          </Section>
        </div>
    </div>
  );
}
