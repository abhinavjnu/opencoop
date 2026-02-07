import { db } from './index.js';
import { sql } from 'drizzle-orm';
import * as schema from './schema.js';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';

async function migrate() {
  console.log('Running migrations...');

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('customer', 'restaurant', 'worker', 'coop_admin');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE order_status AS ENUM (
        'created', 'payment_held', 'restaurant_accepted', 'restaurant_rejected',
        'posted_to_board', 'worker_claimed', 'picked_up', 'delivered',
        'settled', 'cancelled', 'disputed', 'dispute_resolved'
      );
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE payment_status AS ENUM (
        'pending', 'authorized', 'captured', 'settled', 'refunded',
        'partially_refunded', 'failed'
      );
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE vehicle_type AS ENUM ('bicycle', 'motorcycle', 'car', 'walk');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE proposal_status AS ENUM (
        'draft', 'voting', 'passed', 'rejected', 'executed', 'expired'
      );
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE proposal_category AS ENUM (
        'delivery_fee', 'pool_rules', 'dispute_policy', 'membership', 'other'
      );
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE vote_choice AS ENUM ('for', 'against', 'abstain');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name VARCHAR(255) NOT NULL,
      role user_role NOT NULL,
      phone VARCHAR(20) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS restaurants (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      street TEXT NOT NULL,
      city VARCHAR(100) NOT NULL,
      postal_code VARCHAR(20) NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      phone VARCHAR(20) NOT NULL,
      is_open BOOLEAN NOT NULL DEFAULT false,
      opening_hours JSONB NOT NULL DEFAULT '{}',
      average_prep_time INTEGER NOT NULL DEFAULT 20,
      average_rating DOUBLE PRECISION NOT NULL DEFAULT 0,
      rating_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
      name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price INTEGER NOT NULL,
      category VARCHAR(100) NOT NULL,
      is_available BOOLEAN NOT NULL DEFAULT true,
      image_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      vehicle_type vehicle_type NOT NULL,
      zone VARCHAR(100) NOT NULL,
      is_online BOOLEAN NOT NULL DEFAULT false,
      current_lat DOUBLE PRECISION,
      current_lng DOUBLE PRECISION,
      total_deliveries INTEGER NOT NULL DEFAULT 0,
      average_rating DOUBLE PRECISION NOT NULL DEFAULT 0,
      rating_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES users(id),
      restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
      worker_id TEXT REFERENCES workers(id),
      items JSONB NOT NULL,
      subtotal INTEGER NOT NULL,
      delivery_fee INTEGER NOT NULL,
      tip INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      status order_status NOT NULL DEFAULT 'created',
      delivery_street TEXT NOT NULL,
      delivery_city VARCHAR(100) NOT NULL,
      delivery_postal_code VARCHAR(20) NOT NULL,
      delivery_lat DOUBLE PRECISION NOT NULL,
      delivery_lng DOUBLE PRECISION NOT NULL,
      estimated_prep_time INTEGER,
      estimated_delivery_time INTEGER,
      restaurant_accepted_at TIMESTAMPTZ,
      worker_claimed_at TIMESTAMPTZ,
      picked_up_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ,
      settled_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      cancellation_reason TEXT,
      proof_photo_url TEXT,
      signature_confirmation BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS escrow_records (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) UNIQUE,
      payment_intent_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'INR',
      status payment_status NOT NULL DEFAULT 'pending',
      restaurant_payout INTEGER,
      worker_payout INTEGER,
      coop_fee INTEGER,
      pool_contribution INTEGER,
      tip_amount INTEGER DEFAULT 0,
      restaurant_transfer_id TEXT,
      worker_transfer_id TEXT,
      refund_id TEXT,
      refund_amount INTEGER,
      settled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS worker_daily_earnings (
      id SERIAL PRIMARY KEY,
      worker_id TEXT NOT NULL REFERENCES workers(id),
      date DATE NOT NULL,
      deliveries_completed INTEGER NOT NULL DEFAULT 0,
      delivery_fees INTEGER NOT NULL DEFAULT 0,
      tips INTEGER NOT NULL DEFAULT 0,
      pool_topup INTEGER NOT NULL DEFAULT 0,
      total_earnings INTEGER NOT NULL DEFAULT 0,
      hours_online DOUBLE PRECISION NOT NULL DEFAULT 0,
      is_settled BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(worker_id, date)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pool_ledger (
      id SERIAL PRIMARY KEY,
      transaction_type VARCHAR(50) NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      order_id TEXT REFERENCES orders(id),
      worker_id TEXT REFERENCES workers(id),
      description TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pool_state (
      id INTEGER PRIMARY KEY DEFAULT 1,
      balance BIGINT NOT NULL DEFAULT 0,
      total_contributions BIGINT NOT NULL DEFAULT 0,
      total_topups BIGINT NOT NULL DEFAULT 0,
      last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      proposed_by TEXT NOT NULL REFERENCES users(id),
      proposer_role VARCHAR(20) NOT NULL,
      title VARCHAR(500) NOT NULL,
      description TEXT NOT NULL,
      category proposal_category NOT NULL,
      parameter_change JSONB,
      status proposal_status NOT NULL DEFAULT 'draft',
      votes_for INTEGER NOT NULL DEFAULT 0,
      votes_against INTEGER NOT NULL DEFAULT 0,
      abstentions INTEGER NOT NULL DEFAULT 0,
      quorum_required INTEGER NOT NULL DEFAULT 30,
      voting_started_at TIMESTAMPTZ,
      voting_ends_at TIMESTAMPTZ,
      executed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS votes (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL REFERENCES proposals(id),
      voter_id TEXT NOT NULL REFERENCES users(id),
      voter_role VARCHAR(20) NOT NULL,
      vote vote_choice NOT NULL,
      cast_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(proposal_id, voter_id)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ratings (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      rater_id TEXT NOT NULL REFERENCES users(id),
      rater_role VARCHAR(20) NOT NULL,
      target_id TEXT NOT NULL,
      target_role VARCHAR(20) NOT NULL,
      score INTEGER NOT NULL,
      comment TEXT,
      is_appealed BOOLEAN NOT NULL DEFAULT false,
      appeal_resolution VARCHAR(20),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(order_id, rater_id, target_id)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS disputes (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      raised_by TEXT NOT NULL REFERENCES users(id),
      dispute_type VARCHAR(50) NOT NULL,
      description TEXT NOT NULL,
      evidence JSONB NOT NULL DEFAULT '[]',
      resolution VARCHAR(50),
      resolved_by TEXT REFERENCES users(id),
      refund_amount INTEGER,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS event_log (
      id TEXT PRIMARY KEY,
      sequence_number SERIAL NOT NULL,
      event_type VARCHAR(100) NOT NULL,
      aggregate_id TEXT NOT NULL,
      aggregate_type VARCHAR(50) NOT NULL,
      version INTEGER NOT NULL,
      actor_id TEXT NOT NULL,
      actor_role VARCHAR(20) NOT NULL,
      data JSONB NOT NULL,
      previous_hash TEXT,
      hash TEXT NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(aggregate_id, aggregate_type, version)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS system_parameters (
      id INTEGER PRIMARY KEY DEFAULT 1,
      base_delivery_fee INTEGER NOT NULL DEFAULT 4000,
      per_km_rate INTEGER NOT NULL DEFAULT 1000,
      pool_contribution_rate INTEGER NOT NULL DEFAULT 10,
      infra_fee_rate INTEGER NOT NULL DEFAULT 10,
      daily_minimum_guarantee INTEGER NOT NULL DEFAULT 60000,
      default_quorum INTEGER NOT NULL DEFAULT 30,
      voting_period_hours INTEGER NOT NULL DEFAULT 72,
      restaurant_accept_timeout INTEGER NOT NULL DEFAULT 10,
      worker_pickup_timeout INTEGER NOT NULL DEFAULT 30,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by_proposal TEXT
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
    CREATE INDEX IF NOT EXISTS idx_orders_worker ON orders(worker_id);
    CREATE INDEX IF NOT EXISTS idx_event_log_aggregate ON event_log(aggregate_id, aggregate_type);
    CREATE INDEX IF NOT EXISTS idx_event_log_type ON event_log(event_type);
    CREATE INDEX IF NOT EXISTS idx_workers_online ON workers(is_online);
    CREATE INDEX IF NOT EXISTS idx_workers_zone ON workers(zone);
  `);

  await db.execute(sql`
    INSERT INTO pool_state (id, balance, total_contributions, total_topups)
    VALUES (1, 0, 0, 0)
    ON CONFLICT (id) DO NOTHING
  `);

  await db.execute(sql`
    INSERT INTO system_parameters (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `);

  console.log('Migrations complete.');
}

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

migrate()
  .then(() => seed())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration/seed failed:', err);
    process.exit(1);
  });
