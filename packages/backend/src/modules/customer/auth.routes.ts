import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { generateToken } from '../../middleware/auth.js';
import { validate, registerSchema, loginSchema } from '../../middleware/validation.js';

const router = Router();

router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone, role } = req.body;

    if (role === 'coop_admin') {
      res.status(403).json({ error: 'Admin registration is not allowed via public endpoint' });
      return;
    }

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing[0]) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuid();

    await db.insert(users).values({
      id: userId,
      email,
      passwordHash,
      name,
      role,
      phone,
    });

    const token = generateToken({ userId, email, role });

    res.status(201).json({ userId, email, role, token });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user[0]) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user[0].passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken({
      userId: user[0].id,
      email: user[0].email,
      role: user[0].role,
    });

    res.json({
      userId: user[0].id,
      email: user[0].email,
      name: user[0].name,
      role: user[0].role,
      token,
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

export const authRoutes = router;
