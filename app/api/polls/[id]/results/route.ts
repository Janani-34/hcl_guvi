import { NextResponse } from 'next/server'
import { getDb, getRedis, ObjectId } from '@/lib/pulsepoll'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  const poll = await getDb().collection('polls').findOne({ _id: new ObjectId(id) }, { projection: { options: 1 } })
  if (!poll) return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  const counts = await getRedis().hgetall<Record<string, string>>(`poll:${id}:counts`)
  return NextResponse.json({ counts: Object.fromEntries(poll.options.map((option: string) => [option, Number(counts?.[option] ?? 0)])) })
}
