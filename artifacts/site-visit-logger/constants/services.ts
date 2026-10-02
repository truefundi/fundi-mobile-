import type { MaterialCommunityIcons } from '@expo/vector-icons';

export type Service = {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  /** Extra words a customer might search with, so "tap" still finds Plumbing. */
  keywords: string;
};

/** The one list of services, shared by Home and the Services tab. */
export const SERVICES: Service[] = [
  { label: 'Car & Garage', icon: 'car-outline', keywords: 'car vehicle garage engine tyre tire battery mechanic' },
  { label: 'Electrical', icon: 'flash-outline', keywords: 'electric electricity power socket wiring light switch' },
  { label: 'Plumbing', icon: 'pipe-wrench', keywords: 'plumber water pipe leak tap toilet drain sink' },
  { label: 'HVAC', icon: 'snowflake', keywords: 'air conditioning ac heating cooling fan ventilation fridge' },
  { label: 'Home Repair', icon: 'home-outline', keywords: 'house door window roof wall paint carpentry' },
  { label: 'Appliance Repair', icon: 'washing-machine', keywords: 'appliance washing machine cooker oven tv fridge' },
  { label: 'Truck & Mechanical', icon: 'truck-outline', keywords: 'truck lorry machine mechanical generator' },
  { label: 'General Maintenance', icon: 'tools', keywords: 'general maintenance handyman other fix' },
];

/** Case-insensitive match on the label or any keyword. */
export function searchServices(query: string): Service[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return SERVICES;
  return SERVICES.filter((service) => {
    const haystack = `${service.label} ${service.keywords}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
