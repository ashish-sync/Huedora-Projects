import OtherAwareSelect from '../../components/ui/OtherAwareSelect.jsx';
import FilePicker from '../../components/ui/FilePicker.jsx';
import { PhoneField } from '../../components/ui/PhoneField.jsx';
import { ClientMasterStateSelect } from '../camps/components/ClientMasterStateSelect.jsx';
import { gstStateNameForCode } from '../camps/utils/indiaGstStateCodes.js';

function digits(value, max) {
  return String(value || '').replace(/\D+/g, '').slice(0, max);
}

/**
 * Vendor Master create/edit grid — six fixed rows for Finance One.
 */
export default function VendorMasterFormGrid({
  form,
  setForm,
  supplyCategoryOptions = [],
  vendorCode = '',
  pdfPickerKey = 0,
  pdfFile = null,
  existingDocument = null,
  onPdfPick,
  onOpenDocument,
  busy = false,
}) {
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="logistics-form-grid logistics-form-grid--vendor">
      <div className="field">
        <label htmlFor="lm-name">Legal Name</label>
        <input
          id="lm-name"
          required
          value={form.name || ''}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="lm-supplyCategory">Supply Category</label>
        <OtherAwareSelect
          id="lm-supplyCategory"
          required
          picklistKey="contact.supplyCategory"
          source="vendor-master"
          options={supplyCategoryOptions}
          value={form.supplyCategory || ''}
          onChange={(e) => set({ supplyCategory: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="lm-code">Vendor Code</label>
        <input
          id="lm-code"
          value={vendorCode}
          placeholder="Assigned on save"
          readOnly
          disabled
        />
      </div>

      <div className="field">
        <label htmlFor="lm-contactName">Contact Name</label>
        <input
          id="lm-contactName"
          value={form.contactName || ''}
          onChange={(e) => set({ contactName: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="lm-phone">Contact Number</label>
        <PhoneField
          id="lm-phone"
          hideLabel
          aria-label="Contact Number"
          label="Contact Number"
          value={form.phone || ''}
          onChange={(phone) => set({ phone })}
        />
      </div>
      <div className="field">
        <label htmlFor="lm-email">Email Address</label>
        <input
          id="lm-email"
          type="email"
          value={form.email || ''}
          onChange={(e) => set({ email: e.target.value })}
        />
      </div>

      <div className="field logistics-form-field--full">
        <label htmlFor="lm-address">Billing Address</label>
        <textarea
          id="lm-address"
          rows={3}
          value={form.address || ''}
          onChange={(e) => set({ address: e.target.value })}
        />
      </div>

      <div className="field">
        <label htmlFor="lm-pinCode">PIN Code</label>
        <input
          id="lm-pinCode"
          inputMode="numeric"
          maxLength={6}
          value={form.pinCode || ''}
          onChange={(e) => set({ pinCode: digits(e.target.value, 6) })}
        />
      </div>
      <div className="field">
        <label htmlFor="lm-state">State</label>
        <ClientMasterStateSelect
          id="lm-state"
          stateName={form.state || ''}
          stateCode={form.stateCode || ''}
          showStateCode
          onChange={({ stateName, stateCode }) => set({ state: stateName, stateCode })}
        />
      </div>
      <div className="field">
        <label htmlFor="lm-gstin">GSTIN</label>
        <input
          id="lm-gstin"
          maxLength={15}
          placeholder="15-character GSTIN"
          value={form.gstin || ''}
          onChange={(e) => {
            const gstin = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
            const fromGst = /^\d{2}/.test(gstin) ? gstin.slice(0, 2) : '';
            const fromGstName = fromGst ? gstStateNameForCode(fromGst) : '';
            set({
              gstin,
              ...(fromGst ? { stateCode: fromGst, ...(fromGstName ? { state: fromGstName } : {}) } : {}),
            });
          }}
        />
      </div>

      <div className="field">
        <label htmlFor="lm-panCard">PAN Card</label>
        <input
          id="lm-panCard"
          maxLength={10}
          placeholder="AAAAA0000A"
          value={form.panCard || ''}
          onChange={(e) => set({ panCard: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) })}
        />
      </div>
      <div className="field">
        <label htmlFor="lm-ifscCode">IFSC Code</label>
        <input
          id="lm-ifscCode"
          maxLength={11}
          value={form.ifscCode || ''}
          onChange={(e) => set({ ifscCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11) })}
        />
      </div>
      <div className="field">
        <label htmlFor="lm-bankName">Bank Name</label>
        <input
          id="lm-bankName"
          value={form.bankName || ''}
          onChange={(e) => set({ bankName: e.target.value })}
        />
      </div>

      <div className="field">
        <label htmlFor="lm-accountNumber">Account Number</label>
        <input
          id="lm-accountNumber"
          inputMode="numeric"
          value={form.accountNumber || ''}
          onChange={(e) => set({ accountNumber: digits(e.target.value, 18) })}
        />
      </div>
      <div className="field">
        <label htmlFor="lm-remarks">Remark</label>
        <input
          id="lm-remarks"
          value={form.remarks || ''}
          onChange={(e) => set({ remarks: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="lm-vendor-pdf">Upload File</label>
        <FilePicker
          key={pdfPickerKey}
          id="lm-vendor-pdf"
          accept=".pdf,application/pdf"
          buttonLabel={pdfFile ? 'Replace file' : 'Browse'}
          emptyLabel="Choose PDF"
          disabled={busy}
          onChange={onPdfPick}
        />
        {existingDocument?.name || existingDocument?.url ? (
          <p className="muted logistics-form-hint">
            Current file: {existingDocument.name || 'Vendor file'}
            {onOpenDocument ? (
              <>
                {' · '}
                <button type="button" className="inv-link" onClick={onOpenDocument}>
                  View
                </button>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}
