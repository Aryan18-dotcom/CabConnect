import 'dotenv/config';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { collection, connectDatabase, dbMode } from './src/db/index.js';

const drivers = [
  { _id: 'cabconnect-demo-driver-01', name: 'Demo Driver 1 - replace', phone: 'REPLACE-ME-DRIVER-01', age: 30, status: 'ACTIVE', vehicleId: 'cabconnect-demo-vehicle-01', seedKey: 'cabconnect-demo-driver-01' },
  { _id: 'cabconnect-demo-driver-02', name: 'Demo Driver 2 - replace', phone: 'REPLACE-ME-DRIVER-02', age: 32, status: 'ACTIVE', vehicleId: 'cabconnect-demo-vehicle-02', seedKey: 'cabconnect-demo-driver-02' },
  { _id: 'cabconnect-demo-driver-03', name: 'Demo Driver 3 - replace', phone: 'REPLACE-ME-DRIVER-03', age: 28, status: 'ACTIVE', vehicleId: 'cabconnect-demo-vehicle-03', seedKey: 'cabconnect-demo-driver-03' },
  { _id: 'cabconnect-demo-driver-04', name: 'Demo Driver 4 - replace', phone: 'REPLACE-ME-DRIVER-04', age: 35, status: 'ACTIVE', vehicleId: 'cabconnect-demo-vehicle-04', seedKey: 'cabconnect-demo-driver-04' }
];

const vehicles = [
  {
    _id: 'cabconnect-demo-vehicle-01', seedKey: 'cabconnect-demo-vehicle-01',
    vehicleName: 'Demo MPV 1 - replace', registrationNumber: 'DEMO-VEHICLE-01',
    imageUrl: 'https://images.unsplash.com/photo-1631295868223-63265b40d9e4?q=80&w=387&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxM3A3fDA%3D',
    fuelType: 'CNG', minPassengers: 1, maxPassengers: 7, luggageStorageType: 'BOOT',
    perKilometerRate: 15, driverDailyCost: 500, primaryDriverId: 'cabconnect-demo-driver-01',
    ownershipType: 'OWNED', operationalStatus: 'INACTIVE', availabilityStatus: 'AVAILABLE'
  },
  {
    _id: 'cabconnect-demo-vehicle-02', seedKey: 'cabconnect-demo-vehicle-02',
    vehicleName: 'Demo MPV 2 - replace', registrationNumber: 'DEMO-VEHICLE-02',
    imageUrl: 'https://images.unsplash.com/photo-1787178605268-36282fb87172?q=80&w=435&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxM3A3fDA%3D',
    fuelType: 'DIESEL', minPassengers: 1, maxPassengers: 7, luggageStorageType: 'BOOT',
    perKilometerRate: 15, driverDailyCost: 500, primaryDriverId: 'cabconnect-demo-driver-02',
    ownershipType: 'OWNED', operationalStatus: 'INACTIVE', availabilityStatus: 'AVAILABLE'
  },
  {
    _id: 'cabconnect-demo-vehicle-03', seedKey: 'cabconnect-demo-vehicle-03',
    vehicleName: 'Demo SUV - replace', registrationNumber: 'DEMO-VEHICLE-03',
    imageUrl: 'https://images.unsplash.com/photo-1748215210939-ad8b6c8c086d?q=80&w=871&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxM3A3fDA%3D',
    fuelType: 'DIESEL', minPassengers: 1, maxPassengers: 7, luggageStorageType: 'BOOT',
    perKilometerRate: 15, driverDailyCost: 500, primaryDriverId: 'cabconnect-demo-driver-03',
    ownershipType: 'OWNED', operationalStatus: 'INACTIVE', availabilityStatus: 'AVAILABLE'
  },
  {
    _id: 'cabconnect-demo-vehicle-04', seedKey: 'cabconnect-demo-vehicle-04',
    vehicleName: 'Demo Sedan - replace', registrationNumber: 'DEMO-VEHICLE-04',
    imageUrl: 'https://images.unsplash.com/photo-1663852397535-18292e115327?q=80&w=580&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=NHwxM3A3fDA%3D',
    fuelType: 'PETROL', minPassengers: 1, maxPassengers: 4, luggageStorageType: 'BOOT',
    perKilometerRate: 15, driverDailyCost: 500, primaryDriverId: 'cabconnect-demo-driver-04',
    ownershipType: 'OWNED', operationalStatus: 'INACTIVE', availabilityStatus: 'AVAILABLE'
  }
];

export async function seedData() {
  if (dbMode !== 'sqlite' && !process.argv.includes('--confirm-production')) {
    throw new Error('Production database seeding requires --confirm-production. Review and edit the demo records in seedData.js first.');
  }

  await connectDatabase();
  const driverCollection = collection('drivers');
  const vehicleCollection = collection('vehicles');
  let insertedDrivers = 0;
  let insertedVehicles = 0;

  for (const driver of drivers) {
    const existing = await driverCollection.findOne({ _id: driver._id });
    if (existing) continue;
    await driverCollection.insert(driver);
    insertedDrivers++;
  }

  for (const vehicle of vehicles) {
    const existing = await vehicleCollection.findOne({ _id: vehicle._id });
    if (existing) continue;
    await vehicleCollection.insert(vehicle);
    insertedVehicles++;
  }

  console.log(`Seed complete (${dbMode}): added ${insertedDrivers} demo drivers and ${insertedVehicles} demo vehicles.`);
  console.log('Existing seed records were left unchanged. Replace the demo names, phone values, registration numbers, vehicle details and sample rates before real operation.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    await seedData();
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  }
}
