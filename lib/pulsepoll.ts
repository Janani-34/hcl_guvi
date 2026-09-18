import { MongoClient, ObjectId } from 'mongodb'
import { Redis } from '@upstash/redis'
import bcrypt from 'bcryptjs'

const globalForPulsepoll = globalThis as typeof globalThis & { pulsepollMongo?: MongoClient }

export function getDb() {
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) throw new Error('MONGODB_URI is not configured')
  const mongo = globalForPulsepoll.pulsepollMongo ?? new MongoClient(mongoUri)
  if (process.env.NODE_ENV !== 'production') globalForPulsepoll.pulsepollMongo = mongo
  return mongo.db(process.env.MONGODB_DATABASE ?? 'pulsepoll')
}

export function getRedis() {
  return new Redis({
    url: process.env.KV_REST_API_URL ?? process.env.KV_URL ?? '',
    token: process.env.KV_REST_API_TOKEN ?? process.env.KV_REST_API_READ_ONLY_TOKEN ?? '',
  })
}
export { ObjectId }

export async function createSession(userId: string) {
  const token = crypto.randomUUID().replaceAll('-', '')
  await getRedis().set(`session:${token}`, userId, { ex: 60 * 60 * 24 })
  return token
}

export async function authenticate(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  return getRedis().get<string>(`session:${token}`)
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export { bcrypt }
