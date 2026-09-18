'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  Eye,
  Gauge,
  Link2,
  LockKeyhole,
  Plus,
  Radio,
  Share2,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

type Option = {
  label: string
  votes: number
  color: string
}

type Poll = {
  id: string
  question: string
  options: string[]
}

const colors = [
  'bg-cyan-400',
  'bg-emerald-400',
  'bg-orange-400',
  'bg-rose-400',
  'bg-violet-400',
  'bg-amber-400',
]

const starterOptions: Option[] = [
  'React',
  'Vue',
  'Svelte',
  'Angular',
].map((label, i) => ({
  label,
  votes: [46, 21, 14, 9][i],
  color: colors[i],
}))

export default function Page() {
  const [options, setOptions] = useState(starterOptions)
  const [selected, setSelected] = useState('React')
  const [voted, setVoted] = useState(false)
  const [activeTab, setActiveTab] = useState<'vote' | 'results'>('vote')
  const [poll, setPoll] = useState<Poll | null>(null)

  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [status, setStatus] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [newOptions, setNewOptions] = useState(['', ''])

  const [token, setToken] = useState<string | null>(null)

  const total = useMemo(
    () => options.reduce((sum, option) => sum + option.votes, 0),
    [options]
  )

  // Restore login session
  useEffect(() => {
    setToken(sessionStorage.getItem('pulsepoll_token'))
  }, [])

  // Load poll from URL
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('poll')

    if (!id) return

    fetch(`${API_BASE}/api/polls/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(async (data) => {
        if (!data) return

        setPoll(data)
        setSelected(data.options[0])

        const results = await fetch(
          `${API_BASE}/api/polls/${id}/results`
        )

        const resultData = await results.json()

        setOptions(
          pollOptions(resultData.counts, data.options)
        )
      })
      .catch(() => {
        setStatus('This poll could not be loaded.')
      })
  }, [])

  // Real-time vote updates using Server-Sent Events
  useEffect(() => {
    if (!poll?.id) return

    const source = new EventSource(
      `${API_BASE}/api/polls/${poll.id}/events`
    )

    source.addEventListener('vote', (event) => {
      const option = (event as MessageEvent).data

      setOptions((current) =>
        current.map((item) =>
          item.label === option
            ? {
                ...item,
                votes: item.votes + 1,
              }
            : item
        )
      )
    })

    return () => source.close()
  }, [poll?.id])

  // Submit vote
  async function castVote() {
    if (!poll || voted || !selected) return

    try {
      /*
       * IMPORTANT:
       * Backend route is:
       * POST /api/polls/:id/votes
       */
      const response = await fetch(
        `${API_BASE}/api/polls/${poll.id}/votes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            option: selected,
          }),
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setStatus(
          data.error ?? 'Could not record that vote.'
        )
        return
      }

      setVoted(true)
      setActiveTab('results')
      setStatus('Vote recorded successfully.')
    } catch {
      setStatus(
        'Voting is temporarily unavailable. Please try again.'
      )
    }
  }

  // Login / signup
  async function submitAuth() {
    try {
      const response = await fetch(
        `${API_BASE}/api/auth/${
          authMode === 'signup' ? 'signup' : 'login'
        }`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setStatus(
          data.error ?? 'Authentication failed'
        )
        return
      }

      sessionStorage.setItem(
        'pulsepoll_token',
        data.token
      )

      setToken(data.token)
      setAuthOpen(false)
      setStatus(
        'Signed in. You can create a poll.'
      )
    } catch {
      setStatus(
        'The poll service is unavailable. Start the backend or configure NEXT_PUBLIC_API_URL, then try again.'
      )
    }
  }

  // Create poll
  async function createPoll() {
    if (!token) {
      setAuthOpen(true)
      return
    }

    try {
      const response = await fetch(
        `${API_BASE}/api/polls`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            question,
            options: newOptions,
          }),
        }
      )

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setStatus(
          data.error ?? 'Could not create poll'
        )
        return
      }

      window.history.pushState(
        {},
        '',
        `?poll=${data.id}`
      )

      setPoll(data)

      setOptions(
        data.options.map(
          (label: string, i: number) => ({
            label,
            votes: 0,
            color: colors[i % colors.length],
          })
        )
      )

      setSelected(data.options[0])

      setCreateOpen(false)
      setQuestion('')
      setNewOptions(['', ''])

      setStatus(
        'Poll created. Share the link with your audience.'
      )
    } catch {
      setStatus(
        'The poll service is unavailable. Please try again when the backend is running.'
      )
    }
  }

  // Copy poll link
  async function copyLink() {
    await navigator.clipboard.writeText(
      window.location.href
    )

    setStatus('Poll link copied.')
  }

  const title =
    poll?.question ??
    'What is your favorite frontend framework?'

  return (
    <main className="min-h-screen overflow-hidden bg-[#07131e] text-white">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      {/* Navigation */}
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="brand-mark">
            <Radio
              size={17}
              strokeWidth={2.5}
            />
          </div>

          <span className="text-lg font-semibold tracking-tight">
            Pulse
            <span className="text-cyan-300">
              poll
            </span>
          </span>

          <span className="hidden rounded-full border border-white/10 bg-white/[.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[.18em] text-slate-400 sm:inline">
            Live polling
          </span>
        </div>

        <div className="flex items-center gap-5 text-sm text-slate-400">
          <a
            className="hidden transition hover:text-white md:inline"
            href="#how-it-works"
          >
            How it works
          </a>

          <button
            onClick={() => setAuthOpen(true)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[.05] px-4 py-2 text-slate-200 transition hover:border-cyan-300/40 hover:bg-white/10"
          >
            <LockKeyhole size={14} />

            {token ? 'Account' : 'Sign in'}
          </button>
        </div>
      </nav>

      {/* Hero + Poll */}
      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-6 pb-20 pt-10 lg:grid-cols-[.85fr_1.15fr] lg:px-10 lg:pb-28 lg:pt-16">
        <div className="max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[.07] px-3 py-1.5 text-xs font-medium text-cyan-200">
            <span className="pulse-dot" />
            Real-time by design
          </div>

          <h1 className="text-balance text-5xl font-semibold leading-[1.04] tracking-[-.055em] text-white sm:text-6xl lg:text-[76px]">
            Make every
            <br />
            <span className="text-cyan-300">
              voice count.
            </span>
          </h1>

          <p className="mt-7 max-w-md text-base leading-7 text-slate-400 sm:text-lg">
            Create a poll in seconds, share it anywhere,
            and watch the room respond together.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <button
              onClick={() =>
                token
                  ? setCreateOpen(true)
                  : setAuthOpen(true)
              }
              className="button-primary"
            >
              <Plus size={17} />
              Create a poll
              <ChevronRight size={16} />
            </button>

            <button
              onClick={() =>
                document
                  .querySelector('.poll-shell')
                  ?.scrollIntoView({
                    behavior: 'smooth',
                  })
              }
              className="button-secondary"
            >
              <Eye size={16} />
              Join a poll
            </button>
          </div>

          <div className="mt-9 flex items-center gap-5 text-xs text-slate-500">
            <span className="flex items-center gap-2">
              <Zap
                size={14}
                className="text-cyan-300"
              />
              Instant updates
            </span>

            <span className="flex items-center gap-2">
              <Users
                size={14}
                className="text-cyan-300"
              />
              No account to vote
            </span>
          </div>

          {status && (
            <p
              role="status"
              className="mt-5 text-sm text-cyan-200"
            >
              {status}
            </p>
          )}
        </div>

        {/* Poll */}
        <div className="poll-shell">
          <div className="poll-topline">
            <span className="flex items-center gap-2">
              <span className="live-dot" />
              LIVE POLL
            </span>

            <span className="flex items-center gap-1.5 text-slate-500">
              <Users size={14} />
              Live audience
            </span>
          </div>

          <div className="poll-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-3 text-xs font-medium uppercase tracking-[.18em] text-cyan-300">
                  Question of the day
                </p>

                <h2 className="text-2xl font-semibold leading-tight tracking-tight text-white">
                  {title}
                </h2>
              </div>

              <CircleHelp
                size={20}
                className="mt-1 shrink-0 text-slate-600"
              />
            </div>

            <div className="mt-7 flex border-b border-white/[.08] text-sm">
              <button
                onClick={() =>
                  setActiveTab('vote')
                }
                className={`tab ${
                  activeTab === 'vote'
                    ? 'tab-active'
                    : ''
                }`}
              >
                Cast your vote
              </button>

              <button
                onClick={() =>
                  setActiveTab('results')
                }
                className={`tab ${
                  activeTab === 'results'
                    ? 'tab-active'
                    : ''
                }`}
              >
                Live results
              </button>
            </div>

            {activeTab === 'vote' ? (
              <div className="space-y-2.5 pt-5">
                {options.map((option) => (
                  <button
                    key={option.label}
                    onClick={() =>
                      setSelected(option.label)
                    }
                    className={`option-row ${
                      selected === option.label
                        ? 'option-selected'
                        : ''
                    }`}
                  >
                    <span
                      className={`radio ${
                        selected === option.label
                          ? 'radio-selected'
                          : ''
                      }`}
                    >
                      {selected === option.label && (
                        <Check size={12} />
                      )}
                    </span>

                    <span>{option.label}</span>
                  </button>
                ))}

                <button
                  onClick={castVote}
                  disabled={voted}
                  className="vote-button mt-4"
                >
                  {voted
                    ? 'Vote recorded'
                    : 'Submit vote'}

                  <ChevronRight size={16} />
                </button>
              </div>
            ) : (
              <div className="space-y-4 pt-5">
                {options.map((option) => {
                  const percentage = total
                    ? Math.round(
                        (option.votes / total) * 100
                      )
                    : 0

                  return (
                    <div key={option.label}>
                      <div className="mb-1.5 flex justify-between text-sm">
                        <span className="text-slate-200">
                          {option.label}
                        </span>

                        <span className="font-medium text-cyan-200">
                          {percentage}%{' '}
                          <span className="text-slate-600">
                            ({option.votes})
                          </span>
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-white/[.08]">
                        <div
                          className={`h-full rounded-full ${option.color} transition-all duration-500`}
                          style={{
                            width: `${percentage}%`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}

                <p className="pt-2 text-center text-xs text-slate-500">
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Results update live as people vote
                </p>
              </div>
            )}

            <div className="mt-7 flex items-center justify-between border-t border-white/[.08] pt-4 text-xs text-slate-500">
              <span>
                {total} total votes
              </span>

              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Updated live
              </span>
            </div>
          </div>

          {/* Share strip */}
          <div className="share-strip">
            <div className="flex items-center gap-3">
              <div className="share-icon">
                <Link2 size={15} />
              </div>

              <div>
                <p className="text-xs font-medium text-slate-300">
                  {poll
                    ? `${window.location.host}?poll=${poll.id}`
                    : 'Create a poll to get a link'}
                </p>

                <p className="text-[11px] text-slate-500">
                  Share with your audience
                </p>
              </div>
            </div>

            <button
              onClick={copyLink}
              aria-label="Copy poll link"
              className="copy-button"
            >
              <Copy size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="relative z-10 border-t border-white/[.07] bg-[#081723]/80 px-6 py-16 lg:px-10"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow">
                The simple way to ask
              </p>

              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                From question to insight.
              </h2>
            </div>

            <p className="max-w-xs text-sm leading-6 text-slate-500">
              Built for classrooms, teams, events, and
              every room where opinions matter.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Feature
              icon={<Sparkles />}
              number="01"
              title="Create"
              text="Write your question, add options, and make it yours."
            />

            <Feature
              icon={<Share2 />}
              number="02"
              title="Share"
              text="Send one simple link. Anyone can join in seconds."
            />

            <Feature
              icon={<BarChart3 />}
              number="03"
              title="See it happen"
              text="Watch responses roll in with live, honest results."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 mx-auto flex max-w-7xl flex-col gap-3 px-6 py-7 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <span>© 2026 Pulsepoll</span>

        <span className="flex items-center gap-2">
          <Gauge size={14} />
          Fast, focused, and built for participation
        </span>
      </footer>

      {/* Authentication Modal */}
      {authOpen && (
        <Modal
          title={
            authMode === 'login'
              ? 'Welcome back'
              : 'Create your account'
          }
          close={() => setAuthOpen(false)}
        >
          <input
            aria-label="Email"
            className="modal-input"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />

          <input
            aria-label="Password"
            className="modal-input"
            type="password"
            placeholder="Password (8+ characters)"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
          />

          <button
            onClick={submitAuth}
            className="vote-button"
          >
            {authMode === 'login'
              ? 'Sign in'
              : 'Sign up'}

            <ChevronRight size={16} />
          </button>

          <button
            onClick={() =>
              setAuthMode(
                authMode === 'login'
                  ? 'signup'
                  : 'login'
              )
            }
            className="text-sm text-cyan-300"
          >
            {authMode === 'login'
              ? 'Need an account? Sign up'
              : 'Already have an account? Sign in'}
          </button>
        </Modal>
      )}

      {/* Create Poll Modal */}
      {createOpen && (
        <Modal
          title="Create a new poll"
          close={() => setCreateOpen(false)}
        >
          <input
            aria-label="Question"
            className="modal-input"
            placeholder="Ask your question"
            value={question}
            onChange={(e) =>
              setQuestion(e.target.value)
            }
          />

          {newOptions.map((value, i) => (
            <input
              key={i}
              aria-label={`Option ${i + 1}`}
              className="modal-input"
              placeholder={`Option ${i + 1}`}
              value={value}
              onChange={(e) =>
                setNewOptions((current) =>
                  current.map(
                    (item, index) =>
                      index === i
                        ? e.target.value
                        : item
                  )
                )
              }
            />
          ))}

          <button
            onClick={() =>
              setNewOptions((current) => [
                ...current,
                '',
              ])
            }
            className="text-left text-sm text-cyan-300"
          >
            + Add option
          </button>

          <button
            onClick={createPoll}
            className="vote-button"
          >
            Create poll
            <ChevronRight size={16} />
          </button>
        </Modal>
      )}
    </main>
  )
}

function pollOptions(
  counts: Record<string, string>,
  labels?: string[]
): Option[] {
  return (labels ?? Object.keys(counts)).map(
    (label, i) => ({
      label,
      votes: Number(counts[label] ?? 0),
      color: colors[i % colors.length],
    })
  )
}

function Modal({
  title,
  close,
  children,
}: {
  title: string
  close: () => void
  children: React.ReactNode
}) {
  return (
    <div className="modal-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        className="modal-card"
      >
        <button
          aria-label="Close"
          onClick={close}
          className="absolute right-5 top-5 text-slate-500 hover:text-white"
        >
          <X size={18} />
        </button>

        <h2 className="text-2xl font-semibold">
          {title}
        </h2>

        <div className="mt-6 space-y-3">
          {children}
        </div>
      </div>
    </div>
  )
}

function Feature({
  icon,
  number,
  title,
  text,
}: {
  icon: React.ReactNode
  number: string
  title: string
  text: string
}) {
  return (
    <article className="feature-card">
      <div className="mb-8 flex items-center justify-between">
        <div className="feature-icon">
          {icon}
        </div>

        <span className="text-xs font-medium tracking-[.18em] text-slate-600">
          {number}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-white">
        {title}
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {text}
      </p>
    </article>
  )
}