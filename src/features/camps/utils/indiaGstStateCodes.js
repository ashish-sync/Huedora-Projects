/** GST state/UT codes (first two digits of GSTIN) keyed by normalized state name. */
const GST_STATE_CODE_BY_NAME = {
  'andaman and nicobar islands': '35',
  'andhra pradesh': '37',
  'arunachal pradesh': '12',
  assam: '18',
  bihar: '10',
  chandigarh: '04',
  chhattisgarh: '22',
  'dadra and nagar haveli and daman and diu': '26',
  delhi: '07',
  goa: '30',
  gujarat: '24',
  haryana: '06',
  'himachal pradesh': '02',
  'jammu and kashmir': '01',
  jharkhand: '20',
  karnataka: '29',
  kerala: '32',
  ladakh: '38',
  lakshadweep: '31',
  'madhya pradesh': '23',
  maharashtra: '27',
  manipur: '14',
  meghalaya: '17',
  mizoram: '15',
  nagaland: '13',
  odisha: '21',
  puducherry: '34',
  punjab: '03',
  rajasthan: '08',
  sikkim: '11',
  'tamil nadu': '33',
  telangana: '36',
  tripura: '16',
  'uttar pradesh': '09',
  uttarakhand: '05',
  'west bengal': '19',
};

function norm(name) {
  return String(name || '').trim().toLowerCase();
}

export function gstStateCodeForName(stateName) {
  return GST_STATE_CODE_BY_NAME[norm(stateName)] || '';
}
