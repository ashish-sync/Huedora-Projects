import FilePicker from '../../../components/ui/FilePicker.jsx';
import FieldError from '../../../components/ui/FieldError.jsx';
import {
  CAMP_TERMS,
  CAMP_TERMS_OPTIONS,
  combinePurchaseOrders,
  computePoTaxFields,
  createEmptyPurchaseOrder,
  formatPoMoney,
  parsePoNetValue,
  poAmountInputValue,
  PO_GST_RATE,
  sanitizePoNetInput,
} from '../utils/clientMasterPo.js';

function MultiFileField({
  files = [],
  pendingFiles = [],
  disabled = false,
  fileBusy = false,
  canDeleteFile = false,
  compact = false,
  error = '',
  onSelect,
  onClearPending,
  onPreview,
  onDelete,
}) {
  const count = files.length + pendingFiles.length;
  return (
    <div className={`client-master-camp-terms-files${compact ? ' is-compact' : ''}`}>
      <span className="client-master-po-cell-label">Upload (multi)</span>
      <div className="client-master-po-file-row">
        <FilePicker
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,application/pdf,image/*"
          disabled={disabled || fileBusy}
          buttonLabel={compact ? (count ? `Upload (${count})` : 'Upload') : 'Add files'}
          emptyLabel={
            compact
              ? ''
              : pendingFiles.length
                ? `${pendingFiles.length} file(s) pending`
                : files.length
                  ? `${files.length} file(s) attached`
                  : 'No files chosen'
          }
          className={compact ? 'file-picker--button-only' : ''}
          onChange={(e) => {
            const list = Array.from(e.target.files || []);
            onSelect?.(list);
            e.target.value = '';
          }}
        />
        {!compact && pendingFiles.length && onClearPending ? (
          <button
            type="button"
            className="btn secondary btn-sm"
            disabled={fileBusy}
            onClick={onClearPending}
          >
            Clear pending
          </button>
        ) : null}
      </div>
      {files.length ? (
        <ul className="client-master-camp-terms-file-list">
          {files.map((file) => (
            <li key={file.id || file.storedName || file.fileName}>
              <span className="client-master-po-file-name" title={file.fileName}>
                {file.fileName}
              </span>
              <span className="client-master-po-file-actions">
                {onPreview ? (
                  <button
                    type="button"
                    className="btn secondary btn-sm"
                    disabled={fileBusy}
                    onClick={() => onPreview(file)}
                  >
                    View
                  </button>
                ) : null}
                {canDeleteFile && onDelete ? (
                  <button
                    type="button"
                    className="btn danger btn-sm"
                    disabled={fileBusy}
                    onClick={() => onDelete(file)}
                  >
                    Remove
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {!compact && pendingFiles.length ? (
        <small className="meta-text">
          {pendingFiles.map((f) => f.name).join(', ')} — uploads when you save
        </small>
      ) : null}
      {compact && pendingFiles.length ? (
        <small className="meta-text">{pendingFiles.length} pending save</small>
      ) : null}
      <FieldError message={error} />
    </div>
  );
}

function CompactPoUpload({
  files = [],
  pendingFiles = [],
  disabled = false,
  fileBusy = false,
  canDeleteFile = false,
  error = '',
  onSelect,
  onPreview,
  onDelete,
}) {
  const count = files.length + pendingFiles.length;
  return (
    <div className="client-master-po-upload-cell">
      <div className="client-master-po-upload-controls">
        <FilePicker
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,application/pdf,image/*"
          disabled={disabled || fileBusy}
          buttonLabel={count ? `File (${count})` : 'File'}
          emptyLabel=""
          className="file-picker--button-only"
          onChange={(e) => {
            const list = Array.from(e.target.files || []);
            onSelect?.(list);
            e.target.value = '';
          }}
        />
      </div>
      {(files.length > 0 || pendingFiles.length > 0) && (
        <ul className="client-master-po-upload-chips">
          {files.map((file) => (
            <li key={file.id || file.storedName || file.fileName}>
              <button
                type="button"
                className="client-master-po-upload-chip"
                disabled={fileBusy || !onPreview}
                onClick={() => onPreview?.(file)}
                title={file.fileName}
              >
                {file.fileName}
              </button>
              {canDeleteFile && onDelete ? (
                <button
                  type="button"
                  className="client-master-po-upload-chip-x"
                  disabled={fileBusy}
                  onClick={() => onDelete(file)}
                  aria-label={`Remove ${file.fileName || 'file'}`}
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
          {pendingFiles.map((file, i) => (
            <li key={`pending-${file.name}-${i}`}>
              <span className="client-master-po-upload-chip is-pending" title={file.name}>
                {file.name} (pending)
              </span>
            </li>
          ))}
        </ul>
      )}
      <FieldError message={error} />
    </div>
  );
}

function PoRow({
  row,
  index,
  canRemove,
  disabled,
  fieldErrors = {},
  pendingFiles = [],
  fileBusy = false,
  canDeleteFile = false,
  onChange,
  onRemove,
  onFilesSelect,
  onFilePreview,
  onFileDelete,
}) {
  const applyGst = row.poApplyGst18 !== false;
  const amountRaw = poAmountInputValue(row);
  const entered = parsePoNetValue(amountRaw);
  const tax = computePoTaxFields(Number.isFinite(entered) ? entered : 0, applyGst);
  const gstPct = Math.round(PO_GST_RATE * 100);
  const prefix = `purchaseOrders.${index}`;
  const amountDisplay =
    amountRaw === '' || amountRaw == null ? '' : String(amountRaw);

  return (
    <div className="client-master-po-row-wrap">
      <div className="client-master-po-row">
        <span className="client-master-po-row-index" aria-hidden="true">
          {index + 1}
        </span>

        <div className="client-master-po-cell client-master-po-cell--no" data-label="PO Number">
          <input
            value={row.poNumber || ''}
            onChange={(e) => onChange?.('poNumber', e.target.value)}
            placeholder="PO number"
            aria-label="PO Number"
            disabled={disabled}
            className={fieldErrors[`${prefix}.poNumber`] || fieldErrors.poNumber ? 'input-invalid' : ''}
          />
          <FieldError message={fieldErrors[`${prefix}.poNumber`]} />
        </div>

        <CompactPoUpload
          files={Array.isArray(row.files) ? row.files : []}
          pendingFiles={pendingFiles}
          disabled={disabled}
          fileBusy={fileBusy}
          canDeleteFile={canDeleteFile}
          error={fieldErrors[`${prefix}.files`] || ''}
          onSelect={onFilesSelect}
          onPreview={onFilePreview}
          onDelete={onFileDelete}
        />

        <div className="client-master-po-cell client-master-po-cell--value" data-label="PO Net Value">
          <input
            type="text"
            inputMode="decimal"
            value={amountDisplay}
            onChange={(e) => onChange?.('poAmount', sanitizePoNetInput(e.target.value))}
            placeholder={applyGst ? 'Incl. GST' : '0.00'}
            aria-label={applyGst ? 'PO Net Value inclusive of GST' : 'PO Net Value'}
            disabled={disabled}
            className={fieldErrors[`${prefix}.poNetValue`] ? 'input-invalid' : ''}
          />
          <FieldError message={fieldErrors[`${prefix}.poNetValue`]} />
        </div>

        <div
          className={`client-master-po-cell client-master-po-cell--tax${applyGst ? ' is-on' : ''}`}
          data-label="PO Apply 18% GST"
          aria-live="polite"
        >
          <div
            className="client-master-po-tax-control"
            title={
              applyGst
                ? `Inclusive split · Net ${formatPoMoney(tax.poNetValue)}`
                : `Tick to treat PO value as GST-inclusive (${gstPct}%)`
            }
          >
            <label className={`client-master-po-gst-toggle${applyGst ? ' is-checked' : ''}`}>
              <input
                type="checkbox"
                checked={applyGst}
                disabled={disabled}
                onChange={(e) => onChange?.('poApplyGst18', e.target.checked)}
                aria-label="PO Apply 18% GST"
              />
              <span>{gstPct}%</span>
            </label>
            <span className="client-master-po-tax-amt">
              {applyGst ? formatPoMoney(tax.poGstAmount) : '—'}
            </span>
          </div>
        </div>

        <div className="client-master-po-cell client-master-po-cell--issue" data-label="PO Issue Date">
          <input
            type="date"
            value={row.poIssueDate || ''}
            onChange={(e) => onChange?.('poIssueDate', e.target.value)}
            aria-label="PO Issue Date"
            disabled={disabled}
            className={fieldErrors[`${prefix}.poIssueDate`] ? 'input-invalid' : ''}
          />
          <FieldError message={fieldErrors[`${prefix}.poIssueDate`]} />
        </div>

        <div className="client-master-po-cell client-master-po-cell--expiry" data-label="PO Expiry Date">
          <input
            type="date"
            value={row.poExpiryDate || ''}
            onChange={(e) => onChange?.('poExpiryDate', e.target.value)}
            aria-label="PO Expiry Date"
            disabled={disabled}
            className={fieldErrors[`${prefix}.poExpiryDate`] ? 'input-invalid' : ''}
          />
          <FieldError message={fieldErrors[`${prefix}.poExpiryDate`]} />
        </div>

        {canRemove ? (
          <button
            type="button"
            className="btn secondary btn-sm client-master-po-remove"
            disabled={disabled}
            onClick={onRemove}
            title="Remove this PO"
            aria-label="Remove this PO"
          >
            ×
          </button>
        ) : (
          <span className="client-master-po-remove-spacer" aria-hidden="true" />
        )}
      </div>
      {applyGst && Number(tax.poGrossValue) > 0 ? (
        <p className="client-master-po-row-footnote">
          Net {formatPoMoney(tax.poNetValue)} · GST {formatPoMoney(tax.poGstAmount)} · Incl.{' '}
          {formatPoMoney(tax.poGrossValue)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Camp Terms — conditional fields by terms type.
 * PO Based supports multiple separate PO records (add without overwrite).
 */
export function ClientMasterCampTermsBox({
  form,
  fieldErrors = {},
  disabled = false,
  pendingFiles = [],
  pendingPoFiles = {},
  fileBusy = false,
  canDeleteFile = false,
  onFieldChange,
  onAddPurchaseOrder,
  onRemovePurchaseOrder,
  onPurchaseOrderChange,
  onFilesSelect,
  onFilesClearPending,
  onFilePreview,
  onFileDelete,
  onPoFilesSelect,
  onPoFilesClearPending,
  onPoFilePreview,
  onPoFileDelete,
}) {
  const terms = form.campTerms || CAMP_TERMS.NONE;
  const orders = Array.isArray(form.purchaseOrders) ? form.purchaseOrders : [];
  const combined = combinePurchaseOrders(orders);
  const showSharedFiles =
    terms === CAMP_TERMS.AGREEMENT_BASED || terms === CAMP_TERMS.APPROVAL_BASED;

  return (
    <section
      className="client-master-po-box client-master-camp-terms-box"
      data-terms={terms}
      aria-labelledby="client-master-camp-terms-title"
    >
      <div className="client-master-po-box-head">
        <div className="client-master-po-box-title-wrap">
          <h3 className="client-master-section-title" id="client-master-camp-terms-title">
            Camp Terms
          </h3>
          <p className="meta-text client-master-po-combined-hint">
            {terms === CAMP_TERMS.PO_BASED
              ? 'PO value is GST-inclusive when 18% is on · each PO is saved separately'
              : 'Fields depend on the selected terms type'}
          </p>
        </div>
        {terms === CAMP_TERMS.PO_BASED && orders.length > 0 ? (
          <div className="client-master-po-combined" aria-live="polite">
            <span className="client-master-po-combined-count">
              {orders.length} {orders.length === 1 ? 'PO' : 'POs'}
            </span>
            <span>
              Net <strong>{formatPoMoney(combined.poCombinedNet)}</strong>
            </span>
            {combined.poCombinedGst > 0 ? (
              <>
                <span>
                  GST <strong>{formatPoMoney(combined.poCombinedGst)}</strong>
                </span>
                <span className="client-master-po-combined-total">
                  Incl. <strong>{formatPoMoney(combined.poCombinedGross)}</strong>
                </span>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={`client-master-camp-terms-grid${showSharedFiles ? ' has-upload' : ''}`}>
        <label className="client-master-po-cell client-master-camp-terms-type">
          <span className="client-master-po-cell-label">Camp Terms</span>
          <select
            value={terms}
            disabled={disabled}
            onChange={(e) => onFieldChange?.('campTerms', e.target.value)}
            className={fieldErrors.campTerms ? 'input-invalid' : ''}
          >
            {CAMP_TERMS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors.campTerms} />
        </label>

        {terms === CAMP_TERMS.NONE ? (
          <p className="meta-text client-master-camp-terms-none">No additional fields</p>
        ) : null}

        {terms === CAMP_TERMS.AGREEMENT_BASED ? (
          <>
            <label className="client-master-po-cell">
              <span className="client-master-po-cell-label">Agreement Start Date</span>
              <input
                type="date"
                value={form.agreementStartDate || ''}
                onChange={(e) => onFieldChange?.('agreementStartDate', e.target.value)}
                disabled={disabled}
                className={fieldErrors.agreementStartDate ? 'input-invalid' : ''}
              />
              <FieldError message={fieldErrors.agreementStartDate} />
            </label>
            <label className="client-master-po-cell">
              <span className="client-master-po-cell-label">Agreement Effective Date</span>
              <input
                type="date"
                value={form.agreementEffectiveDate || ''}
                onChange={(e) => onFieldChange?.('agreementEffectiveDate', e.target.value)}
                disabled={disabled}
                className={fieldErrors.agreementEffectiveDate ? 'input-invalid' : ''}
              />
              <FieldError message={fieldErrors.agreementEffectiveDate} />
            </label>
            <label className="client-master-po-cell">
              <span className="client-master-po-cell-label">Agreement End Date</span>
              <input
                type="date"
                value={form.agreementEndDate || ''}
                onChange={(e) => onFieldChange?.('agreementEndDate', e.target.value)}
                disabled={disabled}
                className={fieldErrors.agreementEndDate ? 'input-invalid' : ''}
              />
              <FieldError message={fieldErrors.agreementEndDate} />
            </label>
          </>
        ) : null}

        {showSharedFiles ? (
          <div className="client-master-camp-terms-files-wrap">
            <MultiFileField
              files={form.campTermsFiles || []}
              pendingFiles={pendingFiles}
              disabled={disabled}
              fileBusy={fileBusy}
              canDeleteFile={canDeleteFile}
              compact
              error={fieldErrors.campTermsFiles || ''}
              onSelect={onFilesSelect}
              onClearPending={onFilesClearPending}
              onPreview={onFilePreview}
              onDelete={onFileDelete}
            />
          </div>
        ) : null}
      </div>

      {terms === CAMP_TERMS.PO_BASED ? (
        <div className="client-master-po-list">
          <div className="client-master-po-list-head" aria-hidden="true">
            <span />
            <span>PO No.</span>
            <span>File</span>
            <span>PO value</span>
            <span>Tax</span>
            <span>Issue</span>
            <span>Expiry</span>
            <span />
          </div>
          {orders.map((row, index) => (
            <PoRow
              key={row.id || `po-row-${index}`}
              row={row}
              index={index}
              canRemove={orders.length > 1}
              disabled={disabled}
              fieldErrors={fieldErrors}
              pendingFiles={pendingPoFiles[row.id] || []}
              fileBusy={fileBusy}
              canDeleteFile={canDeleteFile}
              onChange={(field, value) => onPurchaseOrderChange?.(row.id, field, value)}
              onRemove={() => onRemovePurchaseOrder?.(row.id)}
              onFilesSelect={(files) => onPoFilesSelect?.(row.id, files)}
              onFilePreview={(file) => onPoFilePreview?.(row.id, file)}
              onFileDelete={(file) => onPoFileDelete?.(row.id, file)}
            />
          ))}
          <div className="client-master-po-list-actions">
            <button
              type="button"
              className="btn secondary client-master-po-add-btn"
              disabled={disabled}
              onClick={() => onAddPurchaseOrder?.(createEmptyPurchaseOrder())}
            >
              + Add another PO
            </button>
          </div>
          <FieldError message={fieldErrors.purchaseOrders || ''} />
        </div>
      ) : null}
    </section>
  );
}

/** @deprecated use ClientMasterCampTermsBox */
export { ClientMasterCampTermsBox as ClientMasterPoMasterBox };
