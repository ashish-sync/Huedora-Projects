/**
 * Letterhead lines for commercial documents — Identity + Tax registration.
 *
 * Default:
 *   Line 1: bold legal name + regular " • address"
 *   Line 2: GSTIN | CIN | Udyam | Email | Website
 *
 * Purchase Order compact (portrait space):
 *   Line 1: bold legal name only
 *   Line 2: CIN | Udyam | Website
 *
 * @param {object} company
 * @param {{ omitUdyam?: boolean, variant?: 'default' | 'po-compact' }} [options]
 */

function clean(value) {
  return value == null ? '' : String(value).trim();
}

function displayWebsite(value) {
  return clean(value)
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '');
}

export function formatCompanyLetterhead(company = {}, options = {}) {
  const legalName = clean(company.legalName);
  const address = clean(company.address || company.registeredOffice);
  const website = displayWebsite(company.website);
  const udyam = clean(company.udyam);
  const cin = clean(company.cin);

  if (options.variant === 'po-compact') {
    const metaParts = [
      cin ? `CIN: ${cin}` : '',
      udyam ? `Udyam: ${udyam}` : '',
      website ? `Website: ${website}` : '',
    ].filter(Boolean);
    const line2 = metaParts.join(' | ');
    return {
      legalName,
      address: '',
      line1: legalName,
      line2,
      metaParts,
      lines: [legalName, line2].filter(Boolean),
    };
  }

  const line1 = [legalName, address].filter(Boolean).join(' • ');
  const udyamPart = !options.omitUdyam && udyam ? `Udyam: ${udyam}` : '';

  const metaParts = [
    company.gstin ? `GSTIN: ${clean(company.gstin)}` : '',
    cin ? `CIN: ${cin}` : '',
    udyamPart,
    company.email ? `Email: ${clean(company.email)}` : '',
    website ? `Website: ${website}` : '',
  ].filter(Boolean);

  const line2 = metaParts.join(' | ');

  return {
    legalName,
    address,
    line1,
    line2,
    metaParts,
    lines: [line1, line2].filter(Boolean),
  };
}
