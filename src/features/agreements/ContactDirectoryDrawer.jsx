import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import FeedbackBanner from '../../components/ui/FeedbackBanner.jsx';
import { api } from '../../shared/api.js';
import { invalidateContactsCaches } from '../../shared/contactsApi.js';
import { openUploadView } from '../../shared/uploadViewUrl.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import OtherAwareSelect from '../../components/ui/OtherAwareSelect.jsx';
import LocationCascade from '../../components/ui/LocationCascade.jsx';
import PublicOlaAddressAutocomplete from '../camps/requestForm/PublicOlaAddressAutocomplete.jsx';
import { autocompleteOlaMaps } from '../../shared/olaMapsApi.js';
import FilePicker from '../../components/ui/FilePicker.jsx';
import { validateUploadFile } from '../../shared/importErrors.js';
import {
  CONTACT_KYC_ACCEPT_ATTR,
  CONTACT_KYC_ACCEPT_EXTENSIONS,
  CONTACT_KYC_HINT,
  CONTACT_KYC_MAX_BYTES,
} from './contactKycUpload.js';
import ServiceProviderProfile, { hydrateProviderEmployeesForForm } from './ServiceProviderProfile.jsx';
import QieIndicator from './QieIndicator.jsx';
import QieReportDialog from './QieReportDialog.jsx';
import { emailError, phoneError } from '../../shared/validation.js';
import { usePicklistOptions } from '../../shared/usePicklistOptions.js';
import {
  HCW_RESOURCE_TYPES,
  RESOURCE_TYPES,
  isServiceProviderContact,
  professionsForCategory,
  professionPicklistKey,
  resourceTypesForCategory,
} from './contactPicklists.js';

const DIRECTORY_CATEGORIES = ['Resource', 'Client', 'Healthcare Worker'];

const empty = {
  name: '',
  email: '',
  contactCategory: '',
  resourceType: '',
  serviceProviderContactId: '',
  profession: '',
  organization: '',
  supplyCategory: '',
  contact: '',
  city: '',
  state: '',
  district: '',
  pinCode: '',
  address: '',
  latitude: '',
  longitude: '',
  googlePlaceId: '',
  panNumber: '',
  aadhaarNumber: '',
  upiId: '',
  ifscCode: '',
  bankName: '',
  accountNumber: '',
  passbookCopyUrl: '',
  panCardCopyUrl: '',
  aadhaarFrontUrl: '',
  aadhaarBackUrl: '',
  educationalQualificationUrl: '',
  resumeUrl: '',
  educationalQie: null,
  stateId: '',
  districtId: '',
  cityId: '',
  /** Kept for Camp One payout resolution; no longer edited in Contact Directory. */
  campAmount: '',
  providerEmployees: [],
};

const DOC_UPLOAD_LABELS = {
  aadhaar_front: 'Aadhaar Card – Front',
  aadhaar_back: 'Aadhaar Card – Back',
  pan_card: 'PAN Card',
  passbook: 'Passbook / Cheque',
  educational_qualification: 'Educational Certificate',
  resume: 'Resume',
  employee_educational_qualification: 'Educational Certificate',
};

const FORM_SECTIONS_CLOSED = {
  identity: false,
  location: false,
  credentials: false,
  documents: false,
  employees: false,
};

/** Keep sections 1–4 collapsed so Employee Details stays near the top when editing SPs. */
function formSectionsForDrawer({ isProvider = false, isCreate = false } = {}) {
  if (isProvider && !isCreate) {
    return { ...FORM_SECTIONS_CLOSED, employees: true };
  }
  if (isProvider && isCreate) {
    return { ...FORM_SECTIONS_CLOSED, identity: true, employees: true };
  }
  return { ...FORM_SECTIONS_CLOSED, identity: true };
}

export default function ContactDirectoryDrawer({
  open = false,
  onClose,
  contact = null,
  onSaved,
  onReload,
  defaultCategory = '',
  canWrite = true,
} = {}) {
  const canWriteContacts = Boolean(canWrite);
  const editContact = contact && contact._id ? contact : null;
  const editIdFromProp = editContact?._id || null;

  const [showAccountMask, setShowAccountMask] = useState(false);
  const initialFormRef = useRef(empty);
  const [error, setError] = useState('');
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const hydratedKeyRef = useRef('');
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kycUploadBusy, setKycUploadBusy] = useState('');
  const [rosterTouched, setRosterTouched] = useState(false);
  const [editUpdatedAt, setEditUpdatedAt] = useState('');
  const [rosterSnapshot, setRosterSnapshot] = useState([]);
  const [linkSnapshot, setLinkSnapshot] = useState('');
  const [pendingDestructiveLeave, setPendingDestructiveLeave] = useState(null);
  const [openSections, setOpenSections] = useState(() => formSectionsForDrawer({ isCreate: true }));
  const [qieReportId, setQieReportId] = useState('');

  const isResource = form.contactCategory === 'Resource';
  const isHcw = form.contactCategory === 'Healthcare Worker';
  const isClient = form.contactCategory === 'Client';
  const isHcwProvider = isHcw && form.resourceType === 'Service Provider';

  const toggleSection = useCallback((key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const expandSectionForField = useCallback((target) => {
    const section = target?.closest?.('[data-cd-section]');
    const key = section?.getAttribute?.('data-cd-section');
    if (!key) return;
    setOpenSections((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, []);

  const showResourceType = isResource || isHcw;
  const showBankAndAddress = !isClient && Boolean(form.contactCategory);
  const professionKey = professionPicklistKey(form.contactCategory);
  const professionFallback = professionsForCategory(form.contactCategory);
  const categoryResourceTypes = resourceTypesForCategory(form.contactCategory);

  const { options: resourceTypeOptions } = usePicklistOptions(
    'contact.resourceType',
    RESOURCE_TYPES
  );
  const { options: hcwResourceTypeOptions } = usePicklistOptions(
    'contact.hcwResourceType',
    HCW_RESOURCE_TYPES
  );

  const resourceTypeChoices = useMemo(() => {
    const pool = isHcw ? hcwResourceTypeOptions : resourceTypeOptions;
    return pool.filter((o) => categoryResourceTypes.includes(o));
  }, [isHcw, hcwResourceTypeOptions, resourceTypeOptions, categoryResourceTypes]);

  const { options: professionOptions } = usePicklistOptions(professionKey, professionFallback);

  const isFormDirty = useCallback(() => {
    if (rosterTouched) return true;
    const initial = initialFormRef.current;
    const trackedKeys = [
      'name',
      'email',
      'contactCategory',
      'resourceType',
      'serviceProviderContactId',
      'profession',
      'organization',
      'supplyCategory',
      'contact',
      'address',
      'pinCode',
      'state',
      'district',
      'city',
      'panNumber',
      'aadhaarNumber',
      'upiId',
      'ifscCode',
      'bankName',
      'accountNumber',
      'campAmount',
    ];
    return trackedKeys.some(
      (k) => String(form[k] ?? '').trim() !== String(initial[k] ?? '').trim(),
    );
  }, [form, rosterTouched]);

  const closeDrawer = useCallback(
    (force = false) => {
      if (busy) return;
      if (!force && isFormDirty()) {
        setConfirmDiscardOpen(true);
        return;
      }
      setEditId(null);
      setForm(empty);
      initialFormRef.current = empty;
      setShowAccountMask(false);
      setRosterTouched(false);
      setEditUpdatedAt('');
      setRosterSnapshot([]);
      setLinkSnapshot('');
      setError('');
      setConfirmDiscardOpen(false);
      hydratedKeyRef.current = '';
      onClose?.();
    },
    [busy, isFormDirty, onClose],
  );

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) {
        closeDrawer(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, closeDrawer]);

  const applyCategoryChange = (contactCategory, { clearRoster = false, resourceTypeOverride } = {}) => {
    const nextProfessions = professionsForCategory(contactCategory);
    setForm((f) => {
      const nextResourceType = resourceTypeOverride !== undefined
        ? resourceTypeOverride
        : contactCategory === 'Resource' && RESOURCE_TYPES.includes(f.resourceType)
          ? f.resourceType
          : contactCategory === 'Healthcare Worker' && HCW_RESOURCE_TYPES.includes(f.resourceType)
            ? f.resourceType
            : '';
      const nextIsProvider =
        contactCategory === 'Healthcare Worker' && nextResourceType === 'Service Provider';
      return {
        ...f,
        contactCategory,
        resourceType: nextResourceType,
        serviceProviderContactId: '',
        providerEmployees: nextIsProvider
          ? (f.providerEmployees?.length ? f.providerEmployees : rosterSnapshot)
          : (clearRoster ? [] : (f.providerEmployees || rosterSnapshot || [])),
        organization: contactCategory === 'Client' ? f.organization : '',
        supplyCategory: '',
        profession: nextProfessions.includes(f.profession) ? f.profession : '',
        address: contactCategory === 'Client' ? '' : f.address,
        pinCode: contactCategory === 'Client' ? '' : f.pinCode,
        latitude: contactCategory === 'Client' ? '' : f.latitude,
        longitude: contactCategory === 'Client' ? '' : f.longitude,
        googlePlaceId: contactCategory === 'Client' ? '' : f.googlePlaceId,
        panNumber: contactCategory === 'Client' ? '' : f.panNumber,
        aadhaarNumber: contactCategory === 'Client' ? '' : f.aadhaarNumber,
        upiId: contactCategory === 'Client' ? '' : f.upiId,
        ifscCode: contactCategory === 'Client' ? '' : f.ifscCode,
        bankName: contactCategory === 'Client' ? '' : f.bankName,
        accountNumber: contactCategory === 'Client' ? '' : f.accountNumber,
        campAmount: contactCategory === 'Healthcare Worker' ? f.campAmount : '',
        educationalQualificationUrl:
          contactCategory === 'Client' ? '' : f.educationalQualificationUrl,
        aadhaarFrontUrl: contactCategory === 'Client' ? '' : f.aadhaarFrontUrl,
        aadhaarBackUrl: contactCategory === 'Client' ? '' : f.aadhaarBackUrl,
        resumeUrl: contactCategory === 'Client' ? '' : f.resumeUrl,
        clearProviderEmployees: clearRoster ? true : undefined,
      };
    });
    if (clearRoster) setRosterSnapshot([]);
  };

  const onCategoryChange = (contactCategory) => {
    const leavingProvider =
      isServiceProviderContact(form)
      && !(contactCategory === 'Healthcare Worker' && form.resourceType === 'Service Provider');
    const roster = form.providerEmployees?.length ? form.providerEmployees : rosterSnapshot;
    if (leavingProvider && Array.isArray(roster) && roster.length > 0) {
      setPendingDestructiveLeave({ kind: 'category', value: contactCategory });
      return;
    }
    applyCategoryChange(contactCategory);
  };

  const confirmLeaveProvider = (clearRoster) => {
    const pending = pendingDestructiveLeave;
    setPendingDestructiveLeave(null);
    if (!pending) return;
    if (pending.kind === 'category') {
      applyCategoryChange(pending.value, { clearRoster });
    } else if (pending.kind === 'resourceType') {
      applyCategoryChange(form.contactCategory, {
        clearRoster,
        resourceTypeOverride: pending.value,
      });
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.contactCategory) {
      setError('Contact Category is required');
      setOpenSections((prev) => ({ ...prev, identity: true }));
      return;
    }
    if (!String(form.name || '').trim()) {
      setError('Full Name is required');
      setOpenSections((prev) => ({ ...prev, identity: true }));
      return;
    }
    if (isResource && !form.resourceType) {
      setError('Resource Type is required for Resource contacts');
      setOpenSections((prev) => ({ ...prev, identity: true }));
      return;
    }
    if (isHcw && !form.resourceType) {
      setError('Resource Type is required for Healthcare Worker contacts');
      setOpenSections((prev) => ({ ...prev, identity: true }));
      return;
    }
    if (isClient && !String(form.organization || '').trim()) {
      setError('Organization Name is required for Client');
      setOpenSections((prev) => ({ ...prev, identity: true }));
      return;
    }
    if (isHcwProvider) {
      if (!String(form.name || '').trim()) {
        setError('Provider name is required');
        setOpenSections((prev) => ({ ...prev, identity: true }));
        return;
      }
      if (!String(form.contact || '').trim()) {
        setError('Provider mobile number is required');
        setOpenSections((prev) => ({ ...prev, identity: true }));
        return;
      }
      if (!String(form.state || '').trim()) {
        setError('Provider state is required');
        setOpenSections((prev) => ({ ...prev, location: true }));
        return;
      }
      for (let i = 0; i < (form.providerEmployees || []).length; i += 1) {
        const emp = form.providerEmployees[i];
        if (!String(emp.name || '').trim()) {
          setError(`Employee ${i + 1}: name is required`);
          return;
        }
        const empPhoneErr = phoneError(emp.mobile);
        if (empPhoneErr) {
          setError(`Employee ${i + 1}: ${empPhoneErr}`);
          return;
        }
      }
    }
    const emailRaw = String(form.email || '').trim();
    if (emailRaw && !emailRaw.includes('@')) {
      setError('Email ID must contain @');
      setOpenSections((prev) => ({ ...prev, identity: true }));
      return;
    }
    const eErr = emailError(form.email, 'Email ID');
    if (eErr) {
      setError(eErr);
      setOpenSections((prev) => ({ ...prev, identity: true }));
      return;
    }
    if (!String(form.contact || '').trim()) {
      setError('Contact Number is required');
      setOpenSections((prev) => ({ ...prev, identity: true }));
      return;
    }
    const pErr = phoneError(form.contact, 'Contact Number');
    if (pErr) {
      setError(pErr);
      setOpenSections((prev) => ({ ...prev, identity: true }));
      return;
    }
    const upiRaw = String(form.upiId || '').trim();
    if (upiRaw && !upiRaw.includes('@')) {
      setError('UPI ID must contain @');
      setOpenSections((prev) => ({ ...prev, credentials: true }));
      return;
    }
    setBusy(true);
    try {
      let saved = null;
      const body = { ...form };
      if (isClient) {
        body.address = '';
        body.pinCode = '';
        body.latitude = '';
        body.longitude = '';
        body.googlePlaceId = '';
        body.panNumber = '';
        body.aadhaarNumber = '';
        body.upiId = '';
        body.ifscCode = '';
        body.bankName = '';
        body.accountNumber = '';
        body.passbookCopyUrl = '';
        body.panCardCopyUrl = '';
        body.aadhaarFrontUrl = '';
        body.aadhaarBackUrl = '';
        body.educationalQualificationUrl = '';
        body.resumeUrl = '';
      }
      // Contact Directory no longer edits camp amounts — omit on PATCH so
      // existing Camp One rates are preserved; new contacts default to 0.
      if (editId) {
        delete body.campAmount;
      } else {
        body.campAmount = 0;
      }
      if (!isResource && !isHcw) body.resourceType = '';
      if (isHcwProvider) {
        body.serviceProviderContactId = '';
        const employees = Array.isArray(form.providerEmployees) ? form.providerEmployees : [];
        if (editId && employees.length === 0 && !rosterTouched) {
          // Empty roster on edit without user edits: omit so PATCH cannot wipe persisted staff.
          delete body.providerEmployees;
        } else {
          body.providerEmployees = employees;
          if (editId && employees.length === 0 && rosterTouched) {
            body.clearProviderEmployees = true;
          }
        }
      } else {
        // Omit roster field so PATCH cannot wipe persisted employees with [].
        delete body.providerEmployees;
        if (form.clearProviderEmployees === true) {
          body.clearProviderEmployees = true;
          body.providerEmployees = [];
        }
      }
      if (!isClient) body.organization = '';
      body.supplyCategory = '';
      // Individual/Full-Time cannot also sit under a Service Provider agency.
      body.serviceProviderContactId = '';

      // PATCH: omit blank geo so empty cascade resets cannot wipe persisted values.
      if (editId) {
        for (const key of ['city', 'state', 'district', 'pinCode', 'stateId', 'districtId', 'cityId']) {
          if (body[key] == null || String(body[key]).trim() === '') delete body[key];
        }
        if (linkSnapshot) {
          body.clearServiceProviderContactId = true;
        }
        if (editUpdatedAt) body.expectedUpdatedAt = editUpdatedAt;
        try {
          const res = await api(`/contacts/${editId}`, { method: 'PATCH', body });
          saved = res?.data;
        } catch (err) {
          // KYC/other writes bump updatedAt — refresh token and retry once (no second click).
          const stale = err?.code === 'STALE_UPDATE' || err?.status === 409;
          if (!stale) throw err;
          const fresh = await api(`/contacts/${editId}`);
          const row = fresh?.data;
          const nextToken = row?.updatedAt || '';
          if (!nextToken) throw err;
          setEditUpdatedAt(nextToken);
          body.expectedUpdatedAt = nextToken;
          const res = await api(`/contacts/${editId}`, { method: 'PATCH', body });
          saved = res?.data;
        }
        if (saved?.updatedAt) setEditUpdatedAt(saved.updatedAt);
      } else {
        const res = await api('/contacts', { method: 'POST', body });
        saved = res?.data;
      }
      invalidateContactsCaches();
      if (typeof onSaved === 'function') {
        await onSaved(saved || { name: form.name, contact: form.contact, mobile: form.contact });
      }
      if (typeof onReload === 'function') onReload();
      closeDrawer(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  function syncDocumentUrlsFromContact(contact = {}) {
    setForm((current) => ({
      ...current,
      passbookCopyUrl: contact.passbookCopyUrl || '',
      panCardCopyUrl: contact.panCardCopyUrl || '',
      aadhaarFrontUrl: contact.aadhaarFrontUrl || '',
      aadhaarBackUrl: contact.aadhaarBackUrl || '',
      educationalQualificationUrl: contact.educationalQualificationUrl || '',
      resumeUrl: contact.resumeUrl || '',
      educationalQie: contact.educationalQie || null,
      providerEmployees: Array.isArray(contact.providerEmployees)
        ? hydrateProviderEmployeesForForm(contact.providerEmployees, current.campAmount)
        : current.providerEmployees,
    }));
  }

  function applyQieSummaryToForm(verification) {
    if (!verification) return;
    const summary = {
      verificationId: verification._id || verification.verificationId || '',
      indicator: verification.indicator || 'amber',
      status: verification.status || '',
      documentId: verification.documentId || '',
      updatedAt: verification.updatedAt || '',
    };
    const employeeId = String(verification.employeeId || '').trim();
    setForm((current) => {
      if (employeeId) {
        const employees = Array.isArray(current.providerEmployees)
          ? current.providerEmployees.map((row) => (
            String(row.id || '') === employeeId
              ? { ...row, educationalQie: summary }
              : row
          ))
          : [];
        return { ...current, providerEmployees: employees };
      }
      return { ...current, educationalQie: summary };
    });
  }

  async function uploadKycDocument(docType, file, { employeeId = '' } = {}) {
    if (!editId || !file) return;
    const label = DOC_UPLOAD_LABELS[docType] || 'Document';
    const busyKey = employeeId ? `${docType}:${employeeId}` : docType;
    const pre = validateUploadFile(file, {
      maxBytes: CONTACT_KYC_MAX_BYTES,
      acceptExt: CONTACT_KYC_ACCEPT_EXTENSIONS,
      label,
    });
    if (pre) {
      setError(pre);
      return;
    }
    setKycUploadBusy(busyKey);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docType', docType);
      if (employeeId) formData.append('employeeId', employeeId);
      const res = await api(`/contacts/${editId}/kyc-document`, { method: 'POST', body: formData });
      const contact = res.data || {};
      // KYC upload saves the contact and bumps updatedAt: keep the edit token in sync
      // or the next Save falsely fails with STALE_UPDATE.
      if (contact.updatedAt) setEditUpdatedAt(contact.updatedAt);
      syncDocumentUrlsFromContact(contact);
      invalidateContactsCaches();
      if (typeof onReload === "function") onReload();
      // QIE runs async after educational uploads — refresh once analysis has a chance to queue.
      if (
        docType === 'educational_qualification'
        || docType === 'employee_educational_qualification'
      ) {
        window.setTimeout(() => {
          if (typeof onReload === "function") onReload();
          if (editId) {
            api(`/contacts/${editId}`)
              .then((fresh) => {
                if (fresh?.data) syncDocumentUrlsFromContact(fresh.data);
              })
              .catch(() => {});
          }
        }, 1800);
      }
    } catch (err) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setKycUploadBusy('');
    }
  }

  function renderDocumentUpload({ docType, label, urlKey, qieSummary = null }) {
    const busy = kycUploadBusy === docType;
    const url = form[urlKey];
    const showQie = docType === 'educational_qualification';
    return (
      <div className="field cd-doc-field" key={docType}>
        <div className="cd-doc-head">
          <label>{label}</label>
          <div className="cd-doc-head-actions">
            {showQie ? (
              <QieIndicator
                url={url}
                summary={qieSummary || form.educationalQie}
                onOpen={setQieReportId}
              />
            ) : null}
            {editId && url ? (
              <button
                type="button"
                className="cd-doc-view"
                onClick={(e) => {
                  e.preventDefault();
                  openUploadView(url).catch((err) => setError(err.message));
                }}
              >
                View
              </button>
            ) : null}
          </div>
        </div>
        {editId ? (
          <div
            className={`cd-doc-slot${url ? ' is-attached' : ''}`}
            title={CONTACT_KYC_HINT}
          >
            <FilePicker
              className="cd-doc-picker"
              accept={CONTACT_KYC_ACCEPT_ATTR}
              disabled={Boolean(kycUploadBusy)}
              buttonLabel={busy ? 'Uploading…' : url ? 'Replace' : 'Upload'}
              emptyLabel={url ? 'File on record' : 'Choose file'}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadKycDocument(docType, file);
                e.target.value = '';
              }}
            />
          </div>
        ) : (
          <p className="cd-form-hint cd-doc-locked">Save contact to enable upload</p>
        )}
      </div>
    );
  }

  const hydrateFromContact = (c) => {
    let contactCategory = c.contactCategory || '';
    if (!contactCategory) {
      const rt = String(c.resourceType || '').trim().toLowerCase();
      if (rt === 'vendor' || rt === 'supplier') contactCategory = 'Vendor';
      else if (rt === 'client') contactCategory = 'Client';
      else if (c.resourceType) contactCategory = 'Resource';
    }
    const resourceType =
      contactCategory === 'Resource' || contactCategory === 'Healthcare Worker'
        ? c.resourceType || ''
        : '';
    setEditId(c._id);
    setRosterTouched(false);
    setEditUpdatedAt(c.updatedAt || '');
    const isProvider = contactCategory === 'Healthcare Worker' && resourceType === 'Service Provider';
    const employees = hydrateProviderEmployeesForForm(
      Array.isArray(c.providerEmployees) ? c.providerEmployees : [],
      isProvider ? c.campAmount : 0,
    );
    setRosterSnapshot(employees);
    setLinkSnapshot(String(c.serviceProviderContactId || '').trim());
    const initialValues = {
      name: c.name || '',
      email: c.email || '',
      contactCategory,
      resourceType,
      serviceProviderContactId: c.serviceProviderContactId || '',
      profession: c.profession || '',
      organization: c.organization || '',
      supplyCategory: c.supplyCategory || '',
      contact: c.contact || c.mobile || '',
      city: c.city || '',
      state: c.state || '',
      district: c.district || '',
      pinCode: c.pinCode || '',
      address: c.address || '',
      latitude: c.latitude || '',
      longitude: c.longitude || '',
      googlePlaceId: c.googlePlaceId || '',
      panNumber: c.panNumber || '',
      aadhaarNumber: c.aadhaarNumber || '',
      upiId: c.upiId || '',
      ifscCode: c.ifscCode || '',
      bankName: c.bankName || '',
      accountNumber: c.accountNumber || '',
      passbookCopyUrl: c.passbookCopyUrl || '',
      panCardCopyUrl: c.panCardCopyUrl || '',
      aadhaarFrontUrl: c.aadhaarFrontUrl || '',
      aadhaarBackUrl: c.aadhaarBackUrl || '',
      educationalQualificationUrl: c.educationalQualificationUrl || '',
      resumeUrl: c.resumeUrl || '',
      educationalQie: c.educationalQie || null,
      stateId: c.stateId || '',
      districtId: c.districtId || '',
      cityId: c.cityId || '',
      campAmount: isProvider
        ? ''
        : (c.campAmount != null && c.campAmount !== '' ? String(c.campAmount) : ''),
      providerEmployees: employees,
    };
    initialFormRef.current = initialValues;
    setShowAccountMask(false);
    setForm(initialValues);
    setOpenSections(formSectionsForDrawer({ isProvider, isCreate: false }));
    setError('');
  };


  const resetCreateForm = (category = '') => {
    setEditId(null);
    const base = { ...empty };
    if (category) base.contactCategory = category;
    setForm(base);
    initialFormRef.current = base;
    setShowAccountMask(false);
    setRosterTouched(false);
    setEditUpdatedAt('');
    setRosterSnapshot([]);
    setLinkSnapshot('');
    setOpenSections(formSectionsForDrawer({ isCreate: true }));
    setError('');
    if (category) {
      queueMicrotask(() => applyCategoryChange(category));
    }
  };

  useEffect(() => {
    if (!open) {
      hydratedKeyRef.current = '';
      return;
    }
    const key = editIdFromProp ? `edit:${editIdFromProp}` : `create:${defaultCategory || ''}`;
    if (hydratedKeyRef.current === key) return;
    hydratedKeyRef.current = key;
    if (editContact) hydrateFromContact(editContact);
    else resetCreateForm(String(defaultCategory || '').trim());
  }, [open, editIdFromProp, editContact, defaultCategory]);


  if (!open) return null;

  return (
    <>
        {/* Enterprise Slide-Over Drawer for Create / Edit */}
        {open && (
          <div
            className="cd-drawer-backdrop"
            onClick={() => closeDrawer(false)}
            aria-hidden="true"
          />
        )}

        {open && canWriteContacts && (
          <aside
            className={`cd-drawer${editId ? ' cd-drawer--editing' : ''}`}
            aria-label={editId ? 'Edit contact' : 'Create new contact'}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cd-drawer-heading"
          >
            <div className="cd-drawer-header">
              <div className="cd-drawer-header-copy">
                <span className="cd-drawer-kicker">
                  {editId ? 'Edit Directory Record' : 'New Directory Record'}
                </span>
                <h3 id="cd-drawer-heading" className="cd-drawer-title">
                  {editId ? form.name || 'Edit contact' : 'Add new contact'}
                </h3>
              </div>
              <button
                type="button"
                className="cd-drawer-close-btn"
                onClick={() => closeDrawer(false)}
                aria-label="Close drawer"
                title="Close"
              >
                ×
              </button>
            </div>

            <form
              className="cd-drawer-form"
              onSubmit={save}
              onInvalidCapture={(e) => expandSectionForField(e.target)}
            >
              <div className="cd-drawer-scroll">
                {error && (
                  <div className="cd-drawer-error">
                    <FeedbackBanner variant="error">{error}</FeedbackBanner>
                  </div>
                )}

                {/* 1. Identity & Contact */}
                <section
                  className={`cd-form-section${openSections.identity ? ' is-open' : ' is-collapsed'}`}
                  data-cd-section="identity"
                >
                  <button
                    type="button"
                    className="cd-form-section-toggle"
                    aria-expanded={Boolean(openSections.identity)}
                    onClick={() => toggleSection('identity')}
                  >
                    <span className="cd-form-section-num">1</span>
                    <h4 className="cd-section-title">Identity &amp; Contact</h4>
                    <span className="cd-form-section-chevron" aria-hidden="true">
                      {openSections.identity ? '▾' : '▸'}
                    </span>
                  </button>
                  <div className="cd-form-section-body" hidden={!openSections.identity}>
                  <div className="cd-form-grid">
                    <div className="field">
                      <label>Contact Category *</label>
                      <AdaptiveSelect
                        required
                        value={form.contactCategory}
                        onChange={(e) => onCategoryChange(e.target.value)}
                      >
                        <option value="">Select category…</option>
                        {DIRECTORY_CATEGORIES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </AdaptiveSelect>
                    </div>

                    {showResourceType ? (
                      <div className="field">
                        <label>Resource Type *</label>
                        <OtherAwareSelect
                          id="contact-resource-type"
                          required
                          picklistKey={isHcw ? 'contact.hcwResourceType' : 'contact.resourceType'}
                          source="contact-directory"
                          options={resourceTypeChoices}
                          value={form.resourceType}
                          onChange={(e) => {
                            const nextType = e.target.value;
                            const leavingProvider =
                              form.resourceType === 'Service Provider'
                              && nextType !== 'Service Provider'
                              && (form.providerEmployees?.length || rosterSnapshot.length);
                            if (leavingProvider) {
                              setPendingDestructiveLeave({ kind: 'resourceType', value: nextType });
                              return;
                            }
                            setForm((f) => ({
                              ...f,
                              resourceType: nextType,
                              serviceProviderContactId: '',
                              providerEmployees:
                                nextType === 'Service Provider'
                                  ? (f.providerEmployees?.length ? f.providerEmployees : rosterSnapshot)
                                  : [],
                            }));
                            if (nextType === 'Service Provider') {
                              setOpenSections(formSectionsForDrawer({
                                isProvider: true,
                                isCreate: !editId,
                              }));
                            } else {
                              setRosterTouched(false);
                              setOpenSections((prev) => ({ ...prev, employees: false }));
                            }
                          }}
                        />
                      </div>
                    ) : form.contactCategory ? (
                      <div className="field">
                        <label>Profession / Role</label>
                        <OtherAwareSelect
                          id="contact-profession"
                          picklistKey={professionKey}
                          source="contact-directory"
                          options={professionOptions}
                          value={form.profession}
                          onChange={(e) => setForm({ ...form, profession: e.target.value })}
                        />
                      </div>
                    ) : null}

                    {showResourceType && form.contactCategory ? (
                      <div className="field">
                        <label>Profession / Role</label>
                        <OtherAwareSelect
                          id="contact-profession"
                          picklistKey={professionKey}
                          source="contact-directory"
                          options={professionOptions}
                          value={form.profession}
                          onChange={(e) => setForm({ ...form, profession: e.target.value })}
                        />
                      </div>
                    ) : null}

                    <div className="field">
                      <label>Full Name *</label>
                      <input
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder={isHcwProvider ? 'Agency / provider name' : 'Legal full name'}
                      />
                    </div>

                    <div className="field">
                      <label>Email ID</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="name@example.com"
                      />
                    </div>

                    <div className="field">
                      <label>Contact Number *</label>
                      <input
                        required
                        inputMode="numeric"
                        maxLength={10}
                        value={form.contact}
                        onChange={(e) => setForm({
                          ...form,
                          contact: e.target.value.replace(/\D+/g, '').slice(0, 10),
                        })}
                        placeholder="10-digit mobile number"
                      />
                    </div>

                    {isClient ? (
                      <div className="field cd-span-2">
                        <label>Organization Name *</label>
                        <input
                          required
                          value={form.organization}
                          onChange={(e) => setForm({ ...form, organization: e.target.value })}
                          placeholder="Client organization or company name"
                        />
                      </div>
                    ) : null}

                  </div>
                  </div>
                </section>

                {/* 2. Location & Address */}
                <section
                  className={`cd-form-section${openSections.location ? ' is-open' : ' is-collapsed'}`}
                  data-cd-section="location"
                >
                  <button
                    type="button"
                    className="cd-form-section-toggle"
                    aria-expanded={Boolean(openSections.location)}
                    onClick={() => toggleSection('location')}
                  >
                    <span className="cd-form-section-num">2</span>
                    <h4 className="cd-section-title">Location &amp; Address</h4>
                    <span className="cd-form-section-chevron" aria-hidden="true">
                      {openSections.location ? '▾' : '▸'}
                    </span>
                  </button>
                  <div className="cd-form-section-body" hidden={!openSections.location}>
                  <div className="cd-form-grid">
                    {!isClient ? (
                      <div className="field cd-span-2">
                        <label>Street Address</label>
                        <PublicOlaAddressAutocomplete
                          value={form.address}
                          selectedPlaceId={form.googlePlaceId || ''}
                          lookup={{ autocomplete: autocompleteOlaMaps }}
                          placeholder="Search or enter physical street address"
                          onChange={(loc) => setForm((f) => ({
                            ...f,
                            address: loc.campAddress ?? f.address,
                            googlePlaceId: loc.googlePlaceId ?? '',
                            latitude: loc.latitude ?? '',
                            longitude: loc.longitude ?? '',
                            ...(loc.addressManualEntry === false && loc.pinCode
                              ? { pinCode: loc.pinCode }
                              : {}),
                          }))}
                        />
                      </div>
                    ) : null}
                    <div className="cd-span-2 cd-location-pair">
                      <LocationCascade
                        value={form}
                        onChange={(loc) => setForm((f) => ({ ...f, ...loc }))}
                        showDistrict={false}
                        showPin={false}
                        labels={{ state: 'State', city: 'City / District' }}
                      />
                    </div>
                  </div>
                  </div>
                </section>

                {/* 3. Other Credentials */}
                {showBankAndAddress ? (
                  <section
                    className={`cd-form-section${openSections.credentials ? ' is-open' : ' is-collapsed'}`}
                    data-cd-section="credentials"
                  >
                    <button
                      type="button"
                      className="cd-form-section-toggle"
                      aria-expanded={Boolean(openSections.credentials)}
                      onClick={() => toggleSection('credentials')}
                    >
                      <span className="cd-form-section-num">3</span>
                      <h4 className="cd-section-title">Other Credentials</h4>
                      <span className="cd-form-section-chevron" aria-hidden="true">
                        {openSections.credentials ? '▾' : '▸'}
                      </span>
                    </button>
                    <div className="cd-form-section-body" hidden={!openSections.credentials}>
                    <div className="cd-form-grid">
                      <div className="field">
                        <label htmlFor="cd-pan-number">PAN Number</label>
                        <input
                          id="cd-pan-number"
                          value={form.panNumber}
                          maxLength={10}
                          autoComplete="off"
                          spellCheck={false}
                          autoCapitalize="characters"
                          className="cd-input-mono cd-input-upper"
                          onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase().trim() })}
                          placeholder="ABCDE1234F"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="cd-aadhaar-number">Aadhaar Number</label>
                        <input
                          id="cd-aadhaar-number"
                          value={form.aadhaarNumber}
                          maxLength={12}
                          autoComplete="off"
                          spellCheck={false}
                          inputMode="numeric"
                          className="cd-input-mono"
                          onChange={(e) => setForm({
                            ...form,
                            aadhaarNumber: e.target.value.replace(/\D+/g, '').slice(0, 12),
                          })}
                          placeholder="12-digit Aadhaar"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="cd-upi-id">UPI ID</label>
                        <input
                          id="cd-upi-id"
                          value={form.upiId}
                          autoComplete="off"
                          spellCheck={false}
                          className="cd-input-mono"
                          onChange={(e) => setForm({
                            ...form,
                            upiId: e.target.value.replace(/\s+/g, '').toLowerCase(),
                          })}
                          placeholder="name@upi"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="cd-ifsc-code">IFSC Code</label>
                        <input
                          id="cd-ifsc-code"
                          value={form.ifscCode}
                          maxLength={11}
                          autoComplete="off"
                          spellCheck={false}
                          autoCapitalize="characters"
                          className="cd-input-mono cd-input-upper"
                          onChange={(e) => setForm({ ...form, ifscCode: e.target.value.toUpperCase().trim() })}
                          placeholder="SBIN0001234"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="cd-bank-name">Bank Name</label>
                        <input
                          id="cd-bank-name"
                          value={form.bankName}
                          autoComplete="off"
                          spellCheck={false}
                          onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                          placeholder="State Bank of India"
                        />
                      </div>
                      <div className="field">
                        <div className="cd-label-row">
                          <label htmlFor="cd-account-number">Account Number</label>
                          {form.accountNumber ? (
                            <button
                              type="button"
                              className="cd-mask-toggle-btn"
                              onClick={() => setShowAccountMask((m) => !m)}
                              title={showAccountMask ? 'Mask account digits' : 'Reveal account digits'}
                            >
                              {showAccountMask ? 'Mask' : 'Reveal'}
                            </button>
                          ) : null}
                        </div>
                        <input
                          id="cd-account-number"
                          type={showAccountMask ? 'text' : 'password'}
                          value={form.accountNumber}
                          autoComplete="off"
                          spellCheck={false}
                          inputMode="numeric"
                          className="cd-input-mono"
                          onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\s+/g, '') })}
                          placeholder="Bank account number"
                        />
                      </div>
                    </div>
                    </div>
                  </section>
                ) : null}

                {/* 4. Documents & Credentials */}
                {showBankAndAddress ? (
                  <section
                    className={`cd-form-section${isHcwProvider ? '' : ' cd-form-section--last'}${openSections.documents ? ' is-open' : ' is-collapsed'}`}
                    data-cd-section="documents"
                  >
                    <button
                      type="button"
                      className="cd-form-section-toggle"
                      aria-expanded={Boolean(openSections.documents)}
                      onClick={() => toggleSection('documents')}
                    >
                      <span className="cd-form-section-num">4</span>
                      <h4 className="cd-section-title">Documents &amp; Credentials</h4>
                      <span className="cd-form-section-chevron" aria-hidden="true">
                        {openSections.documents ? '▾' : '▸'}
                      </span>
                    </button>
                    <div className="cd-form-section-body" hidden={!openSections.documents}>
                    <p className="cd-form-hint">
                      {CONTACT_KYC_HINT}. Save the contact first to enable uploads.
                    </p>
                    <div className="cd-form-grid cd-docs-grid">
                      {renderDocumentUpload({
                        docType: 'aadhaar_front',
                        label: 'Aadhaar Card – Front',
                        urlKey: 'aadhaarFrontUrl',
                      })}
                      {renderDocumentUpload({
                        docType: 'aadhaar_back',
                        label: 'Aadhaar Card – Back',
                        urlKey: 'aadhaarBackUrl',
                      })}
                      {renderDocumentUpload({
                        docType: 'pan_card',
                        label: 'PAN Card',
                        urlKey: 'panCardCopyUrl',
                      })}
                      {renderDocumentUpload({
                        docType: 'passbook',
                        label: 'Passbook / Cheque',
                        urlKey: 'passbookCopyUrl',
                      })}
                      {renderDocumentUpload({
                        docType: 'educational_qualification',
                        label: 'Educational Certificate',
                        urlKey: 'educationalQualificationUrl',
                        qieSummary: form.educationalQie,
                      })}
                      {renderDocumentUpload({
                        docType: 'resume',
                        label: 'Resume',
                        urlKey: 'resumeUrl',
                      })}
                    </div>
                    </div>
                  </section>
                ) : null}

                {/* 5. Employee Details (Service Provider only) */}
                {isHcwProvider ? (
                  <section
                    className={`cd-form-section cd-form-section--last${openSections.employees ? ' is-open' : ' is-collapsed'}`}
                    data-cd-section="employees"
                  >
                    <button
                      type="button"
                      className="cd-form-section-toggle"
                      aria-expanded={Boolean(openSections.employees)}
                      onClick={() => toggleSection('employees')}
                    >
                      <span className="cd-form-section-num">5</span>
                      <h4 className="cd-section-title">Employee Details</h4>
                      <span className="cd-form-section-chevron" aria-hidden="true">
                        {openSections.employees ? '▾' : '▸'}
                      </span>
                    </button>
                    <div className="cd-form-section-body" hidden={!openSections.employees}>
                    <ServiceProviderProfile
                      form={form}
                      disabled={busy}
                      professionOptions={professionOptions}
                      editId={editId}
                      kycUploadBusy={kycUploadBusy}
                      uploadAccept={CONTACT_KYC_ACCEPT_ATTR}
                      uploadHint={CONTACT_KYC_HINT}
                      onEmployeesChange={(providerEmployees) => {
                        setRosterTouched(true);
                        setForm((f) => ({ ...f, providerEmployees }));
                      }}
                      onUploadEmployeeCertificate={(employeeId, file) => {
                        uploadKycDocument('employee_educational_qualification', file, { employeeId });
                      }}
                      onViewDocument={(url) => {
                        openUploadView(url).catch((err) => setError(err.message));
                      }}
                      onOpenQieReport={setQieReportId}
                    />
                    </div>
                  </section>
                ) : null}
              </div>

              {/* Sticky Drawer Footer */}
              <div className="cd-drawer-footer">
                <button
                  className="btn secondary btn-compact"
                  type="button"
                  onClick={() => closeDrawer(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button className="btn btn-compact" type="submit" disabled={busy}>
                  {busy ? 'Saving…' : editId ? 'Save changes' : 'Add to directory'}
                </button>
              </div>
            </form>
          </aside>
        )}

      {pendingDestructiveLeave ? (
        <div className="cd-drawer-roster-banner">
          <FeedbackBanner variant="warning">
            <div className="cd-roster-confirm">
              <p>
                This Service Provider has {rosterSnapshot.length || form.providerEmployees?.length || 0}{' '}
                employee(s). Clear the roster before changing category or type, or cancel to keep them.
              </p>
              <div className="cd-roster-confirm-actions">
                <button
                  type="button"
                  className="btn secondary btn-compact"
                  onClick={() => confirmLeaveProvider(true)}
                >
                  Clear roster and continue
                </button>
                <button
                  type="button"
                  className="btn ghost btn-compact"
                  onClick={() => setPendingDestructiveLeave(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </FeedbackBanner>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDiscardOpen}
        title="Discard Unsaved Changes?"
        message="You have unsaved changes to this contact record. Are you sure you want to discard them?"
        confirmLabel="Discard changes"
        confirmVariant="danger"
        onConfirm={() => closeDrawer(true)}
        onCancel={() => setConfirmDiscardOpen(false)}
      />

      <QieReportDialog
        open={Boolean(qieReportId)}
        verificationId={qieReportId}
        canReview={canWriteContacts}
        onClose={() => setQieReportId('')}
        onUpdated={(verification) => {
          applyQieSummaryToForm(verification);
          if (typeof onReload === 'function') onReload();
        }}
      />
    </>
  );
}
