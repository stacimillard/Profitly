export interface CanadianProvince {
  code: string;
  name: string;
  gst_hst_rate: number;
}

export const CANADIAN_PROVINCES: CanadianProvince[] = [
  { code: 'AB', name: 'Alberta',                     gst_hst_rate: 0.05 },
  { code: 'BC', name: 'British Columbia',            gst_hst_rate: 0.05 },
  { code: 'MB', name: 'Manitoba',                    gst_hst_rate: 0.05 },
  { code: 'NB', name: 'New Brunswick',               gst_hst_rate: 0.15 },
  { code: 'NL', name: 'Newfoundland and Labrador',   gst_hst_rate: 0.15 },
  { code: 'NS', name: 'Nova Scotia',                 gst_hst_rate: 0.15 },
  { code: 'NT', name: 'Northwest Territories',       gst_hst_rate: 0.05 },
  { code: 'NU', name: 'Nunavut',                     gst_hst_rate: 0.05 },
  { code: 'ON', name: 'Ontario',                     gst_hst_rate: 0.13 },
  { code: 'PE', name: 'Prince Edward Island',        gst_hst_rate: 0.15 },
  { code: 'QC', name: 'Quebec',                      gst_hst_rate: 0.05 },
  { code: 'SK', name: 'Saskatchewan',                gst_hst_rate: 0.05 },
  { code: 'YT', name: 'Yukon',                       gst_hst_rate: 0.05 },
];

export function gstHstRateForProvince(code: string | null): number {
  if (!code) return 0.05;
  const found = CANADIAN_PROVINCES.find((p) => p.code === code);
  return found?.gst_hst_rate ?? 0.05;
}
