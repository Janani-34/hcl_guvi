import { NextResponse } from 'next/server'
import { authenticate, getDb, getRedis, ObjectId } from '@/lib/pulsepoll'

export async function POST(request: Request) {
  const userId = await authenticate(request)
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const question = typeof body?.question === 'string' ? body.question.trim() : ''
  const options: string[] = Array.isArray(body?.options) ? body.options.filter((value: unknown): value is string => typeof value === 'string').map((value: string) => value.trim()) : []
  const normalized = options.map((value: string) => value.toLowerCase())
  if (question.length < 3 || options.length < 2 || options.length > 10 || options.some((value) => !value) || new Set(normalized).size !== options.length) {
    return NextResponse.json({ error: 'A question and 2–10 unique options are required' }, { status: 400 })
  }
  const poll = { question, options, createdBy: userId, createdAt: new Date() }
  const result = await getDb().collection('polls').insertOne(poll)
  const id = result.insertedId.toString()
  await getRedis().hset(`poll:${id}:counts`, Object.fromEntries(options.map((option: string) => [option, 0])))
  return NextResponse.json({ id, question, options }, { status: 201 })
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id')
  if (!id || !ObjectId.isValid(id)) return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  const poll = await getDb().collection('polls').findOne({ _id: new ObjectId(id) })
  if (!poll) return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  return NextResponse.json({ id: poll._id.toString(), question: poll.question, options: poll.options })
}
