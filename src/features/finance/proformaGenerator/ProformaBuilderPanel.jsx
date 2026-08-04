import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/auth.jsx';
import { formatMoney } from '../documentGenerator/formUi.jsx';
import ClientMasterRecipientPicker from '../builder/ClientMasterRecipientPicker.jsx';
import { canManageOrganisationMaster } from '../builder/commercialApproval.js';
import {
  getLineGstRateDisplay,
  patchLineGstRate,
  resolveTaxColumnLabels,
  usesIgst,
} from '../invoiceGenerator/invoiceCalculations.js';
import { proformaToInvoiceView } from './proformaFormAdapter.js';
import { MAX_PROFORMA_LINE_ITEMS } from './proformaStorage.js';

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

export default function ProformaBuilderPanel({
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
}) {
  const invoiceView = useMemo(() => proformaToInvoiceView(form), [form]);
  const lineRows = (form.rows || []).filter((r) => r.type === 'line');
  const taxMode = usesIgst(form.recipient?.stateCode, form.company?.stateCode) ? 'igst' : 'cgst_sgst';
  const taxLabels = resolveTaxColumnLabels(invoiceView);
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

      <Section title="Recipient" defaultOpen>
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
            <input className={inputCls} value={form.recipient.name} onChange={(e) => update('recipient.name', e.target.value)} />
          </Field>
          <Field label="Place of supply" span={2}>
            <textarea className={`${inputCls} ib-textarea`} rows={2} value={form.recipient.placeOfSupply} onChange={(e) => update('recipient.placeOfSupply', e.target.value)} />
          </Field>
          <Field label="State code">
            <input className={inputCls} value={form.recipient.stateCode || ''} onChange={(e) => update('recipient.stateCode', e.target.value)} placeholder="27" />
          </Field>
          <Field label="GSTIN">
            <input className={inputCls} value={form.recipient.recipientGstin} onChange={(e) => update('recipient.recipientGstin', e.target.value)} />
          </Field>
          <Field label="Contact">
            <input className={inputCls} value={form.recipient.contactPerson} onChange={(e) => update('recipient.contactPerson', e.target.value)} />
          </Field>
          <Field label="Email">
            <input className={inputCls} type="email" value={form.recipient.contactEmail} onChange={(e) => update('recipient.contactEmail', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Proforma" defaultOpen>
        <div className="ib-grid">
          <Field label="Proforma no.">
            <input
              className={`${inputCls} ib-input--mono`}
              value={form.document.documentNumber}
              readOnly
              placeholder="Assigned on approval"
              title="Document number is assigned when the document is approved"
            />
          </Field>
          <Field label="Project">
            <input className={inputCls} value={form.recipient.projectName} onChange={(e) => update('recipient.projectName', e.target.value)} />
          </Field>
          <Field label="Date">
            <input type="date" className={inputCls} value={form.document.issueDate} onChange={(e) => update('document.issueDate', e.target.value)} />
          </Field>
          <Field label="Valid until">
            <input type="date" className={inputCls} value={form.document.dueDate} onChange={(e) => update('document.dueDate', e.target.value)} />
          </Field>
          <Field label="Reference" span={2}>
            <input className={inputCls} value={form.document.reference || ''} onChange={(e) => update('document.reference', e.target.value)} />
          </Field>
        </div>
      </Section>

      <Section title="Line items" badge={lineRows.length}>
        <div className="ib-grid ib-grid--compact" style={{ marginBottom: 12 }}>
          <Field label="Rate column title">
            <input className={inputCls} value={form.taxColumnLabels?.rateLabel ?? taxLabels.rateLabel} onChange={(e) => update('taxColumnLabels.rateLabel', e.target.value)} placeholder="GST %" />
          </Field>
          <Field label="Amount column title">
            <input className={inputCls} value={form.taxColumnLabels?.amountLabel ?? taxLabels.amountLabel} onChange={(e) => update('taxColumnLabels.amountLabel', e.target.value)} placeholder="GST" />
          </Field>
        </div>
        <div className="ib-lines">
          {lineRows.map((line, index) => (
            <div key={line.id} className="ib-line-card">
              <div className="ib-line-head">
                <span>Line {index + 1}</span>
                {lineRows.length > 1 ? (
                  <button type="button" className="ib-line-remove" onClick={() => removeLine(line.id)}>
                    Remove
                  </button>
                ) : null}
              </div>
              <div className="ib-grid">
                <Field label="Description" span={2}>
                  <input className={inputCls} value={line.description} onChange={(e) => updateLine(line.id, { description: e.target.value })} />
                </Field>
                <Field label="SAC">
                  <input className={inputCls} value={line.hsnSac} onChange={(e) => updateLine(line.id, { hsnSac: e.target.value })} />
                </Field>
                <Field label="Qty">
                  <input type="number" className={inputCls} value={line.qty} onChange={(e) => updateLine(line.id, { qty: e.target.value })} />
                </Field>
                <Field label="Rate">
                  <input type="number" className={inputCls} value={line.rate} onChange={(e) => updateLine(line.id, { rate: e.target.value })} />
                </Field>
                <Field label="Discount">
                  <input type="number" className={inputCls} value={line.discount} onChange={(e) => updateLine(line.id, { discount: e.target.value })} />
                </Field>
                <Field label={taxLabels.rateLabel}>
                  <input
                    type="number"
                    className={inputCls}
                    value={getLineGstRateDisplay(line, taxMode)}
                    onChange={(e) => updateLine(line.id, patchLineGstRate(e.target.value, taxMode))}
                  />
                </Field>
              </div>
              {totals?.lines?.[index] ? (
                <div className="ib-line-total">₹ {formatMoney(totals.lines[index].totalAmount)}</div>
              ) : null}
            </div>
          ))}
          <button type="button" className="ib-add-line" onClick={addLine} disabled={lineRows.length >= MAX_PROFORMA_LINE_ITEMS}>
            + Add line {lineRows.length >= MAX_PROFORMA_LINE_ITEMS ? `(max ${MAX_PROFORMA_LINE_ITEMS})` : ''}
          </button>
        </div>
      </Section>

      <Section title="Adjustments & terms">
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
