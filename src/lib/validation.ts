import type { ClientInput, Client } from './types';

const LABELS: Partial<Record<keyof ClientInput, string>> = {
  firstName: 'First name',
  lastName: 'Last name',
  dob: 'Date of birth',
  email: 'Email address',
  phone: 'Phone number',
  address: 'Address',
  city: 'City',
  state: 'State',
  country: 'Country',
  postal: 'Postal code',
};

export function validateClient(v: ClientInput, clients: Client[], id?: string) {
  const e: Record<string, string> = {};
  for (const field of ['firstName', 'lastName'] as const)
    if (!/^[A-Za-z ]{2,50}$/.test(v[field].trim())) e[field] = 'Use 2–50 letters and spaces.';
  const birth = new Date(v.dob + 'T00:00:00');
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  )
    age--;
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(v.dob) &&
    !Number.isNaN(birth.getTime()) &&
    birth.getDate() === Number(v.dob.slice(8, 10));
  if (!validDate) e.dob = 'Enter a valid date of birth.';
  else if (birth >= today) e.dob = 'Date of birth must be in the past.';
  else if (age < 18 || age > 100) e.dob = 'Client must be between 18 and 100 years old.';
  if (!['Male', 'Female', 'Non-binary', 'Prefer not to say'].includes(v.gender))
    e.gender = 'Select a gender.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = 'Enter a valid email address.';
  else if (clients.some((c) => c.id !== id && c.email.toLowerCase() === v.email.toLowerCase()))
    e.email = 'This email is already registered.';
  if (!/^\+?\d{10,15}$/.test(v.phone)) e.phone = 'Use 10–15 digits, optionally starting with +.';
  else if (
    clients.some((c) => c.id !== id && c.phone.replace(/\D/g, '') === v.phone.replace(/\D/g, ''))
  )
    e.phone = 'This phone number is already registered.';
  for (const f of ['address', 'city', 'state', 'country'] as const) {
    const min = f === 'address' ? 5 : 2;
    const max = f === 'address' ? 100 : 50;
    if (v[f].trim().length < min || v[f].trim().length > max)
      e[f] = `Use ${min}–${max} characters.`;
  }
  if (v.country !== 'Singapore') e.country = 'This demo supports Singapore.';
  if (!/^\d{6}$/.test(v.postal)) e.postal = 'Enter a six-digit Singapore postal code.';
  // Empty fields report "required" before any format rule. A bare "+65" prefix counts as empty.
  for (const [field, label] of Object.entries(LABELS) as [keyof ClientInput, string][]) {
    const value = field === 'phone' ? v.phone.replace(/^\+?65$/, '') : v[field];
    if (!value.trim()) e[field] = `${label} is required.`;
  }

  return e;
}
