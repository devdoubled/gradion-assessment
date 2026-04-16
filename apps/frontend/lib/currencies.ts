export interface Currency {
  code: string;
  name: string;
  flag: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar',   flag: '🇨🇦' },
  { code: 'CHF', name: 'Swiss Franc',        flag: '🇨🇭' },
  { code: 'CNY', name: 'Chinese Yuan',       flag: '🇨🇳' },
  { code: 'EUR', name: 'Euro',               flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound',      flag: '🇬🇧' },
  { code: 'JPY', name: 'Japanese Yen',       flag: '🇯🇵' },
  { code: 'USD', name: 'US Dollar',          flag: '🇺🇸' },
  { code: 'VND', name: 'Vietnamese Dong',    flag: '🇻🇳' },
];
