export type MarketplaceTechnician = {
  id: string;
  name: string;
  service: string;
  rating: number;
  reviewsCount: number;
  distanceKm: number;
  isAvailable: boolean;
  phoneNumber: string;
};

export const MOCK_MARKETPLACE_TECHNICIANS: MarketplaceTechnician[] = [
  {
    id: 'tech-1',
    name: 'Jean Paul Nkurunziza',
    service: 'General Maintenance',
    rating: 4.8,
    reviewsCount: 42,
    distanceKm: 1.2,
    isAvailable: true,
    phoneNumber: '+250788444444',
  },
  {
    id: 'tech-2',
    name: 'Claude Habimana',
    service: 'Plumbing & Electrical',
    rating: 4.9,
    reviewsCount: 68,
    distanceKm: 2.5,
    isAvailable: true,
    phoneNumber: '+250788555555',
  },
  {
    id: 'tech-3',
    name: 'Patrick Bizimana',
    service: 'Carpentry & Roofing',
    rating: 4.7,
    reviewsCount: 31,
    distanceKm: 4.0,
    isAvailable: false,
    phoneNumber: '+250788666666',
  },
];
