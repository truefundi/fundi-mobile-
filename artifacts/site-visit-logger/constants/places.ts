import { type Ionicons } from '@expo/vector-icons';

/** The kinds of place a customer can save. "Other" takes a name of their own. */
export type PlaceKind = 'Home' | 'Work' | 'School' | 'Other';

/** An address the customer saved so a request can use it in one tap. */
export type SavedPlace = {
  id: string;
  kind: PlaceKind;
  /** "Home", "Work", "School", or the customer's own name for an "Other" place. */
  label: string;
  address: string;
};

export const PLACE_KINDS: PlaceKind[] = ['Home', 'Work', 'School', 'Other'];

export const PLACE_ICON: Record<PlaceKind, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Work: 'briefcase-outline',
  School: 'school-outline',
  Other: 'location-outline',
};

/** One line under the type buttons, so the choice is never a guess. */
export const PLACE_HINT: Record<PlaceKind, string> = {
  Home: 'Where you live.',
  Work: 'Your office, shop or workplace.',
  School: "Your school, or your child's.",
  Other: "Any other place, like a relative's house or a second home. Give it a name.",
};

/** Home, Work and School are one each, so "Home" always means one address; Other can repeat. */
export function isSingleKind(kind: PlaceKind): boolean {
  return kind !== 'Other';
}

/** Enough for the fixed places and a few others; a longer list stops being one tap. */
export const MAX_PLACES = 8;

/** What a customer can switch on or off for themselves. */
export type Preferences = {
  /** Short vibrations on slides, codes and finished steps. Phones only. */
  haptics: boolean;
  /** The saved place a new request starts with, if any. */
  defaultPlaceId?: string;
};

export const DEFAULT_PREFERENCES: Preferences = { haptics: true };
