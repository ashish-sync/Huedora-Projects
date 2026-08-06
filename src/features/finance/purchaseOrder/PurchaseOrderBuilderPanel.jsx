import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/auth.jsx';
import { formatMoney } from '../documentGenerator/formUi.jsx';
import { canManageOrganisationMaster } from '../builder/commercialApproval.js';
import { formatStateLine, parseStateLine } from '../builder/stateLine.js';
import {
  getLineGstRateDisplay,
  patchLineGstRate,
  resolveTaxMode,
} from '../invoiceGenerator/invoiceCalculations.js';
import VendorContactPicker from '../builder/VendorContactPicker.jsx';
import { MAX_PO_LINE_ITEMS } from './purchaseOrderStorage.js';

function Section({ title, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`ib-section${open ? ' is-open' : ''}`}>
      <button type="button" className="ib-section-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="ib-section-title">{title}</span>
        {badge != null ? <span className="ib-section-badge">{badge}</span> : null}
        <span className="ib-section-chevron" aria-hidden="true" />
      </button>
      {open ? <div className="ib-section-body">{children}</div> : null}
    </div>
  );
}

function Field({ label, children, span = 1 }) {
  return (
    <label className={`ib-field${span === 2 ? ' ib-field--span' : ''}`}>
      <span className="ib-field-label">{label}</span>
      {children}
    </label>
  );
}

const inputCls = 'ib-input';

export default function PurchaseOrderBuilderPanel({
  form,
  totals,
  update,
  updateLine,
  addLine,
  removeLine,
  applyVendorContact,
  clearVendorContact,
}) {
  const taxMode = resolveTaxMode(form.vendor?.stateCode, form.company?.stateCode);
  const { user } = useAuth();
  const canOrgMaster = canManageOrganisationMaster(user);
  const lines = form.lineItems || [];

  return (
    <div className="ib-panel-inner">
      <div className="ib-panel-intro">
        <p>
          Letterhead comes from{' '}
          {canOrgMaster ? (
            <Link to="/finance-one/organisation" className="ib-link">
              Organisation master
            </Link>
          ) : (
            'Organisation master'
          )}
          . Edit on the preview or use the fields below.
        </p>
      </div>

      <Section title="Purchase order" defaultOpen>
        <div className="ib-fields">
          <Field label="PO no.">
            <input className={inputCls} value={form.po?.documentNumber || ''} readOnly placeholder="Assigned on approval" />
          </Field>
          <Field label="PO date">
            <input
              type="date"
              className={inputCls}
              value={form.po?.documentDate || ''}
              onChange={(e) => update('po.documentDate', e.target.value)}
            />
          </Field>
          <Field label="Revision no.">
            <input
              className={inputCls}
              value={form.po?.revisionNo ?? 0}
              onChange={(e) => update('po.revisionNo', e.target.value)}
            />
          </Field>
          <Field label="Vendor quote ref.">
            <input
              className={inputCls}
              value={form.po?.vendorQuoteRef || ''}
              onChange={(e) => update('po.vendorQuoteRef', e.target.value)}
            />
          </Field>
          <Field label="Vendor quote date">
            <input
              type="date"
              className={inputCls}
              value={form.po?.vendorQuoteDate || ''}
              onChange={(e) => update('po.vendorQuoteDate', e.target.value)}
            />
          </Field>
          <Field label="Project / cost centre" span={2}>
            <input
              className={inputCls}
              value={form.po?.projectCostCentre || ''}
              onChange={(e) => update('po.projectCostCentre', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Vendor" defaultOpen badge={form.vendor?.name ? 1 : 0}>
        {applyVendorContact ? (
          <VendorContactPicker
            value={form.contactId || ''}
            onPick={(_row, patch) => applyVendorContact(patch)}
            onClear={() => clearVendorContact?.()}
          />
        ) : null}
        <div className="ib-grid">
          <Field label="Vendor name">
            <input className={inputCls} value={form.vendor?.name || ''} onChange={(e) => update('vendor.name', e.target.value)} />
          </Field>
          <Field label="Contact Name">
            <input className={inputCls} value={form.vendor?.contactPerson || ''} onChange={(e) => update('vendor.contactPerson', e.target.value)} placeholder="—" />
          </Field>
          <Field label="Vendor code">
            <input className={inputCls} value={form.vendor?.code || ''} onChange={(e) => update('vendor.code', e.target.value)} />
          </Field>
          <Field label="GSTIN">
            <input className={inputCls} value={form.vendor?.gstin || ''} onChange={(e) => update('vendor.gstin', e.target.value)} />
          </Field>
          <Field label="Address" span={2}>
            <textarea className={`${inputCls} ib-textarea`} rows={2} value={form.vendor?.address || ''} onChange={(e) => update('vendor.address', e.target.value)} />
          </Field>
          <Field label="State Name / State Code">
            <input
              className={inputCls}
              value={formatStateLine(form.vendor)}
              onChange={(e) => {
                const { stateName, stateCode } = parseStateLine(e.target.value);
                update('vendor.stateName', stateName);
                update('vendor.stateCode', stateCode);
              }}
              placeholder="Maharashtra / 27"
            />
          </Field>
          <Field label="Mobile">
            <input className={inputCls} value={form.vendor?.mobile || ''} onChange={(e) => update('vendor.mobile', e.target.value)} />
          </Field>
          <Field label="Email">
            <input className={inputCls} type="email" value={form.vendor?.email || ''} onChange={(e) => update('vendor.email', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Delivery">
        <div className="ib-grid">
          <Field label="Delivery address" span={2}>
            <textarea className={`${inputCls} ib-textarea`} rows={2} value={form.delivery?.address || ''} onChange={(e) => update('delivery.address', e.target.value)} />
          </Field>
          <Field label="Contact Name">
            <input className={inputCls} value={form.delivery?.contact || ''} onChange={(e) => update('delivery.contact', e.target.value)} placeholder="—" />
          </Field>
          <Field label="Mobile">
            <input className={inputCls} value={form.delivery?.mobile || ''} onChange={(e) => update('delivery.mobile', e.target.value)} />
          </Field>
          <Field label="Expected date">
            <input type="date" className={inputCls} value={form.delivery?.expectedDate || ''} onChange={(e) => update('delivery.expectedDate', e.target.value)} />
          </Field>
          <Field label="Instructions" span={2}>
            <input className={inputCls} value={form.delivery?.instructions || ''} onChange={(e) => update('delivery.instructions', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Commercial">
        <div className="ib-fields">
          <Field label="Payment terms">
            <input className={inputCls} value={form.commercial?.paymentTerms || ''} onChange={(e) => update('commercial.paymentTerms', e.target.value)} />
          </Field>
          <Field label="Freight">
            <input className={inputCls} value={form.commercial?.freight || ''} onChange={(e) => update('commercial.freight', e.target.value)} />
          </Field>
          <Field label="Insurance">
            <input className={inputCls} value={form.commercial?.insurance || ''} onChange={(e) => update('commercial.insurance', e.target.value)} />
          </Field>
          <Field label="Delivery terms">
            <input className={inputCls} value={form.commercial?.deliveryTerms || ''} onChange={(e) => update('commercial.deliveryTerms', e.target.value)} />
          </Field>
          <Field label="Warranty">
            <input className={inputCls} value={form.commercial?.warranty || ''} onChange={(e) => update('commercial.warranty', e.target.value)} />
          </Field>
          <Field label="Validity">
            <input className={inputCls} value={form.commercial?.validity || ''} onChange={(e) => update('commercial.validity', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Items" defaultOpen badge={lines.length}>
        {lines.map((line, index) => (
          <div key={line.id || index} className="ib-line-card">
            <div className="ib-line-head">
              <span>Item {index + 1}</span>
              {lines.length > 1 ? (
                <button type="button" className="ib-line-remove" onClick={() => removeLine(index)}>
                  Remove
                </button>
              ) : null}
            </div>
            <div className="ib-fields">
              <Field label="Description" span={2}>
                <input className={inputCls} value={line.description || ''} onChange={(e) => updateLine(index, { description: e.target.value })} />
              </Field>
              <Field label="Qty">
                <input className={inputCls} value={line.qty ?? ''} onChange={(e) => updateLine(index, { qty: e.target.value })} />
              </Field>
              <Field label="Unit">
                <input className={inputCls} value={line.unit || line.uom || ''} onChange={(e) => updateLine(index, { unit: e.target.value, uom: e.target.value })} />
              </Field>
              <Field label="Rate">
                <input className={inputCls} value={line.rate ?? ''} onChange={(e) => updateLine(index, { rate: e.target.value })} />
              </Field>
              <Field label="GST Rate %">
                <input
                  className={inputCls}
                  value={getLineGstRateDisplay(line, taxMode)}
                  onChange={(e) => updateLine(index, patchLineGstRate(e.target.value, taxMode))}
                />
              </Field>
            </div>
            {totals?.lines?.[index] ? (
              <div className="ib-line-total">₹ {formatMoney(totals.lines[index].totalAmount)}</div>
            ) : null}
          </div>
        ))}
        {lines.length < MAX_PO_LINE_ITEMS ? (
          <button type="button" className="ib-add-line" onClick={addLine}>
            + Add item
          </button>
        ) : null}
      </Section>
    </div>
  );
}
