import FilePicker from '../../components/ui/FilePicker.jsx';
import OtherAwareSelect from '../../components/ui/OtherAwareSelect.jsx';
import QieIndicator from './QieIndicator.jsx';
import { HEALTHCARE_WORKER_PROFESSIONS } from './contactPicklists.js';

export function emptyProviderEmployee() {
  return {
    id: crypto.randomUUID(),
    name: '',
    mobile: '',
    profession: '',
    campAmount: '',
    educationalQualificationUrl: '',
    educationalQie: null,
  };
}

/** Normalize provider employees for the Contact Directory form (preserves stored campAmount). */
export function hydrateProviderEmployeesForForm(employees = [], providerCampAmount) {
  const list = Array.isArray(employees) ? employees : [];
  const inherited = Number(providerCampAmount);
  const carry = Number.isFinite(inherited) && inherited > 0 ? inherited : 0;
  return list.map((emp) => {
    const own = Number(emp?.campAmount);
    const amount = Number.isFinite(own) && own > 0 ? own : carry;
    return {
      ...emp,
      campAmount: amount ? String(amount) : (emp?.campAmount === 0 || emp?.campAmount === '0' ? '0' : ''),
      educationalQualificationUrl: emp?.educationalQualificationUrl || '',
      educationalQie: emp?.educationalQie || null,
    };
  });
}

/**
 * Employee Details for Service Provider contacts (section 5).
 * Agency identity/location live in the main Contact Directory sections.
 */
export default function ServiceProviderProfile({
  form,
  onEmployeesChange,
  professionOptions = HEALTHCARE_WORKER_PROFESSIONS,
  disabled = false,
  editId = '',
  kycUploadBusy = '',
  onUploadEmployeeCertificate,
  onViewDocument,
  onOpenQieReport,
  uploadAccept = '',
  uploadHint = '',
}) {
  const employees = Array.isArray(form.providerEmployees) ? form.providerEmployees : [];

  const updateEmployee = (index, patch) => {
    const next = employees.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onEmployeesChange(next);
  };

  const addEmployee = () => {
    onEmployeesChange([...employees, emptyProviderEmployee()]);
  };

  const removeEmployee = (index) => {
    onEmployeesChange(employees.filter((_, i) => i !== index));
  };

  return (
    <div className="cd-employee-section">
      <div className="cd-employee-head">
        <p className="cd-form-hint cd-employee-intro">
          Add people who work under this agency for camp assignments.
        </p>
        {!disabled && (
          <button type="button" className="btn secondary btn-compact" onClick={addEmployee}>
            + Add employee
          </button>
        )}
      </div>

      {employees.length > 0 ? (
        <ul className="cd-employee-list">
          {employees.map((emp, index) => {
            const busyKey = `employee_educational_qualification:${emp.id}`;
            const uploading = kycUploadBusy === busyKey;
            return (
              <li key={emp.id || index} className="cd-employee-card">
                <div className="cd-employee-card-head">
                  <span className="cd-employee-card-title cd-employee-card-title--with-qie">
                    <span>{emp.name?.trim() || `Employee ${index + 1}`}</span>
                    <QieIndicator
                      url={emp.educationalQualificationUrl}
                      summary={emp.educationalQie}
                      onOpen={onOpenQieReport}
                    />
                  </span>
                  {!disabled && (
                    <button
                      type="button"
                      className="inv-link cd-employee-remove"
                      onClick={() => removeEmployee(index)}
                      aria-label={`Remove employee ${emp.name || index + 1}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="cd-employee-fields cd-employee-fields--details">
                  <div className="field">
                    <label>Employee Full Name</label>
                    <input
                      required
                      disabled={disabled}
                      value={emp.name}
                      onChange={(e) => updateEmployee(index, { name: e.target.value })}
                      placeholder="Full name"
                    />
                  </div>
                  <div className="field">
                    <label>Contact Number</label>
                    <input
                      required
                      disabled={disabled}
                      inputMode="numeric"
                      maxLength={10}
                      value={emp.mobile}
                      onChange={(e) => updateEmployee(index, {
                        mobile: e.target.value.replace(/\D+/g, '').slice(0, 10),
                      })}
                      placeholder="10-digit mobile"
                    />
                  </div>
                  <div className="field">
                    <label>Profession / Role</label>
                    <OtherAwareSelect
                      disabled={disabled}
                      picklistKey="contact.profession.healthcareWorker"
                      source="contact-directory"
                      options={professionOptions}
                      value={emp.profession}
                      onChange={(e) => updateEmployee(index, { profession: e.target.value })}
                    />
                  </div>
                  <div className="field cd-doc-field">
                    <div className="cd-doc-head">
                      <label>Educational Certificate</label>
                      <div className="cd-doc-head-actions">
                        <QieIndicator
                          url={emp.educationalQualificationUrl}
                          summary={emp.educationalQie}
                          onOpen={onOpenQieReport}
                        />
                        {editId && emp.id && emp.educationalQualificationUrl ? (
                          <button
                            type="button"
                            className="cd-doc-view"
                            onClick={(e) => {
                              e.preventDefault();
                              onViewDocument?.(emp.educationalQualificationUrl);
                            }}
                          >
                            View
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {editId && emp.id ? (
                      <div
                        className={`cd-doc-slot${emp.educationalQualificationUrl ? ' is-attached' : ''}`}
                        title={uploadHint || undefined}
                      >
                        <FilePicker
                          className="cd-doc-picker"
                          accept={uploadAccept}
                          disabled={disabled || Boolean(kycUploadBusy)}
                          buttonLabel={
                            uploading
                              ? 'Uploading…'
                              : emp.educationalQualificationUrl
                                ? 'Replace'
                                : 'Upload'
                          }
                          emptyLabel={
                            emp.educationalQualificationUrl ? 'File on record' : 'Choose file'
                          }
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && onUploadEmployeeCertificate) {
                              onUploadEmployeeCertificate(emp.id, file);
                            }
                            e.target.value = '';
                          }}
                        />
                      </div>
                    ) : (
                      <p className="cd-form-hint cd-doc-locked">
                        Save provider to enable upload
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted cd-staff-empty">No employees added yet.</p>
      )}
      {employees.length > 0 ? (
        <p className="cd-staff-count">{employees.length} employee(s)</p>
      ) : null}
    </div>
  );
}
