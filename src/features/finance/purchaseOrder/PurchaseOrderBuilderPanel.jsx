import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/auth.jsx';
import { formatMoney } from '../documentGenerator/formUi.jsx';
import { canManageOrganisationMaster } from '../builder/commercialApproval.js';
import {
  getLineGstRateDisplay,
  patchLineGstRate,
  resolveTaxColumnLabels,
  usesIgst,
} from '../invoiceGenerator/invoiceCalculations.js';
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
  updateTerm,
  addTerm,
}) {
  const taxMode = usesIgst(form.vendor?.stateCode, form.company?.stateCode) ? 'igst' : 'cgst_sgst';
  const taxLabels = resolveTaxColumnLabels(form);
  const { user } = useAuth();
  const canOrgMaster = canManageOrganisationMaster(user);

  return (
    <div className="ib-panel-inner">
      <div className="ib-panel-intro">
        <p>
          Company letterhead &amp; bank come from{' '}
          {canOrgMaster ? (
            <Link to="/finance-one/organisation" className="ib-link">
              Organisation master
            </Link>
          ) : (
            'Organisation master'
          )}
          . Click the document to edit inline.
        </p>
      </div>

      <Section title="Vendor" defaultOpen>
        <div className="ib-grid">
          <Field label="Vendor name" span={2}>
            <input className={inputCls} value={form.vendor?.name || ''} onChange={(e) => update('vendor.name', e.target.value)} />
          </Field>
          <Field label="Address" span={2}>
            <textarea className={`${inputCls} ib-textarea`} rows={2} value={form.vendor?.address || ''} onChange={(e) => update('vendor.address', e.target.value)} />
          </Field>
          <Field label="State">
            <input className={inputCls} value={form.vendor?.stateName || ''} onChange={(e) => update('vendor.stateName', e.target.value)} />
          </Field>
          <Field label="State code" title="Different from your state → IGST; same state → CGST + SGST">
            <input className={inputCls} value={form.vendor?.stateCode || ''} onChange={(e) => update('vendor.stateCode', e.target.value)} placeholder="27" />
          </Field>
          <Field label="GSTIN">
            <input className={inputCls} value={form.vendor?.gstin || ''} onChange={(e) => update('vendor.gstin', e.target.value)} />
          </Field>
          <Field label="PAN">
            <input className={inputCls} value={form.vendor?.pan || ''} onChange={(e) => update('vendor.pan', e.target.value)} />
          </Field>
          <Field label="Contact">
            <input className={inputCls} value={form.vendor?.contactPerson || ''} onChange={(e) => update('vendor.contactPerson', e.target.value)} />
          </Field>
          <Field label="Email">
            <input className={inputCls} type="email" value={form.vendor?.email || ''} onChange={(e) => update('vendor.email', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Purchase order" defaultOpen>
        <div className="ib-grid">
          <Field label="PO no.">
            <input
              className={`${inputCls} ib-input--mono`}
              value={form.po?.documentNumber || ''}
              readOnly
              placeholder="Assigned on approval"
              title="Document number is assigned when the document is approved"
            />
          </Field>
          <Field label="Reference">
            <input className={inputCls} value={form.po?.reference || ''} onChange={(e) => update('po.reference', e.target.value)} placeholder="RFQ / quote" />
          </Field>
          <Field label="PO date">
            <input type="date" className={inputCls} value={form.po?.documentDate || ''} onChange={(e) => update('po.documentDate', e.target.value)} />
          </Field>
          <Field label="Delivery date">
            <input type="date" className={inputCls} value={form.po?.deliveryDate || ''} onChange={(e) => update('po.deliveryDate', e.target.value)} />
          </Field>
          <Field label="Payment terms" span={2}>
            <textarea className={`${inputCls} ib-textarea`} rows={2} value={form.po?.paymentTerms || ''} onChange={(e) => update('po.paymentTerms', e.target.value)} />
          </Field>
          <Field label="Delivery address" span={2}>
            <textarea className={`${inputCls} ib-textarea`} rows={2} value={form.deliveryAddress || ''} onChange={(e) => update('deliveryAddress', e.target.value)} placeholder="Ship-to location" />
          </Field>
        </div>
      </Section>

      <Section title="Line items" badge={form.lineItems.length}>
        <div className="ib-grid ib-grid--compact" style={{ marginBottom: 12 }}>
          <Field label="Rate column title">
            <input
              className={inputCls}
              value={form.taxColumnLabels?.rateLabel ?? taxLabels.rateLabel}
              onChange={(e) => update('taxColumnLabels.rateLabel', e.target.value)}
              placeholder="GST %"
            />
          </Field>
          <Field label="Amount column title">
            <input
              className={inputCls}
              value={form.taxColumnLabels?.amountLabel ?? taxLabels.amountLabel}
              onChange={(e) => update('taxColumnLabels.amountLabel', e.target.value)}
              placeholder="GST"
            />
          </Field>
        </div>
        <div className="ib-lines">
          {form.lineItems.map((line, index) => (
            <div key={line.id} className="ib-line-card">
              <div className="ib-line-head">
                <span>Line {index + 1}</span>
                {form.lineItems.length > 1 ? (
                  <button type="button" className="ib-line-remove" onClick={() => removeLine(index)}>
                    Remove
                  </button>
                ) : null}
              </div>
              <div className="ib-grid">
                <Field label="Item code">
                  <input className={inputCls} value={line.itemCode || line.hsnSac || ''} onChange={(e) => updateLine(index, { itemCode: e.target.value, hsnSac: e.target.value })} />
                </Field>
                <Field label="Description" span={2}>
                  <input className={inputCls} value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} />
                </Field>
                <Field label="Qty">
                  <input type="number" className={inputCls} value={line.qty} onChange={(e) => updateLine(index, { qty: e.target.value })} />
                </Field>
                <Field label="Unit">
                  <input className={inputCls} value={line.uom || 'Nos'} onChange={(e) => updateLine(index, { uom: e.target.value })} />
                </Field>
                <Field label="Unit price">
                  <input type="number" className={inputCls} value={line.rate} onChange={(e) => updateLine(index, { rate: e.target.value })} />
                </Field>
                <Field label="Discount">
                  <input type="number" className={inputCls} value={line.discount} onChange={(e) => updateLine(index, { discount: e.target.value })} />
                </Field>
                <Field label={taxLabels.rateLabel}>
                  <input
                    type="number"
                    className={inputCls}
                    value={getLineGstRateDisplay(line, taxMode)}
                    onChange={(e) => updateLine(index, patchLineGstRate(e.target.value, taxMode))}
                  />
                </Field>
                <Field label="FOC">
                  <select className={inputCls} value={line.isFoc ? 'yes' : 'no'} onChange={(e) => updateLine(index, { isFoc: e.target.value === 'yes', rate: e.target.value === 'yes' ? 0 : line.rate })}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
              </div>
              {totals?.lines?.[index] ? (
                <div className="ib-line-total">₹ {formatMoney(totals.lines[index].totalAmount)}</div>
              ) : null}
            </div>
          ))}
          <button type="button" className="ib-add-line" onClick={addLine} disabled={form.lineItems.length >= MAX_PO_LINE_ITEMS}>
            + Add line {form.lineItems.length >= MAX_PO_LINE_ITEMS ? `(max ${MAX_PO_LINE_ITEMS})` : ''}
          </button>
        </div>
      </Section>

      <Section title="Shipping & terms">
        <div className="ib-grid">
          <Field label="Shipping instructions" span={2}>
            <textarea className={`${inputCls} ib-textarea`} rows={2} value={form.shippingInstructions || ''} onChange={(e) => update('shippingInstructions', e.target.value)} />
          </Field>
          <Field label="Notes" span={2}>
            <textarea className={`${inputCls} ib-textarea`} rows={2} value={form.notes || ''} onChange={(e) => update('notes', e.target.value)} />
          </Field>
        </div>
        <div className="ib-terms">
          {(form.terms || []).map((term, index) => (
            <div key={index} className="ib-term-row">
              <span className="ib-term-num">{index + 1}.</span>
              <input className={inputCls} value={term} onChange={(e) => updateTerm(index, e.target.value)} />
            </div>
          ))}
          <button type="button" className="ib-add-line" onClick={addTerm}>
            + Add term
          </button>
        </div>
      </Section>

      <Section title="Signatory">
        <div className="ib-grid">
          <Field label="Authorized signatory" span={2}>
            <input className={inputCls} value={form.signature?.signatoryName || ''} onChange={(e) => update('signature.signatoryName', e.target.value)} />
          </Field>
        </div>
      </Section>
    </div>
  );
}
