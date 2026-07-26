import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '../documentGenerator/formUi.jsx';
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
}) {
  return (
    <div className="ib-panel-inner">
      <div className="ib-panel-intro">
        <p>
          Company letterhead comes from{' '}
          <Link to="/finance/master" className="ib-link">
            Organisation master
          </Link>
          . Click the document to edit inline.
        </p>
      </div>

      <Section title="Vendor" defaultOpen>
        <div className="ib-grid">
          <Field label="Vendor name" span={2}>
            <input className={inputCls} value={form.vendorName} onChange={(e) => update('vendorName', e.target.value)} />
          </Field>
          <Field label="Address" span={2}>
            <textarea className={`${inputCls} ib-textarea`} rows={2} value={form.vendorAddress} onChange={(e) => update('vendorAddress', e.target.value)} />
          </Field>
          <Field label="GSTIN" span={2}>
            <input className={inputCls} value={form.vendorGstin} onChange={(e) => update('vendorGstin', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Purchase order" defaultOpen>
        <div className="ib-grid">
          <Field label="PO no.">
            <input className={`${inputCls} ib-input--mono`} value={form.documentNumber} onChange={(e) => update('documentNumber', e.target.value)} />
          </Field>
          <Field label="Tax %">
            <input type="number" className={inputCls} value={form.purchaseTaxRate} onChange={(e) => update('purchaseTaxRate', e.target.value)} />
          </Field>
          <Field label="Order date">
            <input type="date" className={inputCls} value={form.documentDate} onChange={(e) => update('documentDate', e.target.value)} />
          </Field>
          <Field label="Delivery date">
            <input type="date" className={inputCls} value={form.dueDate} onChange={(e) => update('dueDate', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Line items" badge={form.lineItems.length}>
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
                <Field label="Description" span={2}>
                  <input className={inputCls} value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} />
                </Field>
                <Field label="Qty">
                  <input type="number" className={inputCls} value={line.qty} onChange={(e) => updateLine(index, { qty: e.target.value })} />
                </Field>
                <Field label="Rate">
                  <input type="number" className={inputCls} value={line.rate} onChange={(e) => updateLine(index, { rate: e.target.value })} />
                </Field>
                <Field label="FOC">
                  <select className={inputCls} value={line.isFoc ? 'yes' : 'no'} onChange={(e) => updateLine(index, { isFoc: e.target.value === 'yes' })}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
              </div>
              {totals?.lines?.[index] ? (
                <div className="ib-line-total">₹ {formatMoney(totals.lines[index].amount)}</div>
              ) : null}
            </div>
          ))}
          <button type="button" className="ib-add-line" onClick={addLine} disabled={form.lineItems.length >= MAX_PO_LINE_ITEMS}>
            + Add line {form.lineItems.length >= MAX_PO_LINE_ITEMS ? `(max ${MAX_PO_LINE_ITEMS})` : ''}
          </button>
        </div>
      </Section>

      <Section title="Notes">
        <Field label="Footer notes" span={2}>
          <textarea className={`${inputCls} ib-textarea`} rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
        </Field>
      </Section>
    </div>
  );
}
