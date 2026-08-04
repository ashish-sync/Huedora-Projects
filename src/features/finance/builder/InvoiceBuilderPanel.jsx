import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/auth.jsx';
import { formatMoney } from '../documentGenerator/formUi.jsx';
import {
  getLineGstRateDisplay,
  patchLineGstRate,
  resolveTaxColumnLabels,
  usesIgst,
} from '../invoiceGenerator/invoiceCalculations.js';
import { MAX_INVOICE_LINE_ITEMS } from '../invoiceGenerator/invoiceStorage.js';
import { canManageOrganisationMaster } from './commercialApproval.js';
import ClientMasterRecipientPicker from './ClientMasterRecipientPicker.jsx';

function Section({ id, title, badge, defaultOpen = false, children }) {
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

export default function InvoiceBuilderPanel({
  form,
  totals,
  update,
  updateLine,
  addLine,
  removeLine,
  updateTerm,
  addTerm,
  applyClientMasterRecipient,
  clearClientMasterRecipient,
  panelConfig = {},
}) {
  const {
    docSectionTitle = 'Invoice',
    docNoLabel = 'Invoice no.',
    showOriginalInvoice = false,
    originalInvoiceLabel = 'Original invoice',
    maxLineItems = MAX_INVOICE_LINE_ITEMS,
  } = panelConfig;
  const taxMode = usesIgst(form.billTo?.stateCode, form.company?.stateCode) ? 'igst' : 'cgst_sgst';
  const taxLabels = resolveTaxColumnLabels(form);
  const { user } = useAuth();
  const canOrgMaster = canManageOrganisationMaster(user);

  return (
    <div className="ib-panel-inner">
      <div className="ib-panel-intro">
        <p>
          Letterhead &amp; bank come from{' '}
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

      <Section id="recipient" title="Recipient" defaultOpen>
        {applyClientMasterRecipient ? (
          <div className="ib-grid" style={{ marginBottom: 12 }}>
            <Field label="Client Master" span={2}>
              <ClientMasterRecipientPicker
                value={form.clientMasterId || ''}
                onPick={(_row, patch) => applyClientMasterRecipient(patch)}
                onClear={() => clearClientMasterRecipient?.()}
              />
            </Field>
          </div>
        ) : null}
        <div className="ib-grid">
          <Field label="Name" span={2}>
            <input className={inputCls} value={form.billTo.name} onChange={(e) => update('billTo.name', e.target.value)} />
          </Field>
          <Field label="Address" span={2}>
            <textarea
              className={`${inputCls} ib-textarea`}
              rows={2}
              value={form.billTo.address}
              onChange={(e) => {
                update('billTo.address', e.target.value);
                update('invoice.placeOfSupply', e.target.value);
              }}
            />
          </Field>
          <Field label="State">
            <input className={inputCls} value={form.billTo.stateName || ''} onChange={(e) => update('billTo.stateName', e.target.value)} />
          </Field>
          <Field label="State code" title="Different from your state → IGST; same state → CGST + SGST">
            <input className={inputCls} value={form.billTo.stateCode || ''} onChange={(e) => update('billTo.stateCode', e.target.value)} placeholder="27" />
          </Field>
          <Field label="GSTIN">
            <input className={inputCls} value={form.billTo.gstin} onChange={(e) => update('billTo.gstin', e.target.value)} />
          </Field>
          <Field label="PAN">
            <input className={inputCls} value={form.billTo.pan} onChange={(e) => update('billTo.pan', e.target.value)} />
          </Field>
          <Field label="Contact">
            <input className={inputCls} value={form.billTo.contactPerson} onChange={(e) => update('billTo.contactPerson', e.target.value)} />
          </Field>
          <Field label="Email">
            <input className={inputCls} type="email" value={form.billTo.email} onChange={(e) => update('billTo.email', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section id="invoice" title={docSectionTitle} defaultOpen>
        <div className="ib-grid">
          <Field label={docNoLabel}>
            <input
              className={`${inputCls} ib-input--mono`}
              value={form.invoice.documentNumber}
              readOnly
              placeholder="Assigned on approval"
              title="Document number is assigned when the document is approved"
            />
          </Field>
          <Field label="Project">
            <input className={inputCls} value={form.invoice.projectName} onChange={(e) => update('invoice.projectName', e.target.value)} placeholder="BMD Camp" />
          </Field>
          {showOriginalInvoice ? (
            <Field label={originalInvoiceLabel} span={2}>
              <input className={inputCls} value={form.invoice.cnReference || ''} onChange={(e) => update('invoice.cnReference', e.target.value)} placeholder="IN/26-27/08/0001" />
            </Field>
          ) : null}
          <Field label="Date">
            <input type="date" className={inputCls} value={form.invoice.issueDate} onChange={(e) => update('invoice.issueDate', e.target.value)} />
          </Field>
          <Field label="Due date">
            <input type="date" className={inputCls} value={form.invoice.dueDate} onChange={(e) => update('invoice.dueDate', e.target.value)} />
          </Field>
          <Field label="Reverse charge">
            <select className={inputCls} value={form.invoice.reverseCharge} onChange={(e) => update('invoice.reverseCharge', e.target.value)}>
              <option value="N">No</option>
              <option value="Y">Yes</option>
            </select>
          </Field>
          <Field label="Receipt voucher">
            <input className={inputCls} value={form.invoice.receiptVoucherNo || ''} onChange={(e) => update('invoice.receiptVoucherNo', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section id="lines" title="Line items" badge={form.lineItems.length}>
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
                <Field label="Description" span={2}>
                  <input className={inputCls} value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} />
                </Field>
                <Field label="SAC">
                  <input className={inputCls} value={line.hsnSac} onChange={(e) => updateLine(index, { hsnSac: e.target.value })} />
                </Field>
                <Field label="Qty">
                  <input type="number" className={inputCls} value={line.qty} onChange={(e) => updateLine(index, { qty: e.target.value })} />
                </Field>
                <Field label="Rate">
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
              </div>
              {totals?.lines?.[index] ? (
                <div className="ib-line-total">₹ {formatMoney(totals.lines[index].totalAmount)}</div>
              ) : null}
            </div>
          ))}
          <button type="button" className="ib-add-line" onClick={addLine} disabled={form.lineItems.length >= maxLineItems}>
            + Add line {form.lineItems.length >= maxLineItems ? `(max ${maxLineItems})` : ''}
          </button>
        </div>
      </Section>

      <Section id="adjustments" title="Adjustments & terms">
        <div className="ib-grid">
          <Field label="CN amount">
            <input type="number" className={inputCls} value={form.adjustments?.cnAmount || 0} onChange={(e) => update('adjustments.cnAmount', e.target.value)} />
          </Field>
          <Field label="DN amount">
            <input type="number" className={inputCls} value={form.adjustments?.dnAmount || 0} onChange={(e) => update('adjustments.dnAmount', e.target.value)} />
          </Field>
          <Field label="Advance">
            <input type="number" className={inputCls} value={form.adjustments?.advanceReceived || 0} onChange={(e) => update('adjustments.advanceReceived', e.target.value)} />
          </Field>
        </div>
        <div className="ib-terms">
          {form.terms.map((term, index) => (
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
    </div>
  );
}
