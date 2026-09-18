import { NextResponse } from 'next/server'
import { ObjectId, getDb } from '@/lib/pulsepoll'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  const poll = await getDb().collection('polls').findOne({ _id: new ObjectId(id) }, { projection: { _id: 1 } })
  if (!poll) return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('retry: 5000\n\n'))
      const keepAlive = setInterval(() => controller.enqueue(new TextEncoder().encode(': keep-alive\n\n')), 15000)
      _request.signal.addEventListener('abort', () => { clearInterval(keepAlive); controller.close() })
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } })
}
