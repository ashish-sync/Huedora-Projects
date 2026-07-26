import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Field, FormSection, LineCard, formatMoney } from '../documentGenerator/formUi.jsx';
import {
  applyOrgMasterToInvoiceForm,
  loadOrgMasterCache,
} from '../commercialOrgMaster.js';
import { useCommercialOrgMaster } from '../useCommercialOrgMaster.js';
import {
  clearInvoiceDraft,
  defaultInvoiceForm,
  defaultLineItem,
  loadInvoiceDraft,
  nextInvoiceNumber,
  saveInvoiceDraft,
} from './invoiceStorage.js';
import { computeInvoiceTotals, usesIgst } from './invoiceCalculations.js';

/** Only fields the user fills — letterhead & bank come from Organisation master. */
export default function InvoiceGeneratorForm({ form, setForm, totals }) {
  const update = useCallback(
    (path, value) => {
      setForm((prev) => {
        const next = structuredClone(prev);
        const keys = path.split('.');
        let cur = next;
        for (let i = 0; i < keys.length - 1; i += 1) cur = cur[keys[i]];
        cur[keys[keys.length - 1]] = value;
        return next;
      });
    },
    [setForm]
  );

  const updateLine = (index, patch) => {
    setForm((prev) => {
      const lineItems = [...prev.lineItems];
      lineItems[index] = { ...lineItems[index], ...patch };
      return { ...prev, lineItems };
    });
  };

  const addLine = () => {
    setForm((prev) => ({ ...prev, lineItems: [...prev.lineItems, defaultLineItem()] }));
  };

  const removeLine = (index) => {
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index),
    }));
  };

  const updateTerm = (index, value) => {
    setForm((prev) => {
      const terms = [...prev.terms];
      terms[index] = value;
      return { ...prev, terms };
    });
  };

  const addTerm = () => setForm((prev) => ({ ...prev, terms: [...prev.terms, ''] }));

  return (
    <>
      <p className="doc-master-hint">
        Company, bank &amp; GSTIN are prefilled from{' '}
        <a href="/finance/master">Organisation master</a>. Add recipient, project, and line items below.
      </p>

      <FormSection id="recipient" title="Recipient" defaultOpen>
        <div className="doc-form-grid">
          <Field label="Recipient name" className="doc-span-2">
            <input className="doc-field-input" value={form.billTo.name} onChange={(e) => update('billTo.name', e.target.value)} />
          </Field>
          <Field label="Address / place of supply" className="doc-span-2">
            <textarea
              className="doc-field-input"
              rows={2}
              value={form.billTo.address}
              onChange={(e) => {
                update('billTo.address', e.target.value);
                update('invoice.placeOfSupply', e.target.value);
              }}
            />
          </Field>
          <Field label="State code">
            <input className="doc-field-input" value={form.billTo.stateCode || ''} onChange={(e) => update('billTo.stateCode', e.target.value)} placeholder="e.g. 27" />
          </Field>
          <Field label="State name">
            <input className="doc-field-input" value={form.billTo.stateName || ''} onChange={(e) => update('billTo.stateName', e.target.value)} placeholder="e.g. Maharashtra" />
          </Field>
          <Field label="GSTIN">
            <input className="doc-field-input" value={form.billTo.gstin} onChange={(e) => update('billTo.gstin', e.target.value)} />
          </Field>
          <Field label="PAN">
            <input className="doc-field-input" value={form.billTo.pan} onChange={(e) => update('billTo.pan', e.target.value)} />
          </Field>
          <Field label="Contact person">
            <input className="doc-field-input" value={form.billTo.contactPerson} onChange={(e) => update('billTo.contactPerson', e.target.value)} />
          </Field>
          <Field label="Email">
            <input className="doc-field-input" value={form.billTo.email} onChange={(e) => update('billTo.email', e.target.value)} />
          </Field>
        </div>
      </FormSection>

      <FormSection id="invoice" title="Invoice details" defaultOpen>
        <div className="doc-form-grid">
          <Field label="Invoice number">
            <input className="doc-field-input" style={{ fontFamily: 'ui-monospace, monospace' }} value={form.invoice.documentNumber} onChange={(e) => update('invoice.documentNumber', e.target.value)} />
          </Field>
          <Field label="Project">
            <input className="doc-field-input" value={form.invoice.projectName} onChange={(e) => update('invoice.projectName', e.target.value)} placeholder="e.g. BMD Camp" />
          </Field>
          <Field label="Invoice date">
            <input type="date" className="doc-field-input" value={form.invoice.issueDate} onChange={(e) => update('invoice.issueDate', e.target.value)} />
          </Field>
          <Field label="Due date">
            <input type="date" className="doc-field-input" value={form.invoice.dueDate} onChange={(e) => update('invoice.dueDate', e.target.value)} />
          </Field>
          <Field label="Reverse charge">
            <select className="doc-field-input" value={form.invoice.reverseCharge} onChange={(e) => update('invoice.reverseCharge', e.target.value)}>
              <option value="N">No</option>
              <option value="Y">Yes</option>
            </select>
          </Field>
          <Field label="Receipt voucher">
            <input className="doc-field-input" value={form.invoice.receiptVoucherNo || ''} onChange={(e) => update('invoice.receiptVoucherNo', e.target.value)} />
          </Field>
        </div>
      </FormSection>

      <FormSection id="lines" title="Line items" badge={`${form.lineItems.length}`} defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {form.lineItems.map((line, index) => (
            <LineCard
              key={line.id}
              title={`#${index + 1}`}
              onRemove={form.lineItems.length > 1 ? () => removeLine(index) : undefined}
              footer={
                totals?.lines?.[index] ? (
                  <span>
                    Total <strong>₹{formatMoney(totals.lines[index].totalAmount)}</strong>
                  </span>
                ) : null
              }
            >
              <div className="doc-form-grid">
                <Field label="Description" className="doc-span-2">
                  <input className="doc-field-input" value={line.description} onChange={(e) => updateLine(index, { description: e.target.value })} />
                </Field>
                <Field label="SAC code">
                  <input className="doc-field-input" value={line.hsnSac} onChange={(e) => updateLine(index, { hsnSac: e.target.value })} />
                </Field>
                <Field label="Qty">
                  <input type="number" className="doc-field-input" value={line.qty} onChange={(e) => updateLine(index, { qty: e.target.value })} />
                </Field>
                <Field label="Rate (₹)">
                  <input type="number" className="doc-field-input" value={line.rate} onChange={(e) => updateLine(index, { rate: e.target.value })} />
                </Field>
                <Field label="Discount">
                  <input type="number" className="doc-field-input" value={line.discount} onChange={(e) => updateLine(index, { discount: e.target.value })} />
                </Field>
                <Field label="IGST %">
                  <input type="number" className="doc-field-input" value={line.igstRate} onChange={(e) => updateLine(index, { igstRate: e.target.value })} />
                </Field>
              </div>
            </LineCard>
          ))}
          <button type="button" className="doc-link-btn" onClick={addLine}>
            + Add line item
          </button>
        </div>
      </FormSection>

      <FormSection id="adjustments" title="Adjustments & terms" defaultOpen={false}>
        <div className="doc-form-grid">
          <Field label="CN amount">
            <input type="number" className="doc-field-input" value={form.adjustments?.cnAmount || 0} onChange={(e) => update('adjustments.cnAmount', e.target.value)} />
          </Field>
          <Field label="DN amount">
            <input type="number" className="doc-field-input" value={form.adjustments?.dnAmount || 0} onChange={(e) => update('adjustments.dnAmount', e.target.value)} />
          </Field>
          <Field label="Advance received">
            <input type="number" className="doc-field-input" value={form.adjustments?.advanceReceived || 0} onChange={(e) => update('adjustments.advanceReceived', e.target.value)} />
          </Field>
          <Field label="CN reference">
            <input className="doc-field-input" value={form.invoice.cnReference || ''} onChange={(e) => update('invoice.cnReference', e.target.value)} />
          </Field>
          <Field label="DN reference">
            <input className="doc-field-input" value={form.invoice.dnReference || ''} onChange={(e) => update('invoice.dnReference', e.target.value)} />
          </Field>
        </div>
        <div className="doc-terms-list doc-span-2">
          {form.terms.map((term, index) => (
            <div key={index} className="doc-term-row">
              <span className="doc-term-num">{index + 1}.</span>
              <input className="doc-field-input" value={term} onChange={(e) => updateTerm(index, e.target.value)} />
            </div>
          ))}
          <button type="button" className="doc-link-btn" onClick={addTerm}>
            + Add term
          </button>
        </div>
      </FormSection>
    </>
  );
}

function buildInitialForm(orgMaster) {
  const draft = loadInvoiceDraft();
  const base = draft || defaultInvoiceForm();
  const cached = orgMaster || loadOrgMasterCache();
  return cached ? applyOrgMasterToInvoiceForm(base, cached) : base;
}

export function useInvoiceFormState() {
  const { data: orgMaster } = useCommercialOrgMaster();
  const [form, setForm] = useState(() => buildInitialForm());
  const [savedAt, setSavedAt] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!orgMaster) return;
    setForm((prev) => applyOrgMasterToInvoiceForm(prev, orgMaster));
  }, [orgMaster]);

  const totals = useMemo(() => {
    const taxMode = usesIgst(form.billTo?.stateCode, form.company?.stateCode) ? 'igst' : 'cgst_sgst';
    return computeInvoiceTotals(form.lineItems, taxMode, form.adjustments || {});
  }, [form.lineItems, form.billTo?.stateCode, form.company?.stateCode, form.adjustments]);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const toSave = orgMaster ? applyOrgMasterToInvoiceForm(form, orgMaster) : form;
      saveInvoiceDraft(toSave);
      setSavedAt(new Date());
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [form, orgMaster]);

  const resetForm = () => {
    const fresh = defaultInvoiceForm();
    fresh.invoice.documentNumber = nextInvoiceNumber(fresh.invoice.issueDate);
    const next = orgMaster ? applyOrgMasterToInvoiceForm(fresh, orgMaster) : fresh;
    setForm(next);
    saveInvoiceDraft(next);
  };

  const clearDraft = () => {
    clearInvoiceDraft();
    const fresh = defaultInvoiceForm();
    const next = orgMaster ? applyOrgMasterToInvoiceForm(fresh, orgMaster) : fresh;
    setForm(next);
  };

  return { form, setForm, totals, savedAt, resetForm, clearDraft, orgMaster };
}
