export type Country = {
  name: string;
  code: string; // ISO alpha-2 e.g. 'RW'
  dialCode: string; // e.g. '+250'
  flag: string; // Emoji flag representation
};

export const SUPPORTED_COUNTRIES: Country[] = [
  { name: 'Rwanda', code: 'RW', dialCode: '+250', flag: '🇷🇼' },
  { name: 'Uganda', code: 'UG', dialCode: '+256', flag: '🇺🇬' },
  { name: 'Kenya', code: 'KE', dialCode: '+254', flag: '🇰🇪' },
  { name: 'Tanzania', code: 'TZ', dialCode: '+255', flag: '🇹🇿' },
  { name: 'United States', code: 'US', dialCode: '+1', flag: '🇺🇸' },
];

export const DEFAULT_COUNTRY = SUPPORTED_COUNTRIES[0]; // Rwanda (+250)