import type { Coordinates } from '@/lib/location';
import { distanceMeters } from '@/lib/location';
import type { Technician } from '@/constants/jobs';

export type MarketplaceTechnician = {
  id: string;
  name: string;
  service: string;
  services: string[];
  rating: number;
  reviewsCount: number;
  jobsCompleted: number;
  etaMinutes: number;
  yearsExperience: number;
  location: Coordinates;
  isAvailable: boolean;
  phoneNumber: string;
};

export const MOCK_MARKETPLACE_TECHNICIANS: MarketplaceTechnician[] = [
  {
    id: 'tech-1',
    name: 'Jean Paul Nkurunziza',
    service: 'General Maintenance',
    services: ['General Maintenance', 'Home Repair'],
    rating: 4.8,
    reviewsCount: 42,
    jobsCompleted: 86,
    etaMinutes: 15,
    yearsExperience: 6,
    location: { latitude: -1.9448, longitude: 30.0619 },
    isAvailable: true,
    phoneNumber: '+250788444444',
  },
  {
    id: 'tech-2',
    name: 'Claude Habimana',
    service: 'Plumbing & Electrical',
    services: ['Plumbing', 'Electrical'],
    rating: 4.9,
    reviewsCount: 68,
    jobsCompleted: 124,
    etaMinutes: 18,
    yearsExperience: 9,
    location: { latitude: -1.9536, longitude: 30.0928 },
    isAvailable: true,
    phoneNumber: '+250788555555',
  },
  {
    id: 'tech-3',
    name: 'Patrick Bizimana',
    service: 'Carpentry & Roofing',
    services: ['Home Repair'],
    rating: 4.7,
    reviewsCount: 31,
    jobsCompleted: 59,
    etaMinutes: 22,
    yearsExperience: 5,
    location: { latitude: -1.9167, longitude: 30.1021 },
    isAvailable: false,
    phoneNumber: '+250788666666',
  },
  {
    id: 'tech-4',
    name: 'Aline Mukamana',
    service: 'HVAC & Appliance Repair',
    services: ['HVAC', 'Appliance Repair'],
    rating: 4.8,
    reviewsCount: 37,
    jobsCompleted: 72,
    etaMinutes: 20,
    yearsExperience: 7,
    location: { latitude: -1.9321, longitude: 30.0872 },
    isAvailable: true,
    phoneNumber: '+250788777777',
  },
  {
    id: 'tech-5',
    name: 'Emmanuel Niyonzima',
    service: 'Automotive & Heavy Mechanical',
    services: ['Car & Garage', 'Truck & Mechanical'],
    rating: 4.9,
    reviewsCount: 54,
    jobsCompleted: 103,
    etaMinutes: 17,
    yearsExperience: 8,
    location: { latitude: -1.9572, longitude: 30.0734 },
    isAvailable: true,
    phoneNumber: '+250788888888',
  },
];

export function toJobTechnician(
  technician: MarketplaceTechnician,
  requestLocation?: Coordinates,
): Technician {
  const meters = requestLocation ? distanceMeters(requestLocation, technician.location) : null;
  const distanceKm = meters === null ? undefined : Math.round((meters / 1000) * 10) / 10;
  return {
    id: technician.id,
    name: technician.name,
    skill: technician.service,
    rating: technician.rating,
    jobsCompleted: technician.jobsCompleted,
    ...(distanceKm === undefined ? {} : { distanceKm }),
    etaMinutes: technician.etaMinutes,
    initials: technician.name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase(),
    phone: technician.phoneNumber,
    yearsExperience: technician.yearsExperience,
    location: technician.location,
  };
}
