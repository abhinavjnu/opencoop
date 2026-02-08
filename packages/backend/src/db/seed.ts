import { db } from './index.js';
import * as schema from './schema.js';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 10);

  const customerUserId = uuid();
  const restaurantUserId = uuid();
  const workerUserId = uuid();
  const adminUserId = uuid();
  const restaurantId = uuid();
  const workerId = uuid();

  await db.insert(schema.users).values([
    { id: customerUserId, email: 'customer@example.com', passwordHash, name: 'Priya Sharma', role: 'customer', phone: '+91-9876543210' },
    { id: restaurantUserId, email: 'restaurant@example.com', passwordHash, name: 'Rajesh Kumar', role: 'restaurant', phone: '+91-9876543211' },
    { id: workerUserId, email: 'worker@example.com', passwordHash, name: 'Amit Singh', role: 'worker', phone: '+91-9876543212' },
    { id: adminUserId, email: 'admin@example.com', passwordHash, name: 'Cooperative Admin', role: 'coop_admin', phone: '+91-9876543213' },
  ]).onConflictDoNothing();

  await db.insert(schema.restaurants).values({
    id: restaurantId,
    userId: restaurantUserId,
    name: 'Sharma Kitchen',
    description: 'Authentic North Indian cuisine',
    street: '42 MG Road',
    city: 'Bangalore',
    postalCode: '560001',
    lat: 12.9716,
    lng: 77.5946,
    phone: '+91-9876543211',
    isOpen: true,
    averagePrepTime: 25,
  }).onConflictDoNothing();

  const menuItemIds = [uuid(), uuid(), uuid(), uuid()];
  await db.insert(schema.menuItems).values([
    { id: menuItemIds[0]!, restaurantId, name: 'Butter Chicken', description: 'Creamy tomato curry with tender chicken', price: 28000, category: 'Main Course', isAvailable: true },
    { id: menuItemIds[1]!, restaurantId, name: 'Dal Makhani', description: 'Slow-cooked black lentils', price: 18000, category: 'Main Course', isAvailable: true },
    { id: menuItemIds[2]!, restaurantId, name: 'Garlic Naan', description: 'Clay oven bread with garlic', price: 6000, category: 'Breads', isAvailable: true },
    { id: menuItemIds[3]!, restaurantId, name: 'Mango Lassi', description: 'Sweet yogurt drink with mango', price: 8000, category: 'Beverages', isAvailable: true },
  ]).onConflictDoNothing();

  await db.insert(schema.workers).values({
    id: workerId,
    userId: workerUserId,
    name: 'Amit Singh',
    phone: '+91-9876543212',
    vehicleType: 'motorcycle',
    zone: 'central-bangalore',
    isOnline: true,
    currentLat: 12.9750,
    currentLng: 77.5900,
  }).onConflictDoNothing();

  console.log('Seeding complete.');
  console.log('Test accounts:');
  console.log('  Customer: customer@example.com / password123');
  console.log('  Restaurant: restaurant@example.com / password123');
  console.log('  Worker: worker@example.com / password123');
  console.log('  Admin: admin@example.com / password123');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
