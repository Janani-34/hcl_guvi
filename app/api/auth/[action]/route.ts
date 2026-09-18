import { NextResponse } from 'next/server'
import { bcrypt, createSession, getDb, normalizeEmail } from '@/lib/pulsepoll'

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params
  if (action !== 'signup' && action !== 'login') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? normalizeEmail(body.email) : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!email.includes('@') || password.length < 8) return NextResponse.json({ error: 'Use a valid email and a password of at least 8 characters' }, { status: 400 })

  try {
    const users = getDb().collection('users')
    if (action === 'signup') {
      const existing = await users.findOne({ email })
      if (existing) return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 })
      const user = { email, passwordHash: await bcrypt.hash(password, 12), createdAt: new Date() }
      const result = await users.insertOne(user)
      return NextResponse.json({ token: await createSession(result.insertedId.toString()), email }, { status: 201 })
    }

    const user = await users.findOne<{ _id: { toString(): string }; email: string; passwordHash: string }>({ email })
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    return NextResponse.json({ token: await createSession(user._id.toString()), email: user.email })
  } catch (error) {
    console.error('Authentication service unavailable', error)
    return NextResponse.json({ error: 'Authentication is not configured. Set MONGODB_URI and the Upstash Redis variables, then restart the app.' }, { status: 503 })
  }
}
