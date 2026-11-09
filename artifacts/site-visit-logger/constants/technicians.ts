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
    service: 'General Maintenance & Handyman',
    services: ['General Maintenance', 'Home Repair', 'Carpentry', 'Painting'],
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
    service: 'Plumbing & Electrical Specialist',
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
    service: 'Master Carpenter & Joinery',
    services: ['Carpentry', 'Home Repair', 'Roofing'],
    rating: 4.8,
    reviewsCount: 39,
    jobsCompleted: 67,
    etaMinutes: 20,
    yearsExperience: 7,
    location: { latitude: -1.9167, longitude: 30.1021 },
    isAvailable: true,
    phoneNumber: '+250788666666',
  },
  {
    id: 'tech-4',
    name: 'Aline Mukamana',
    service: 'HVAC & Appliance Specialist',
    services: ['HVAC & Refrigeration', 'HVAC', 'Appliance Repair'],
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
  {
    id: 'tech-6',
    name: 'Eric Mugisha',
    service: 'Masonry & Construction Finishes',
    services: ['Masonry', 'Home Repair', 'Roofing'],
    rating: 4.9,
    reviewsCount: 47,
    jobsCompleted: 91,
    etaMinutes: 22,
    yearsExperience: 8,
    location: { latitude: -1.9482, longitude: 30.0654 },
    isAvailable: true,
    phoneNumber: '+250788999111',
  },
  {
    id: 'tech-7',
    name: 'David Tuyisenge',
    service: 'Professional Painter & Finisher',
    services: ['Painting', 'Home Repair', 'General Maintenance'],
    rating: 4.8,
    reviewsCount: 33,
    jobsCompleted: 58,
    etaMinutes: 16,
    yearsExperience: 5,
    location: { latitude: -1.9398, longitude: 30.0782 },
    isAvailable: true,
    phoneNumber: '+250788999222',
  },
  {
    id: 'tech-8',
    name: 'Innocent Habineza',
    service: 'Roofing & Waterproofing Specialist',
    services: ['Roofing', 'Masonry', 'Carpentry'],
    rating: 4.7,
    reviewsCount: 29,
    jobsCompleted: 52,
    etaMinutes: 25,
    yearsExperience: 6,
    location: { latitude: -1.9612, longitude: 30.0841 },
    isAvailable: true,
    phoneNumber: '+250788999333',
  },
  {
    id: 'tech-9',
    name: 'Faustin Kayiranga',
    service: 'Master Locksmith & Security',
    services: ['Locksmith', 'General Maintenance'],
    rating: 4.9,
    reviewsCount: 61,
    jobsCompleted: 110,
    etaMinutes: 14,
    yearsExperience: 10,
    location: { latitude: -1.9515, longitude: 30.0598 },
    isAvailable: true,
    phoneNumber: '+250788999444',
  },
  {
    id: 'tech-10',
    name: 'Olivier Twagirayezu',
    service: 'Welding & Metal Fabrication',
    services: ['Welding & Metalwork', 'Welding', 'General Maintenance'],
    rating: 4.9,
    reviewsCount: 45,
    jobsCompleted: 88,
    etaMinutes: 19,
    yearsExperience: 8,
    location: { latitude: -1.9421, longitude: 30.0955 },
    isAvailable: true,
    phoneNumber: '+250788999555',
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
