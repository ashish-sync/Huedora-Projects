import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Field,
  FormSection,
  LineCard,
} from '../documentGenerator/formUi.jsx';
import {
  applyOrgMasterToProformaForm,
  loadOrgMasterCache,
} from '../commercialOrgMaster.js';
import { useCommercialOrgMaster } from '../useCommercialOrgMaster.js';
import { computeProformaDocument } from './proformaCalculations.js';
import { usesIgst } from '../invoiceGenerator/invoiceCalculations.js';
import {
  clearProformaDraft,
  defaultLineRow,
  defaultProformaForm,
  defaultSectionRow,
  loadProformaDraft,
  nextProformaNumber,
  saveProformaDraft,
} from './proformaStorage.js';

export default function ProformaGeneratorForm({ form, setForm, doc }) {
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

  const updateRow = (id, patch) => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const removeRow = (id) => {
    setForm((prev) => ({ ...prev, rows: prev.rows.filter((r) => r.id !== id) }));
  };

  const addLine = () => {
    setForm((prev) => ({ ...prev, rows: [...prev.rows, defaultLineRow()] }));
  };

  const addSection = () => {
    setForm((prev) => {
      const letter = String.fromCharCode(65 + prev.rows.filter((r) => r.type === 'section').length);
      return {
        ...prev,
        rows: [...prev.rows, defaultSectionRow(`${letter}. Section heading`)],
      };
    });
  };

  const updateTerm = (index, value) => {
    setForm((prev) => {
      const terms = [...prev.terms];
      terms[index] = value;
      return { ...prev, terms };
    });
  };

  const lineCount = form.rows.filter((r) => r.type === 'line').length;

  return (
    <>
      <p className="doc-master-hint">
        Company, bank &amp; GSTIN are prefilled from{' '}
        <a href="/finance/master">Organisation master</a>. Add recipient, project, and line items below.
      </p>

      <FormSection id="document" title="Proforma details" defaultOpen>
        <div className="doc-form-grid">
          <Field label="Document number">
            <input className="doc-field-input" style={{ fontFamily: 'ui-monospace, monospace' }} value={form.document.documentNumber} onChange={(e) => update('document.documentNumber', e.target.value)} />
          </Field>
          <Field label="Reference">
            <input className="doc-field-input" value={form.document.reference} onChange={(e) => update('document.reference', e.target.value)} />
          </Field>
          <Field label="Creation date">
            <input type="date" className="doc-field-input" value={form.document.issueDate} onChange={(e) => update('document.issueDate', e.target.value)} />
          </Field>
          <Field label="Due date">
            <input type="date" className="doc-field-input" value={form.document.dueDate} onChange={(e) => update('document.dueDate', e.target.value)} />
          </Field>
          <Field label="Payment terms (days)">
            <input type="number" className="doc-field-input" value={form.document.paymentTermsDays} onChange={(e) => update('document.paymentTermsDays', e.target.value)} />
          </Field>
          <Field label="Custom notes / remarks" className="doc-span-2">
            <textarea className="doc-field-input" rows={2} value={form.document.customNotes} onChange={(e) => update('document.customNotes', e.target.value)} />
          </Field>
        </div>
      </FormSection>

      <FormSection id="recipient" title="Recipient" defaultOpen>
        <div className="doc-form-grid">
          <Field label="Customer name">
            <input className="doc-field-input" value={form.recipient.name} onChange={(e) => update('recipient.name', e.target.value)} />
          </Field>
          <Field label="Project">
            <input className="doc-field-input" value={form.recipient.projectName} onChange={(e) => update('recipient.projectName', e.target.value)} />
          </Field>
          <Field label="Place of supply" className="doc-span-2">
            <textarea className="doc-field-input" rows={2} value={form.recipient.placeOfSupply} onChange={(e) => update('recipient.placeOfSupply', e.target.value)} />
          </Field>
          <Field label="Delivery address" className="doc-span-2">
            <textarea className="doc-field-input" rows={2} value={form.recipient.deliveryAddress} onChange={(e) => update('recipient.deliveryAddress', e.target.value)} />
          </Field>
          <Field label="Contact person">
            <input className="doc-field-input" value={form.recipient.contactPerson} onChange={(e) => update('recipient.contactPerson', e.target.value)} />
          </Field>
          <Field label="Email">
            <input className="doc-field-input" value={form.recipient.contactEmail} onChange={(e) => update('recipient.contactEmail', e.target.value)} />
          </Field>
          <Field label="GSTIN">
            <input className="doc-field-input" value={form.recipient.recipientGstin} onChange={(e) => update('recipient.recipientGstin', e.target.value)} />
          </Field>
          <Field label="PAN">
            <input className="doc-field-input" value={form.recipient.recipientPan} onChange={(e) => update('recipient.recipientPan', e.target.value)} />
          </Field>
          <Field label="State code" hint="Used for IGST vs CGST/SGST">
            <input className="doc-field-input" value={form.recipient.stateCode} onChange={(e) => update('recipient.stateCode', e.target.value)} />
          </Field>
        </div>
      </FormSection>

      <FormSection id="lines" title="Line items" badge={`${lineCount}`} defaultOpen>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {form.rows.map((row) =>
            row.type === 'section' ? (
              <div key={row.id} className="doc-section-row">
                <span className="doc-section-row-mark">§</span>
                <input
                  className="doc-field-input"
                  style={{ fontWeight: 600 }}
                  value={row.title}
                  onChange={(e) => updateRow(row.id, { title: e.target.value })}
                  placeholder="A. Section heading"
                />
                <button type="button" className="doc-line-remove" onClick={() => removeRow(row.id)}>
                  Remove
                </button>
              </div>
            ) : (
              <LineCard
                key={row.id}
                title="Product line"
                onRemove={() => removeRow(row.id)}
              >
                <div className="doc-form-grid">
                  <Field label="Product name" className="doc-span-2">
                    <input className="doc-field-input" value={row.description} onChange={(e) => updateRow(row.id, { description: e.target.value })} />
                  </Field>
                  <Field label="HSN/SAC">
                    <input className="doc-field-input" value={row.hsnSac} onChange={(e) => updateRow(row.id, { hsnSac: e.target.value })} />
                  </Field>
                  <Field label="IGST %">
                    <input type="number" className="doc-field-input" value={row.igstRate} onChange={(e) => updateRow(row.id, { igstRate: e.target.value })} />
                  </Field>
                  <Field label="Qty">
                    <input type="number" className="doc-field-input" value={row.qty} onChange={(e) => updateRow(row.id, { qty: e.target.value })} />
                  </Field>
                  <Field label="Unit rate">
                    <input type="number" className="doc-field-input" value={row.rate} onChange={(e) => updateRow(row.id, { rate: e.target.value })} />
                  </Field>
                  <Field label="Discount">
                    <input type="number" className="doc-field-input" value={row.discount} onChange={(e) => updateRow(row.id, { discount: e.target.value })} />
                  </Field>
                </div>
              </LineCard>
            )
          )}
          <div className="doc-form-actions">
            <button type="button" className="doc-link-btn" onClick={addSection}>
              + Add section (A, B…)
            </button>
            <button type="button" className="doc-link-btn" onClick={addLine}>
              + Add product line
            </button>
          </div>
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
        </div>
        <div className="doc-terms-list doc-span-2">
          {form.terms.map((term, index) => (
            <div key={index} className="doc-term-row">
              <span className="doc-term-num">{index + 1}.</span>
              <input className="doc-field-input" value={term} onChange={(e) => updateTerm(index, e.target.value)} />
            </div>
          ))}
          <button
            type="button"
            className="doc-link-btn"
            onClick={() => setForm((prev) => ({ ...prev, terms: [...prev.terms, ''] }))}
          >
            + Add term
          </button>
        </div>
      </FormSection>
    </>
  );
}

export function useProformaFormState() {
  const { data: orgMaster } = useCommercialOrgMaster();
  const [form, setForm] = useState(() => {
    const draft = loadProformaDraft();
    const base = draft || defaultProformaForm();
    const cached = loadOrgMasterCache();
    return cached ? applyOrgMasterToProformaForm(base, cached) : base;
  });
  const [savedAt, setSavedAt] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    if (!orgMaster) return;
    setForm((prev) => applyOrgMasterToProformaForm(prev, orgMaster));
  }, [orgMaster]);

  const doc = useMemo(() => {
    const taxMode = usesIgst(form.recipient?.stateCode, form.company?.stateCode) ? 'igst' : 'cgst_sgst';
    return computeProformaDocument(form.rows, taxMode, form.adjustments);
  }, [form.rows, form.recipient?.stateCode, form.company?.stateCode, form.adjustments]);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const toSave = orgMaster ? applyOrgMasterToProformaForm(form, orgMaster) : form;
      saveProformaDraft(toSave);
      setSavedAt(new Date());
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [form, orgMaster]);

  const resetForm = () => {
    const fresh = defaultProformaForm();
    fresh.document.documentNumber = nextProformaNumber(fresh.document.issueDate);
    const next = orgMaster ? applyOrgMasterToProformaForm(fresh, orgMaster) : fresh;
    setForm(next);
    saveProformaDraft(next);
  };

  const clearDraft = () => {
    clearProformaDraft();
    const fresh = defaultProformaForm();
    const next = orgMaster ? applyOrgMasterToProformaForm(fresh, orgMaster) : fresh;
    setForm(next);
  };

  return { form, setForm, doc, savedAt, resetForm, clearDraft, orgMaster };
}
