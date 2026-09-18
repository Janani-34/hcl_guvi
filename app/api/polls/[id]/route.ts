import { NextResponse } from 'next/server'
import { getDb, getRedis, ObjectId } from '@/lib/pulsepoll'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  const poll = await getDb().collection('polls').findOne({ _id: new ObjectId(id) })
  if (!poll) return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  return NextResponse.json({ id, question: poll.question, options: poll.options })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  const body = await request.json().catch(() => null)
  const option = typeof body?.option === 'string' ? body.option.trim() : ''
  const poll = await getDb().collection('polls').findOne({ _id: new ObjectId(id) })
  if (!poll) return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  if (!poll.options.includes(option)) return NextResponse.json({ error: 'Choose a valid poll option' }, { status: 400 })

  const redis = getRedis()
  const countKey = `poll:${id}:counts`
  await redis.hincrby(countKey, option, 1)
  await getDb().collection('votes').insertOne({ pollId: new ObjectId(id), option, createdAt: new Date() })
  return NextResponse.json({ ok: true })
}
