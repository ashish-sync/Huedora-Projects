import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import { DateInput } from '../../components/ui/DateInput.jsx';
import FeedbackBanner from '../../components/ui/FeedbackBanner.jsx';
import { api } from '../../shared/api.js';
import { formatDate } from '../../shared/dateFormat.js';
import { useAuth } from '../../shared/auth.jsx';
import { NAV } from '../../shared/labels.js';
import { isVendorContact } from '../agreements/contactPicklists.js';
import {
  VENDOR_BILL_EDITABLE_STATUSES,
  VENDOR_BILL_PAYABLE_STATUSES,
  formatVendorBillMoney,
  normalizeVendorBillStatus,
  vendorBillStatusLabel,
} from './vendorBillConstants.js';
import './finance-commercial.css';
import { validateUploadFile } from '../../shared/importErrors.js';

const EMPTY_FORM = {
  billNumber: '',
  vendorName: '',
  contactId: '',
  billDate: '',
  dueDate: '',
  amount: '',
  taxAmount: '',
  totalAmount: '',
  expenseCategory: '',
  expenseSubCategory: '',
  expenseSubCategoryId: '',
  remarks: '',
  paymentMode: 'Bank transfer',
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(dateText, days = 30) {
  const text = String(dateText || '').trim();
  const base = text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

function toMoneyInput(v) {
  if (v == null || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : '';
}

function computeTaxableAmount(totalAmount, taxAmount) {
  const total = Number(totalAmount || 0);
  const tax = Number(taxAmount || 0);
  const taxable = Math.round((total - tax) * 100) / 100;
  return taxable > 0 ? taxable : 0;
}

function computeTaxRate(totalAmount, taxAmount) {
  const taxable = computeTaxableAmount(totalAmount, taxAmount);
  if (!(taxable > 0)) return 0;
  const tax = Number(taxAmount || 0);
  return Math.round((tax / taxable) * 10000) / 100;
}

function billToForm(bill) {
  if (!bill) {
    const billDate = todayIso();
    return { ...EMPTY_FORM, billDate, dueDate: addDaysIso(billDate, 30) };
  }
  const billDate = bill.billDate || bill.invoiceDate || todayIso();
  return {
    billNumber: bill.billNumber || bill.invoiceNumber || '',
    vendorName: bill.vendorName || '',
    contactId: bill.contactId ? String(bill.contactId) : '',
    billDate,
    dueDate: bill.dueDate || addDaysIso(billDate, 30),
    amount: toMoneyInput(bill.amount),
    taxAmount: toMoneyInput(bill.taxAmount),
    totalAmount: toMoneyInput(bill.totalAmount),
    expenseCategory: bill.expenseCategory || '',
    expenseSubCategory: bill.expenseSubCategory || '',
    expenseSubCategoryId: bill.expenseSubCategoryId ? String(bill.expenseSubCategoryId) : '',
    remarks: bill.remarks || '',
    paymentMode: bill.paymentMode || 'Bank transfer',
  };
}

export default function FinanceVendorBillDetailPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { can } = useAuth();
  const canWrite = can('finance:write') || can('*');

  const [bill, setBill] = useState(null);
  const [form, setForm] = useState(() => billToForm(null));
  const [vendorContacts, setVendorContacts] = useState([]);
  const [expenseMaster, setExpenseMaster] = useState({
    expenseCategories: [],
    expenseSubCategories: [],
  });
  const [billFiles, setBillFiles] = useState([]);
  const attachmentInputRef = useRef(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [verifyRemark, setVerifyRemark] = useState('');
  const [payDraft, setPayDraft] = useState({
    paidAmount: '',
    transactionId: '',
    paymentRemark: '',
    paymentMode: 'Bank transfer',
  });

  const status = normalizeVendorBillStatus(bill?.status);
  const editable = isNew || VENDOR_BILL_EDITABLE_STATUSES.has(status);
  const payable = VENDOR_BILL_PAYABLE_STATUSES.has(status);
  const existingAttachments = Array.isArray(bill?.attachments) ? bill.attachments : [];

  const expenseCategories = expenseMaster.expenseCategories || [];
  const expenseSubCategories = expenseMaster.expenseSubCategories || [];

  const expenseSubCategoryNames = useMemo(() => {
    const names = expenseSubCategories
      .map((row) => String(row.name || '').trim())
      .filter(Boolean);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [expenseSubCategories]);

  const categoriesForSelectedSub = useMemo(() => {
    const selectedName = String(form.expenseSubCategory || '').trim().toLowerCase();
    if (!selectedName) return [];
    const categoryIds = expenseSubCategories
      .filter((row) => String(row.name || '').trim().toLowerCase() === selectedName)
      .map((row) => String(row.categoryId || row.expenseCategoryId || ''));
    const uniqueIds = [...new Set(categoryIds.filter(Boolean))];
    return expenseCategories.filter((category) => uniqueIds.includes(String(category._id)));
  }, [expenseCategories, expenseSubCategories, form.expenseSubCategory]);

  const expenseCategoryLocked = categoriesForSelectedSub.length === 1;

  const loadBill = useCallback(async () => {
    if (isNew) {
      setBill(null);
      setForm(billToForm(null));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api(`/finance/vendor-bills/${id}`);
      const data = res.data;
      setBill(data);
      setForm(billToForm(data));
      setVerifyRemark(data.verificationRemark || '');
      setPayDraft({
        paidAmount: toMoneyInput(data.balance > 0 ? data.balance : data.totalAmount),
        transactionId: data.transactionId || '',
        paymentRemark: data.paymentRemark || '',
        paymentMode: data.paymentMode || 'Bank transfer',
      });
    } catch (err) {
      setError(err.message || 'Could not load vendor bill');
      setBill(null);
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    loadBill();
  }, [loadBill]);

  useEffect(() => {
    api('/contacts?limit=500&contactCategory=Vendor')
      .then((r) => setVendorContacts((r.data || []).filter((c) => isVendorContact(c))))
      .catch(() => setVendorContacts([]));
    api('/logistics/expense-master')
      .then((r) =>
        setExpenseMaster({
          expenseCategories: r.data?.expenseCategories || [],
          expenseSubCategories: r.data?.expenseSubCategories || [],
        })
      )
      .catch(() => setExpenseMaster({ expenseCategories: [], expenseSubCategories: [] }));
  }, []);

  function pickVendor(contactId) {
    const contact = vendorContacts.find((row) => String(row._id) === String(contactId));
    setForm((prev) => ({
      ...prev,
      contactId,
      vendorName: contact?.name || prev.vendorName,
    }));
  }

  function pickExpenseSubCategory(subCategoryName) {
    const selectedName = String(subCategoryName || '').trim();
    const matches = expenseSubCategories.filter(
      (row) => String(row.name || '').trim().toLowerCase() === selectedName.toLowerCase(),
    );
    const categoryIds = [
      ...new Set(matches.map((row) => String(row.categoryId || row.expenseCategoryId || '')).filter(Boolean)),
    ];
    const category =
      categoryIds.length === 1
        ? expenseCategories.find((row) => String(row._id) === categoryIds[0]) || null
        : null;
    const subId = matches[0]?._id ? String(matches[0]._id) : '';
    setForm((prev) => ({
      ...prev,
      expenseSubCategory: selectedName,
      expenseSubCategoryId: subId,
      expenseCategory: category?.name || (categoryIds.length ? prev.expenseCategory : ''),
    }));
  }

  function pickExpenseCategory(categoryName) {
    setForm((prev) => ({ ...prev, expenseCategory: categoryName }));
  }

  const derivedTaxableAmount = useMemo(
    () => computeTaxableAmount(form.totalAmount, form.taxAmount),
    [form.taxAmount, form.totalAmount],
  );
  const derivedTaxRate = useMemo(
    () => computeTaxRate(form.totalAmount, form.taxAmount),
    [form.taxAmount, form.totalAmount],
  );

  function recomputeAmounts(next) {
    const amount = computeTaxableAmount(next.totalAmount, next.taxAmount);
    return { ...next, amount: Number.isFinite(amount) ? String(amount) : next.amount };
  }

  function patchForm(patch) {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (patch.billDate != null) {
        const prevDefaultDueDate = addDaysIso(prev.billDate || todayIso(), 30);
        const dueDateWasDefault = !prev.dueDate || prev.dueDate === prevDefaultDueDate;
        if (dueDateWasDefault) {
          next.dueDate = addDaysIso(patch.billDate || todayIso(), 30);
        }
      }
      if (patch.totalAmount != null || patch.taxAmount != null) return recomputeAmounts(next);
      return next;
    });
  }

  function payloadFromForm() {
    return {
      billNumber: form.billNumber.trim(),
      vendorName: form.vendorName.trim(),
      contactId: form.contactId || null,
      billDate: form.billDate || todayIso(),
      dueDate: form.dueDate || '',
      amount: computeTaxableAmount(form.totalAmount, form.taxAmount),
      taxAmount: Number(form.taxAmount || 0),
      totalAmount: Number(form.totalAmount || 0),
      expenseCategory: form.expenseCategory.trim(),
      expenseSubCategory: form.expenseSubCategory.trim(),
      expenseSubCategoryId: form.expenseSubCategoryId || null,
      remarks: form.remarks.trim(),
      paymentMode: form.paymentMode,
    };
  }

  async function uploadAttachment(billId) {
    if (!billFiles.length) return null;
    for (const file of billFiles) {
      const pre = validateUploadFile(file, {
        maxBytes: 10 * 1024 * 1024,
        acceptExt: ['.pdf', '.png', '.jpg', '.jpeg', '.webp'],
        label: 'vendor bill',
      });
      if (pre) throw new Error(pre);
    }
    const body = new FormData();
    billFiles.forEach((file) => body.append('bills', file));
    const res = await api(`/finance/vendor-bills/${billId}/attachment`, {
      method: 'POST',
      body,
    });
    setBillFiles([]);
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    return res.data;
  }

  async function persistBill() {
    let saved;
    if (isNew) {
      const created = await api('/finance/vendor-bills', {
        method: 'POST',
        body: payloadFromForm(),
      });
      saved = created.data;
      if (billFiles.length) {
        saved = (await uploadAttachment(saved._id)) || saved;
      }
      return saved;
    }
    const updated = await api(`/finance/vendor-bills/${id}`, {
      method: 'PATCH',
      body: payloadFromForm(),
    });
    saved = updated.data;
    if (billFiles.length) {
      saved = (await uploadAttachment(id)) || saved;
    }
    return saved;
  }

  async function saveBill() {
    if (!canWrite) return null;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const saved = await persistBill();
      if (isNew) {
        setMsg('Vendor bill created.');
        navigate(`/finance-one/vendor-bills/${saved._id}`, { replace: true });
        return saved;
      }
      setBill(saved);
      setForm(billToForm(saved));
      setMsg('Vendor bill saved.');
      return saved;
    } catch (err) {
      setError(err.message || 'Could not save vendor bill');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function transition(nextStatus, extra = {}) {
    if (!canWrite || isNew) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      if (editable && (nextStatus === 'submitted' || billFiles.length)) {
        const saved = await persistBill();
        setBill(saved);
        setForm(billToForm(saved));
      }
      const res = await api(`/finance/vendor-bills/${id}/transition`, {
        method: 'POST',
        body: { status: nextStatus, ...extra },
      });
      setBill(res.data);
      setForm(billToForm(res.data));
      setMsg(`Status updated to ${vendorBillStatusLabel(res.data.status)}.`);
      setRejectReason('');
    } catch (err) {
      setError(err.message || 'Status update failed');
    } finally {
      setBusy(false);
    }
  }

  async function recordPayment() {
    if (!canWrite || !payable) return;
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const res = await api(`/finance/vendor-bills/${id}/pay`, {
        method: 'POST',
        body: {
          paidAmount: Number(payDraft.paidAmount || 0),
          transactionId: payDraft.transactionId.trim(),
          paymentRemark: payDraft.paymentRemark.trim(),
          paymentMode: payDraft.paymentMode,
        },
      });
      setBill(res.data);
      setForm(billToForm(res.data));
      setMsg(res.data.status === 'paid' ? 'Bill marked paid and archived.' : 'Partial payment recorded.');
      setPayDraft({
        paidAmount: toMoneyInput(res.data.balance),
        transactionId: res.data.transactionId || '',
        paymentRemark: res.data.paymentRemark || '',
        paymentMode: res.data.paymentMode || 'Bank transfer',
      });
    } catch (err) {
      setError(err.message || 'Payment failed');
    } finally {
      setBusy(false);
    }
  }

  function openDoc(url, label) {
    const href = String(url || '').trim();
    if (!href) {
      setError(`${label} is not available`);
      return;
    }
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  function openAttachmentPicker() {
    if (!editable || !canWrite) return;
    attachmentInputRef.current?.click();
  }

  function viewSelectedAttachment() {
    if (billFiles.length !== 1) return;
    const file = billFiles[0];
    const href = URL.createObjectURL(file);
    window.open(href, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
  }

  function clearSelectedAttachments() {
    setBillFiles([]);
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  }

  if (loading) {
    return (
      <div className="finance-hub">
        <section className="finance-hub-panel card finance-vendor-bill-detail">
          <div className="finance-vendor-bill-toolbar">
            <p className="muted">Loading vendor bill…</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="finance-hub">
      <section className="finance-hub-panel card finance-vendor-bill-detail">
        <div className="finance-vendor-bill-toolbar">
          <div className="finance-docs-head finance-docs-head--embedded">
            <div>
              <p className="muted">
                <Link to="/finance-one/vendor-bills">{NAV.VENDOR_BILLS}</Link>
                {' / '}
                {isNew ? 'New' : bill?.invoiceKey || id}
              </p>
              <h3 className="finance-docs-title">
                {isNew ? 'New vendor bill' : bill?.billNumber || bill?.invoiceNumber || 'Vendor bill'}
              </h3>
              {!isNew ? (
                <p className="muted">
                  Status: <strong>{vendorBillStatusLabel(status)}</strong>
                  {bill?.archivedAt ? ` · Archived ${formatDate(bill.archivedAt)}` : ''}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="finance-vendor-bill-body">
          {error ? <FeedbackBanner variant="error">{error}</FeedbackBanner> : null}
          {msg ? <FeedbackBanner variant="success">{msg}</FeedbackBanner> : null}

          <div className="form-grid finance-vendor-bill-form">
          <div className="field">
            <label>Vendor *</label>
            <AdaptiveSelect
              required
              threshold={1}
              disabled={!editable || !canWrite}
              placeholder="Search vendor…"
              value={form.contactId}
              onChange={(e) => pickVendor(e.target.value)}
            >
              <option value="">Select from Contact Directory (Vendor)</option>
              {vendorContacts.map((contact) => (
                <option key={contact._id} value={contact._id}>
                  {contact.name || 'Unnamed'}
                  {contact.city ? ` · ${contact.city}` : ''}
                </option>
              ))}
            </AdaptiveSelect>
          </div>
          <div className="field">
            <label>Vendor name *</label>
            <input
              required
              disabled={!editable || !canWrite}
              value={form.vendorName}
              onChange={(e) => patchForm({ vendorName: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Bill number *</label>
            <input
              required
              disabled={!editable || !canWrite}
              value={form.billNumber}
              onChange={(e) => patchForm({ billNumber: e.target.value })}
            />
          </div>
          <DateInput
            label="Bill date *"
            required
            disabled={!editable || !canWrite}
            value={form.billDate}
            onChange={(value) => patchForm({ billDate: value })}
          />
          <DateInput
            label="Due date"
            disabled={!editable || !canWrite}
            value={form.dueDate}
            onChange={(value) => patchForm({ dueDate: value })}
          />
          <div className="field">
            <label>Tax amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              disabled={!editable || !canWrite}
              value={form.taxAmount}
              onChange={(e) => patchForm({ taxAmount: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Total invoice amount *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              disabled={!editable || !canWrite}
              value={form.totalAmount}
              onChange={(e) => patchForm({ totalAmount: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Taxable amount</label>
            <input readOnly value={toMoneyInput(derivedTaxableAmount)} />
          </div>
          <div className="field">
            <label>Tax Slab (%)</label>
            <input readOnly value={derivedTaxRate > 0 ? `${derivedTaxRate}%` : '—'} />
          </div>
          <div className="field">
            <label>Expense Sub-Category *</label>
            <AdaptiveSelect
              required
              threshold={1}
              disabled={!editable || !canWrite}
              placeholder="Search expense sub-category…"
              value={form.expenseSubCategory}
              onChange={(e) => pickExpenseSubCategory(e.target.value)}
            >
              <option value="">
                {expenseSubCategoryNames.length
                  ? 'Search or select sub-category'
                  : 'No sub-categories in Expense Master'}
              </option>
              {expenseSubCategoryNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </AdaptiveSelect>
          </div>
          <div className="field">
            <label>Expense Category *</label>
            {expenseCategoryLocked ? (
              <input readOnly required value={form.expenseCategory} />
            ) : (
              <AdaptiveSelect
                required
                threshold={1}
                disabled={!editable || !canWrite || !form.expenseSubCategory}
                placeholder="Select expense category…"
                value={form.expenseCategory}
                onChange={(e) => pickExpenseCategory(e.target.value)}
              >
                <option value="">
                  {!form.expenseSubCategory
                    ? 'Select a sub-category first'
                    : categoriesForSelectedSub.length
                      ? 'Select expense category'
                      : 'No categories for this sub-category'}
                </option>
                {categoriesForSelectedSub.map((category) => (
                  <option key={category._id} value={category.name}>
                    {category.code ? `${category.code} · ${category.name}` : category.name}
                  </option>
                ))}
              </AdaptiveSelect>
            )}
          </div>
          <div className="field">
            <label>Bill attachment {editable ? '*' : ''}</label>
            <div className="finance-docs-actions">
              {editable && canWrite ? (
                <>
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    style={{ display: 'none' }}
                    onChange={(e) => setBillFiles(Array.from(e.target.files || []))}
                  />
                  <button type="button" className="btn primary btn-compact" onClick={openAttachmentPicker}>
                    Upload
                  </button>
                  {(existingAttachments.length > 0 || billFiles.length > 0) ? (
                    <button type="button" className="btn ghost btn-compact" onClick={openAttachmentPicker}>
                      +
                    </button>
                  ) : null}
                </>
              ) : null}
              {existingAttachments.map((attachment, index) => (
                <button
                  key={`${attachment.url}-${index}`}
                  type="button"
                  className="btn ghost btn-compact"
                  onClick={() => openDoc(attachment.url, attachment.fileName || `Bill ${index + 1}`)}
                >
                  {existingAttachments.length > 1 ? `View ${index + 1}` : 'View bill'}
                </button>
              ))}
            </div>
            {billFiles.length ? (
              <div className="finance-docs-actions">
                {billFiles.length === 1 ? (
                  <button type="button" className="btn ghost btn-compact" onClick={viewSelectedAttachment}>
                    View selected
                  </button>
                ) : (
                  <span className="muted">{billFiles.length} files selected</span>
                )}
                <button type="button" className="btn ghost btn-compact" onClick={clearSelectedAttachments}>
                  Cancel
                </button>
              </div>
            ) : null}
          </div>
          <div className="field field-span-2">
            <label>Remarks</label>
            <textarea
              rows={2}
              disabled={!editable || !canWrite}
              value={form.remarks}
              onChange={(e) => patchForm({ remarks: e.target.value })}
            />
          </div>
          </div>

          {canWrite && editable ? (
            <div className="finance-docs-actions" style={{ marginTop: '1rem' }}>
              <button type="button" className="btn primary" disabled={busy} onClick={saveBill}>
                {busy ? 'Saving…' : isNew ? 'Create draft' : 'Save changes'}
              </button>
              {!isNew && status === 'draft' ? (
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => transition('submitted')}
                >
                  Submit for verification
                </button>
              ) : null}
              {!isNew && status === 'rejected' ? (
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => transition('submitted')}
                >
                  Re-submit for verification
                </button>
              ) : null}
            </div>
          ) : null}

          {!isNew && canWrite && status === 'under_verification' ? (
            <div className="finance-vendor-bill-actions card-inset">
            <h4>Verification</h4>
            <div className="field">
              <label>Verification remark</label>
              <textarea
                rows={2}
                value={verifyRemark}
                onChange={(e) => setVerifyRemark(e.target.value)}
              />
            </div>
            <div className="finance-docs-actions">
              <button
                type="button"
                className="btn primary"
                disabled={busy}
                onClick={() => transition('verified', { verificationRemark: verifyRemark })}
              >
                Mark verified
              </button>
              <button
                type="button"
                className="btn ghost"
                disabled={busy}
                onClick={() =>
                  transition('draft', { verificationRemark: verifyRemark || 'Returned for correction' })
                }
              >
                Return to draft
              </button>
            </div>
            </div>
          ) : null}

          {!isNew && canWrite && status === 'verified' ? (
            <div className="finance-vendor-bill-actions card-inset">
            <h4>Approval</h4>
            <div className="field">
              <label>Rejection reason (if rejecting)</label>
              <textarea
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="finance-docs-actions">
              <button
                type="button"
                className="btn primary"
                disabled={busy}
                onClick={() => transition('approved')}
              >
                Approve
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={busy || !rejectReason.trim()}
                onClick={() => transition('rejected', { rejectionReason: rejectReason.trim() })}
              >
                Reject
              </button>
            </div>
            </div>
          ) : null}

          {!isNew && (payable || status === 'paid') ? (
            <div className="finance-vendor-bill-actions card-inset">
            <h4>Payment</h4>
            <div className="form-grid finance-vendor-bill-form">
              <div className="field">
                <label>Bank</label>
                <input readOnly value={bill?.vendorBankName || '—'} />
              </div>
              <div className="field">
                <label>Account</label>
                <input readOnly value={bill?.vendorAccountNumber || '—'} />
              </div>
              <div className="field">
                <label>IFSC</label>
                <input readOnly value={bill?.vendorIfscCode || '—'} />
              </div>
              <div className="field">
                <label>KYC</label>
                <div className="finance-docs-actions">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => openDoc(bill?.vendorPanCardCopyUrl, 'PAN')}
                  >
                    View PAN
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => openDoc(bill?.vendorPassbookCopyUrl, 'Passbook')}
                  >
                    View Passbook
                  </button>
                </div>
              </div>
              <div className="field">
                <label>Amount due</label>
                <input readOnly value={formatVendorBillMoney(bill?.balance)} />
              </div>
              {payable && canWrite ? (
                <>
                  <div className="field">
                    <label>Payment amount *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={payDraft.paidAmount}
                      onChange={(e) => setPayDraft((p) => ({ ...p, paidAmount: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>UTR / Transaction ID *</label>
                    <input
                      value={payDraft.transactionId}
                      onChange={(e) => setPayDraft((p) => ({ ...p, transactionId: e.target.value }))}
                    />
                  </div>
                  <div className="field">
                    <label>Payment mode</label>
                    <AdaptiveSelect
                      value={payDraft.paymentMode}
                      onChange={(e) => setPayDraft((p) => ({ ...p, paymentMode: e.target.value }))}
                    >
                      <option value="Bank transfer">Bank transfer</option>
                      <option value="UPI">UPI</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                    </AdaptiveSelect>
                  </div>
                  <div className="field field-span-2">
                    <label>Payment remark</label>
                    <textarea
                      rows={2}
                      value={payDraft.paymentRemark}
                      onChange={(e) => setPayDraft((p) => ({ ...p, paymentRemark: e.target.value }))}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="field">
                    <label>Paid amount</label>
                    <input readOnly value={formatVendorBillMoney(bill?.paidAmount)} />
                  </div>
                  <div className="field">
                    <label>UTR</label>
                    <input readOnly value={bill?.transactionId || '—'} />
                  </div>
                  <div className="field">
                    <label>Paid at</label>
                    <input readOnly value={formatDate(bill?.paidAt) || '—'} />
                  </div>
                </>
              )}
            </div>
            {payable && canWrite ? (
              <div className="finance-docs-actions" style={{ marginTop: '0.75rem' }}>
                <button type="button" className="btn primary" disabled={busy} onClick={recordPayment}>
                  {busy ? 'Recording…' : 'Record payment'}
                </button>
              </div>
            ) : null}
            </div>
          ) : null}

          {!isNew && bill?.rejectionReason ? (
            <p className="muted">Rejection reason: {bill.rejectionReason}</p>
          ) : null}
          {!isNew && bill?.verificationRemark ? (
            <p className="muted">Verification remark: {bill.verificationRemark}</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
