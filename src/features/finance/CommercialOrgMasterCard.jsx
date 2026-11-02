import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PhoneField } from '../../components/ui/PhoneField.jsx';
import { numberingPreviewForCode } from './documentNumbering.js';
import {
  DEFAULT_HEADER_DISPLAY_KEYS,
  HEADER_DISPLAY_OPTIONS,
  formatCompanyLetterhead,
  resolveHeaderDisplayKeys,
} from './shared/companyLetterhead.js';
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  resolveOrgBrandColors,
  sanitizeBrandColor,
} from './shared/orgBrandColors.js';

/** Read-only row helper for document generator summary card */
function ReadRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="org-master-read-row">
      <span className="org-master-read-label">{label}</span>
      <span className="org-master-read-value">{value}</span>
    </div>
  );
}

/** Legacy document generator summary card & banner (preserved for builder workflows) */
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
          <ReadRow label="Document code" value={master.documentCode} />
          <ReadRow
            label="Brand colours"
            value={`${resolveOrgBrandColors(master).primary} · ${resolveOrgBrandColors(master).secondary}`}
          />
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

// ─────────────────────────────────────────────────────────────────────────────
// Redesigned Enterprise Workspace Components
// ─────────────────────────────────────────────────────────────────────────────

/** Standard Form Field with micro-labels and hints */
function EntityField({ label, hint, help, children, className = '' }) {
  return (
    <div className={`entity-field ${className}`.trim()}>
      <label className="entity-field-label">
        <span>{label}</span>
        {hint && <span className="entity-field-hint">{hint}</span>}
      </label>
      {children}
      {help && <p className="entity-field-help">{help}</p>}
    </div>
  );
}

/** Uniform Section Card with header badge and number */
function EntitySection({ id, number, title, description, badge, children }) {
  return (
    <section id={id} className="entity-section">
      <header className="entity-section-header">
        <div className="entity-section-header-left">
          <span className="entity-section-number">{number}</span>
          <div>
            <h3 className="entity-section-title">{title}</h3>
            {description && <p className="entity-section-desc">{description}</p>}
          </div>
        </div>
        {badge && <span className="entity-section-badge">{badge}</span>}
      </header>
      <div className="entity-section-body">{children}</div>
    </section>
  );
}

/** Enterprise Media Upload with Drag & Drop, Preview, Replace, and Remove */
function OrgMediaUpload({
  label,
  hint,
  value,
  onChange,
  disabled = false,
  dropLabel = 'Click to upload or drag & drop',
  subLabel = 'PNG, JPG or SVG (transparent background recommended)',
  altText = 'Uploaded media',
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file) => {
    if (!file || disabled) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="entity-upload-card">
      <label className="entity-field-label">
        <span>{label}</span>
        {hint && <span className="entity-field-hint">{hint}</span>}
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        style={{ display: 'none' }}
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      {value ? (
        <div className="entity-upload-preview-frame">
          <img src={value} alt={altText} className="entity-upload-img" />
        </div>
      ) : (
        <div
          className={`entity-upload-dropzone ${isDragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`}
          onClick={() => !disabled && fileInputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          role="button"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (!disabled) fileInputRef.current?.click();
            }
          }}
        >
          <svg
            className="entity-upload-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span className="entity-upload-label">{dropLabel}</span>
          <span className="entity-upload-sub">{subLabel}</span>
        </div>
      )}

      {value && !disabled && (
        <div className="entity-upload-actions">
          <button
            type="button"
            className="btn secondary btn-compact entity-upload-btn-replace"
            onClick={() => fileInputRef.current?.click()}
          >
            Replace
          </button>
          <button
            type="button"
            className="btn ghost btn-compact entity-upload-btn-remove"
            onClick={() => onChange('')}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

/** Color input pairing swatch with hex text */
function BrandColorControl({ label, hint, value, disabled, onChange }) {
  const hex = sanitizeBrandColor(value) || '';
  return (
    <EntityField label={label} hint={hint}>
      <div className="entity-color-control">
        <input
          type="color"
          className="entity-color-swatch"
          value={(hex || '#0A5AC2').toLowerCase()}
          disabled={disabled}
          aria-label={`${label} color picker`}
          onChange={(e) => onChange(sanitizeBrandColor(e.target.value) || hex)}
        />
        <input
          className="entity-input entity-input--mono"
          value={value || ''}
          disabled={disabled}
          spellCheck={false}
          placeholder="#0A5AC2"
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            const next = sanitizeBrandColor(value);
            if (next) onChange(next);
          }}
        />
      </div>
    </EntityField>
  );
}

/** Document Header Display Picker with Live Letterhead Simulation */
function HeaderDisplayPicker({ form, disabled, onChange }) {
  const selected = resolveHeaderDisplayKeys(form);
  const selectedSet = new Set(selected);
  const preview = formatCompanyLetterhead({
    ...form,
    address: form.registeredOffice,
    headerDisplayKeys: selected,
  });

  const toggle = (key) => {
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(DEFAULT_HEADER_DISPLAY_KEYS.filter((item) => next.has(item)));
  };

  return (
    <div className="entity-header-picker-wrap">
      <p className="entity-field-help" style={{ margin: 0 }}>
        Legal name and registered office address always print on Line 1. Select the statutory details and contacts to print on Line 2:
      </p>

      <div className="entity-chip-group" role="group" aria-label="Line 2 display options">
        {HEADER_DISPLAY_OPTIONS.map((opt) => {
          const on = selectedSet.has(opt.key);
          return (
            <button
              key={opt.key}
              type="button"
              className={`entity-toggle-chip ${on ? 'is-active' : ''}`}
              aria-pressed={on}
              disabled={disabled}
              onClick={() => toggle(opt.key)}
            >
              <span className="entity-toggle-chip-check" aria-hidden="true">
                {on ? '✓' : '+'}
              </span>
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* ── Live Letterhead Simulation Container ── */}
      <div className="entity-letterhead-preview" aria-label="Document Letterhead Preview">
        <span className="entity-preview-kicker">Live Document Header Preview</span>
        <div
          className="entity-preview-line1"
          style={{ color: resolveOrgBrandColors(form).primary }}
        >
          {form.legalName || 'ORGANISATION LEGAL NAME NOT CONFIGURED'}
        </div>
        <div className="entity-preview-address">
          {form.registeredOffice || 'Registered Office Address will render on Line 1'}
        </div>
        <div className="entity-preview-line2">
          {preview.line2 || 'Select options above to preview Line 2 (CIN, GSTIN, Phone, Email, Website, Udyam)'}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Redesigned CommercialOrgMasterForm
// ─────────────────────────────────────────────────────────────────────────────

export function CommercialOrgMasterForm({ form, setForm, disabled }) {
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const brandColors = resolveOrgBrandColors(form);
  const numberingCards = numberingPreviewForCode(form.documentCode || 'TC');

  return (
    <div className="entity-workspace-form">
      {/* ── Section 01: Identity & Address ── */}
      <EntitySection
        id="section-identity"
        number="01"
        title="Identity & Address"
        description="Brand identity, registered company name, and official contact details"
        badge="Letterhead Line 1"
      >
        <div className="entity-identity-layout">
          <OrgMediaUpload
            label="Company Logo"
            hint="Letterhead"
            value={form.logoDataUrl}
            onChange={(url) => update('logoDataUrl', url)}
            disabled={disabled}
            altText="Company Logo"
          />

          <div className="entity-grid entity-grid--2">
            <EntityField label="Display Name" hint="Brand name">
              <input
                className="entity-input"
                value={form.name || ''}
                disabled={disabled}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g. Tylo Care"
              />
            </EntityField>

            <EntityField label="Legal Entity Name" hint="Registered entity *">
              <input
                required
                className="entity-input"
                value={form.legalName || ''}
                disabled={disabled}
                onChange={(e) => update('legalName', e.target.value)}
                placeholder="Tylo Care Private Limited"
              />
            </EntityField>

            <EntityField label="Tagline / Slogan" hint="Document header">
              <input
                className="entity-input"
                value={form.brandLine || ''}
                disabled={disabled}
                onChange={(e) => update('brandLine', e.target.value)}
                placeholder="Bringing Healthcare Closer"
              />
            </EntityField>

            <EntityField label="Official / Billing Email">
              <input
                type="email"
                className="entity-input"
                value={form.email || ''}
                disabled={disabled}
                onChange={(e) => update('email', e.target.value)}
                placeholder="billing@company.com"
              />
            </EntityField>

            <EntityField label="Website URL">
              <input
                className="entity-input"
                value={form.website || ''}
                disabled={disabled}
                onChange={(e) => update('website', e.target.value)}
                placeholder="company.com"
              />
            </EntityField>

            <EntityField label="Contact Phone">
              <PhoneField
                id="org-master-phone"
                hideLabel
                aria-label="Contact Phone"
                label="Contact"
                value={form.phone || ''}
                disabled={disabled}
                inputClassName="entity-input"
                onChange={(phone) => update('phone', phone)}
              />
            </EntityField>

            <EntityField
              label="Registered Office Address"
              hint="Printed on all official invoices"
              className="entity-span-2"
            >
              <textarea
                className="entity-input entity-input--textarea"
                rows={2}
                value={form.registeredOffice || ''}
                disabled={disabled}
                onChange={(e) => update('registeredOffice', e.target.value)}
                placeholder="Unit 1207, Tower C, Business Park, International Airport Road, Mumbai – 400099"
              />
            </EntityField>
          </div>
        </div>
      </EntitySection>

      {/* ── Section 02: Document Header ── */}
      <EntitySection
        id="section-header"
        number="02"
        title="Document Header"
        description="Configure secondary statutory identifiers and contact elements for Line 2"
        badge="Letterhead Line 2"
      >
        <HeaderDisplayPicker
          form={form}
          disabled={disabled}
          onChange={(keys) => update('headerDisplayKeys', keys)}
        />
      </EntitySection>

      {/* ── Section 03: Brand Colours ── */}
      <EntitySection
        id="section-branding"
        number="03"
        title="Brand Colours"
        description="Theme accents applied to document titles, table headers, alternating rows, and totals"
        badge="Palette Preview"
      >
        <div className="entity-grid entity-grid--2">
          <BrandColorControl
            label="Primary Brand Colour"
            hint="Headers, totals & accents"
            value={form.primaryColor}
            disabled={disabled}
            onChange={(val) => update('primaryColor', val)}
          />

          <BrandColorControl
            label="Secondary Brand Colour"
            hint="Zebra rows & borders"
            value={form.secondaryColor}
            disabled={disabled}
            onChange={(val) => update('secondaryColor', val)}
          />
        </div>

        {/* ── Dedicated Document Table Preview Container ── */}
        <div
          className="entity-table-mock-card"
          aria-label="Document Palette Table Preview"
          style={{
            '--org-primary': brandColors.primary,
            '--org-secondary': brandColors.secondary,
          }}
        >
          <span className="entity-preview-kicker">Live Document Table Preview</span>
          <table className="entity-table-mock">
            <thead>
              <tr>
                <th>DESCRIPTION</th>
                <th>HSN/SAC</th>
                <th style={{ textAlign: 'right' }}>QTY</th>
                <th style={{ textAlign: 'right' }}>RATE</th>
                <th style={{ textAlign: 'right' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              <tr className="is-alt">
                <td>Health Checkup Camp Operations — Full Day Package</td>
                <td>9983</td>
                <td style={{ textAlign: 'right' }}>1</td>
                <td style={{ textAlign: 'right' }}>₹25,000.00</td>
                <td style={{ textAlign: 'right' }}>₹25,000.00</td>
              </tr>
              <tr className="is-total">
                <td colSpan={4}>TOTAL PAYABLE (INR)</td>
                <td style={{ textAlign: 'right' }}>₹25,000.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </EntitySection>

      {/* ── Section 04: Document Numbering ── */}
      <EntitySection
        id="section-numbering"
        number="04"
        title="Document Numbering"
        description="Prefix code generating sequence numbers across invoices, purchase orders, and challans"
        badge="Prefix Rules"
      >
        <div className="entity-grid entity-grid--2">
          <EntityField
            label="Document Prefix Code"
            hint="2–5 uppercase letters *"
            help="Examples: Tylo Care: TC, Rapid Diagno: RD, Medrento: MD. Must be 2 to 5 characters."
          >
            <input
              className="entity-input entity-input--mono"
              maxLength={5}
              value={form.documentCode || ''}
              disabled={disabled}
              onChange={(e) => update('documentCode', e.target.value.toUpperCase())}
              placeholder="TC"
            />
          </EntityField>
        </div>

        <div className="entity-numbering-grid" aria-label="Document numbering examples">
          {numberingCards.map((card) => (
            <div key={card.documentType} className="entity-numbering-card">
              <span className="entity-numbering-type">{card.label}</span>
              <strong className="entity-numbering-sample">{card.prefix}</strong>
            </div>
          ))}
        </div>
      </EntitySection>

      {/* ── Section 05: Tax Registration ── */}
      <EntitySection
        id="section-tax"
        number="05"
        title="Tax Registration"
        description="GSTIN, CIN, MSME Udyam, and state code configurations driving GST calculations"
        badge="Statutory Master"
      >
        <div className="entity-grid entity-grid--3">
          <EntityField label="GSTIN" hint="15 characters">
            <input
              className="entity-input entity-input--mono"
              maxLength={15}
              value={form.gstin || ''}
              disabled={disabled}
              onChange={(e) => update('gstin', e.target.value.toUpperCase())}
              placeholder="27AANCT2428H1Z4"
            />
          </EntityField>

          <EntityField label="CIN" hint="Corporate identity">
            <input
              className="entity-input entity-input--mono"
              maxLength={21}
              value={form.cin || ''}
              disabled={disabled}
              onChange={(e) => update('cin', e.target.value.toUpperCase())}
              placeholder="U86909MH2026PTC472417"
            />
          </EntityField>

          <EntityField label="Udyam Registration" hint="MSME number">
            <input
              className="entity-input entity-input--mono"
              value={form.udyam || ''}
              disabled={disabled}
              onChange={(e) => update('udyam', e.target.value.toUpperCase())}
              placeholder="UDYAM-MH-19-0446179"
            />
          </EntityField>

          <EntityField label="Registered State" hint="Jurisdiction state">
            <input
              className="entity-input"
              value={form.state || ''}
              disabled={disabled}
              onChange={(e) => update('state', e.target.value)}
              placeholder="Maharashtra"
            />
          </EntityField>

          <EntityField label="State Code" hint="2-digit GST code">
            <input
              className="entity-input entity-input--mono"
              maxLength={2}
              value={form.stateCode || ''}
              disabled={disabled}
              onChange={(e) => update('stateCode', e.target.value)}
              placeholder="27"
            />
          </EntityField>
        </div>
      </EntitySection>

      {/* ── Section 06: Bank Details ── */}
      <EntitySection
        id="section-bank"
        number="06"
        title="Bank Details"
        description="Settlement bank account details rendered on document footers for remittance"
        badge="Invoice Remittance"
      >
        <div className="entity-grid entity-grid--2">
          <EntityField
            label="Beneficiary Account Holder"
            hint="Legal Name used if blank"
            className="entity-span-2"
          >
            <input
              className="entity-input"
              value={form.accountHolder || ''}
              disabled={disabled}
              onChange={(e) => update('accountHolder', e.target.value)}
              placeholder="Leave blank to default to legal entity name"
            />
          </EntityField>

          <EntityField label="Bank Name">
            <input
              className="entity-input"
              value={form.bankName || ''}
              disabled={disabled}
              onChange={(e) => update('bankName', e.target.value)}
              placeholder="e.g. HDFC Bank"
            />
          </EntityField>

          <EntityField label="Account Number">
            <input
              className="entity-input entity-input--mono"
              inputMode="numeric"
              value={form.accountNumber || ''}
              disabled={disabled}
              onChange={(e) => update('accountNumber', e.target.value.replace(/\s+/g, ''))}
              placeholder="50200012345678"
            />
          </EntityField>

          <EntityField label="Branch Name">
            <input
              className="entity-input"
              value={form.bankBranch || ''}
              disabled={disabled}
              onChange={(e) => update('bankBranch', e.target.value)}
              placeholder="Andheri East, Mumbai"
            />
          </EntityField>

          <EntityField label="IFSC Code">
            <input
              className="entity-input entity-input--mono"
              maxLength={11}
              value={form.ifscCode || ''}
              disabled={disabled}
              onChange={(e) => update('ifscCode', e.target.value.toUpperCase())}
              placeholder="HDFC0000123"
            />
          </EntityField>
        </div>
      </EntitySection>

      {/* ── Section 07: Digital Signature ── */}
      <EntitySection
        id="section-signature"
        number="07"
        title="Digital Signature"
        description="Authorized sign-off stamp and signatory name affixed to issued documents"
        badge="Document Sign-Off"
      >
        <div className="entity-signature-layout">
          <OrgMediaUpload
            label="Signature / Stamp Image"
            hint="PNG or JPG"
            value={form.signatureDataUrl}
            onChange={(url) => update('signatureDataUrl', url)}
            disabled={disabled}
            dropLabel="Upload signature or seal"
            subLabel="PNG with transparent background recommended"
            altText="Digital Signature"
          />

          <div className="entity-grid">
            <EntityField
              label="Authorized Signatory Name"
              hint="Printed under signature"
              help="Appears directly under the digital signature stamp on commercial invoices, delivery challans, and purchase orders."
            >
              <input
                className="entity-input"
                value={form.signatoryName || ''}
                disabled={disabled}
                onChange={(e) => update('signatoryName', e.target.value)}
                placeholder="e.g. Authorized Signatory / Director"
              />
            </EntityField>
          </div>
        </div>
      </EntitySection>
    </div>
  );
}
