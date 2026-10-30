'use client';
import { useEffect, useState, type FormEvent } from 'react';
import {
  BookOpen,
  Shield,
  Users,
  ScrollText,
  AudioLines,
  ListChecks,
  Coins,
  Search,
  Settings,
  ArrowUpRight,
  Plus,
  Check,
  X,
  ChevronRight,
  LogOut,
  Feather,
  History,
  FileText,
  Download,
  Flag,
  Menu,
} from 'lucide-react';
type Row = Record<string, any>;
const tabs = [
  ['Overview', BookOpen],
  ['Characters', Users],
  ['Sessions', AudioLines],
  ['Review queue', ListChecks],
  ['Party ledger', Coins],
  ['Reports', ScrollText],
  ['Ask AAR', Search],
  ['Settings & audit', Settings],
] as const;
async function api(url: string, body?: unknown) {
  const r = await fetch(
    '/api/' + url,
    body === undefined
      ? {}
      : body instanceof FormData
        ? { method: 'POST', body }
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
  );
  const d = await r.json();
  if (!r.ok) throw new Error(d.error ?? 'Request failed');
  return d;
}
const time = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) {
  return <span className={'badge ' + tone}>{children}</span>;
}
function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      {label}
      <input {...props} />
    </label>
  );
}
export default function Dashboard({ hosted = false }: { hosted?: boolean }) {
  const [user, setUser] = useState<Row | null>(null),
    [boot, setBoot] = useState(true),
    [campaigns, setCampaigns] = useState<Row[]>([]),
    [cid, setCid] = useState(''),
    [data, setData] = useState<Row | null>(null),
    [tab, setTab] = useState('Overview'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [signup, setSignup] = useState(false),
    [menu, setMenu] = useState(false);
  const [selectedSession, setSelectedSession] = useState(''),
    [checked, setChecked] = useState<string[]>([]),
    [question, setQuestion] = useState(''),
    [answer, setAnswer] = useState<Row | null>(null),
    [imported, setImported] = useState<Row | null>(null),
    [dialog, setDialog] = useState<Row | null>(null),
    [invite, setInvite] = useState(''),
    [jobs, setJobs] = useState<Row[]>([]);
  const dm = data?.role === 'DM';
  const sessions: Row[] = data?.sessions ?? [];
  const sid = selectedSession || sessions[0]?.id;
  const pending: Row[] = (data?.proposals ?? []).filter((p: Row) =>
    ['PENDING_DM', 'NEEDS_CLARIFICATION'].includes(p.state),
  );
  useEffect(() => {
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const modal = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]),select,textarea,a[href]',
        ) ?? [],
      );
    (modal?.querySelector<HTMLElement>('input,textarea,select') ?? focusable()[0])?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDialog(null);
        return;
      }
      if (event.key === 'Tab') {
        const list = focusable();
        const first = list[0],
          last = list.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, [dialog]);
  async function loadCampaigns() {
    const list = await api('campaigns');
    setCampaigns(list);
    setCid((old) => old || list[0]?.id || '');
  }
  async function refresh() {
    if (cid) {
      const d = await api(`campaigns/${cid}`);
      setData(d);
    }
  }
  useEffect(() => {
    api('auth')
      .then((d) => {
        setUser(d.user);
        return loadCampaigns();
      })
      .catch(() => {})
      .finally(() => setBoot(false));
  }, []);
  useEffect(() => {
    if (cid) {
      setData(null);
      setSelectedSession('');
      setAnswer(null);
      refresh().catch((e) => setError(e.message));
    }
  }, [cid]);
  async function run(fn: () => Promise<unknown>, message = 'Saved') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      await refresh();
      setNotice(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }
  function values(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    return Object.fromEntries(new FormData(e.currentTarget));
  }
  const endpoint = (action: string, body?: unknown) => api(`campaigns/${cid}/${action}`, body);
  function evidence(ids: string[]) {
    return (data?.evidence ?? []).filter((e: Row) => ids.includes(e.id));
  }
  function propose(target: Row, kind = 'FACT', compensates?: Row) {
    setDialog({ type: 'proposal', target, kind, compensates });
  }
  function openTab(name: string) {
    setTab(name);
    setMenu(false);
    setNotice('');
    setError('');
  }
  if (boot)
    return (
      <main className="login">
        <Feather size={32} />
        <p>Opening the chronicle…</p>
      </main>
    );
  if (!user)
    return (
      <main className="auth-page">
        <section className="auth-story">
          <div className="wordmark">
            <Feather /> AFTER ACTION REPORT
          </div>
          <p className="eyebrow">YOUR ADVENTURE. REMEMBERED.</p>
          <h1>
            Great stories deserve
            <br />
            <em>a faithful record.</em>
          </h1>
          <p>
            From the first roll to the final battle cry. Keep your party’s history, review what
            happened, and write the next chapter together.
          </p>
          <div className="auth-principles">
            <span>
              <Shield /> Private by design
            </span>
            <span>
              <ListChecks /> Your DM has the final say
            </span>
          </div>
          <small>“A tool, not a bible.” AI suggests. Your table decides.</small>
        </section>
        <section className="auth-form">
          <div className="seal">
            <Feather size={30} />
          </div>
          <h2>{signup ? 'Begin your chronicle' : 'Welcome back, adventurer'}</h2>
          <p>Sign in to your campaign workspace.</p>
          <form
            onSubmit={(e) => {
              const d = values(e);
              run(async () => {
                await api('auth/' + (signup ? 'register' : 'login'), d);
                setUser((await api('auth')).user);
                await loadCampaigns();
              }, 'Signed in');
            }}
          >
            {signup && <Field label="Your name" name="name" required />}
            {signup && hosted && (
              <Field
                label="Private registration code"
                name="registrationCode"
                type="password"
                required
                autoComplete="off"
              />
            )}
            <Field label="Email address" name="email" type="email" required autoComplete="email" />
            <Field
              label="Password"
              name="password"
              type="password"
              minLength={12}
              required
              autoComplete={signup ? 'new-password' : 'current-password'}
            />
            <button className="primary" disabled={busy}>
              {signup ? 'Create account' : 'Enter workspace'} <ArrowUpRight size={16} />
            </button>
          </form>
          <button className="link" onClick={() => setSignup(!signup)}>
            {signup ? 'Already have an account? Sign in' : 'New to AAR? Create an account'}
          </button>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          {!hosted && (
            <aside className="demo-note">
              <strong>Explore the synthetic demo</strong>
              <p>
                DM: dm@aar.local · Player: player@aar.local
                <br />
                Password: Adventure!2026
              </p>
              <small>
                Run the database seed first. These local accounts must never be exposed publicly.
              </small>
            </aside>
          )}
        </section>
      </main>
    );
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={'sidebar ' + (menu ? 'open' : '')}>
        <a className="brand" href="/" aria-label="AAR home">
          <span className="brand-icon">
            <Feather size={24} />
          </span>
          <span>
            AAR<small>AFTER ACTION REPORT</small>
          </span>
        </a>
        <div className="workspace-label">CAMPAIGN WORKSPACE</div>
        <label className="sr-only" htmlFor="campaign">
          Campaign
        </label>
        <select id="campaign" value={cid} onChange={(e) => setCid(e.target.value)}>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <nav aria-label="Main navigation">
          {tabs.map(([name, Icon]) => (
            <button
              key={name}
              className={tab === name ? 'active' : ''}
              onClick={() => openTab(name)}
            >
              <Icon size={18} />
              <span>{name}</span>
              {name === 'Review queue' && pending.length > 0 && <b>{pending.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="private-note">
            <Shield size={17} />
            <div>
              Your table. Your story.<small>Private campaign workspace</small>
            </div>
          </div>
          <button
            className="profile"
            onClick={() =>
              run(async () => {
                await api('auth/logout', {});
                setUser(null);
                setData(null);
                setCid('');
              }, 'Signed out')
            }
          >
            <span className="avatar">{user.name[0]}</span>
            <span>
              {user.name.split(' · ')[0]}
              <small>
                {dm ? 'Game Master' : 'Player'} <LogOut size={12} />
              </small>
            </span>
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            onClick={() => setMenu(!menu)}
            aria-label="Toggle navigation"
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} /> <span>{tab}</span>
          </div>
          <div className="topbar-right">
            <span className="status-dot" /> {busy ? 'Saving…' : 'Private campaign workspace'}{' '}
            <span className="divider" />
            <Badge tone={dm ? 'green' : 'neutral'}>
              {dm ? 'GM workspace' : 'Player workspace'}
            </Badge>
          </div>
        </header>
        <main id="main" className="main">
          <div className="page-heading">
            <div>
              <p className="eyebrow">THE CHRONICLE CONTINUES</p>
              <h1>{tab === 'Overview' ? 'Your next chapter starts here.' : tab}</h1>
              <p>
                {tab === 'Overview'
                  ? 'Less bookkeeping. More adventure. Every moment, kept with care.'
                  : (
                      {
                        Characters: 'The heroes at the heart of your story.',
                        Sessions: 'From a spoken moment to an evidence-backed memory.',
                        'Review queue':
                          'AI observes. Players contribute. You decide what becomes canon.',
                        'Party ledger':
                          'Every change has a source. Every correction leaves a trail.',
                        Reports: 'A shared story, grounded in what actually happened.',
                        'Ask AAR': 'Search only the campaign knowledge available to you.',
                        'Settings & audit':
                          'Clear permissions, honest integrations, complete provenance.',
                      } as Row
                    )[tab]}
              </p>
            </div>
            {dm && (
              <button className="primary" onClick={() => setDialog({ type: 'session' })}>
                <Plus size={16} /> New session
              </button>
            )}
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={() => setError('')} aria-label="Dismiss error">
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <Check size={16} />
              {notice}
            </div>
          )}
          {!cid ? (
            <section className="card empty">
              <BookOpen size={40} />
              <h2>A new adventure awaits</h2>
              <p>Create a campaign or accept a one-time invitation.</p>
              <button className="primary" onClick={() => setDialog({ type: 'campaign' })}>
                Create campaign
              </button>
              <form
                onSubmit={(e) => {
                  const d = values(e);
                  run(async () => {
                    await api('invitations', d);
                    await loadCampaigns();
                  }, 'Invitation accepted');
                }}
              >
                <Field label="Invitation token" name="token" required />
                <button>Join campaign</button>
              </form>
            </section>
          ) : !data ? (
            <p>Loading campaign…</p>
          ) : (
            <>
              {tab === 'Overview' && (
                <>
                  <section className="campaign-hero">
                    <div className="hero-content">
                      <Badge tone="hero">
                        CAMPAIGN CHRONICLE · {data.campaign.ruleset.toUpperCase()}
                      </Badge>
                      <h2>{data.campaign.name}</h2>
                      <p>
                        A living record of your party’s choices, triumphs, and unfinished business.
                      </p>
                      <div className="hero-meta">
                        <span>
                          <Users size={15} />
                          {data.characters.length} characters
                        </span>
                        <span>
                          <AudioLines size={15} />
                          {sessions.length} sessions
                        </span>
                        <span>
                          <Shield size={15} /> Private campaign
                        </span>
                      </div>
                      <button onClick={() => openTab('Sessions')}>
                        Open session journal <ArrowUpRight size={16} />
                      </button>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <div className="sigil">✦</div>
                      <div className="art-caption">
                        ASHES & EMBERS
                        <br />
                        <span>AN ADVENTURE IN THE MAKING</span>
                      </div>
                    </div>
                  </section>
                  <div className="stats">
                    {[
                      [sessions.length, 'Sessions chronicled', AudioLines],
                      [
                        pending.length,
                        dm ? 'Awaiting your review' : 'Pending suggestions',
                        ListChecks,
                      ],
                      [data.characters.length, 'Heroes in the party', Users],
                      [
                        data.reports.filter((r: Row) => r.published).length,
                        'Reports published',
                        ScrollText,
                      ],
                    ].map(([value, label, Icon]: any) => (
                      <div className="stat card" key={label}>
                        <span className="stat-icon">
                          <Icon size={19} />
                        </span>
                        <strong>{value}</strong>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="overview-grid">
                    <section className="card">
                      <div className="section-heading">
                        <h2>Session journal</h2>
                        <button className="link" onClick={() => openTab('Sessions')}>
                          View all <ArrowUpRight size={14} />
                        </button>
                      </div>
                      {sessions.length ? (
                        sessions.slice(0, 3).map((s: Row, i: number) => (
                          <button
                            className="session-row"
                            key={s.id}
                            onClick={() => {
                              setSelectedSession(s.id);
                              openTab('Sessions');
                            }}
                          >
                            <span className="session-number">{String(i + 1).padStart(2, '0')}</span>
                            <span>
                              <strong>{s.title}</strong>
                              <small>
                                {s.synthetic
                                  ? 'Synthetic demo · not a real recording'
                                  : 'Campaign session'}
                              </small>
                            </span>
                            <Badge tone={s.status === 'REVIEW' ? 'amber' : 'neutral'}>
                              {s.status.toLowerCase()}
                            </Badge>
                            <ChevronRight size={16} />
                          </button>
                        ))
                      ) : (
                        <div className="empty">
                          <p>Your first session is waiting to be told.</p>
                        </div>
                      )}
                      <div className="card-foot">
                        <span className="status-dot" /> Evidence first. Embellishment never.
                      </div>
                    </section>
                    <section className="card review-callout">
                      <div className="callout-icon">
                        <ListChecks size={23} />
                      </div>
                      <p className="eyebrow">A TOOL, NOT A BIBLE</p>
                      <h2>
                        Your story.
                        <br />
                        Your final word.
                      </h2>
                      <p>
                        {pending.length
                          ? `${pending.length} suggestions are ready for a closer look.`
                          : 'AI observations stay suggestions until your DM approves them.'}{' '}
                        Nothing changes silently.
                      </p>
                      <button onClick={() => openTab('Review queue')}>
                        Go to review queue <ArrowUpRight size={16} />
                      </button>
                    </section>
                  </div>
                  <section className="card">
                    <div className="section-heading">
                      <h2>The adventuring party</h2>
                      <button className="link" onClick={() => openTab('Characters')}>
                        Meet the party <ArrowUpRight size={14} />
                      </button>
                    </div>
                    <div className="party-preview">
                      {data.characters.map((c: Row, i: number) => (
                        <div key={c.id} className="party-person">
                          <span className={'portrait p' + i}>
                            {c.name
                              .split(' ')
                              .map((n: string) => n[0])
                              .slice(0, 2)
                              .join('')}
                          </span>
                          <div>
                            <strong>{c.name}</strong>
                            <small>{c.class_name}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                  <div className="quiet-footer">
                    <Feather size={15} /> The AI companion that never forgets an adventure.
                  </div>
                </>
              )}
              {tab === 'Characters' && (
                <>
                  <div className="toolbar">
                    <p>
                      PDF imports are proposals. Review fields before updating canon.
                      {hosted ? ' Hosted upload limit: 3 MB.' : ''}
                    </p>
                    {dm && (
                      <button onClick={() => setDialog({ type: 'character' })}>
                        <Plus size={16} /> Add character
                      </button>
                    )}
                    <label className="button">
                      Import PDF
                      <input
                        className="sr-only"
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const form = new FormData();
                            form.set('file', f);
                            run(async () => {
                              setImported(await endpoint('import', form));
                            }, 'PDF parsed — review the fields below');
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="character-grid">
                    {data.characters.map((c: Row, i: number) => (
                      <section className="card character-card" key={c.id}>
                        <span className={'portrait large p' + i}>
                          {c.name
                            .split(' ')
                            .map((n: string) => n[0])
                            .slice(0, 2)
                            .join('')}
                        </span>
                        <Badge>Revision {c.revision}</Badge>
                        <h2>{c.name}</h2>
                        <p>{c.class_name}</p>
                        {Object.entries(c.fields ?? {})
                          .slice(0, 10)
                          .map(([k, v]) => (
                            <div className="resource-row" key={k}>
                              <span>{k}</span>
                              <strong>{String(v)}</strong>
                            </div>
                          ))}
                        <div className="character-resources">
                          {data.resources
                            .filter((r: Row) => r.character_id === c.id)
                            .map((r: Row) => (
                              <div className="resource-row" key={r.id}>
                                <span>{r.name}</span>
                                <strong>{r.balance}</strong>
                              </div>
                            ))}
                        </div>
                        {dm && (
                          <button
                            onClick={() => setDialog({ type: 'resource', characterId: c.id })}
                          >
                            Set up a resource
                          </button>
                        )}
                      </section>
                    ))}
                  </div>
                  {imported && (
                    <section className="card">
                      <h2>Review extracted sheet</h2>
                      {imported.warnings.map((w: string) => (
                        <p key={w}>{w}</p>
                      ))}
                      <pre>{JSON.stringify(imported.fields, null, 2)}</pre>
                      <details>
                        <summary>Visible text preview</summary>
                        <pre>
                          {imported.text || 'No visible text extracted. Enter fields manually.'}
                        </pre>
                      </details>
                      <button
                        onClick={() =>
                          setDialog({
                            type: 'import',
                            fields: imported.fields,
                            documentId: imported.documentId,
                          })
                        }
                      >
                        Review character proposal
                      </button>
                      <p className="muted">
                        The original PDF is stored privately. Download it from the authenticated
                        source endpoint.
                      </p>
                    </section>
                  )}
                </>
              )}
              {tab === 'Sessions' && (
                <>
                  <div className="toolbar">
                    <label>
                      Session{' '}
                      <select
                        value={sid ?? ''}
                        onChange={(e) => setSelectedSession(e.target.value)}
                      >
                        {sessions.map((s: Row) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    {sid && dm && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(
                              () => endpoint('process-demo', { sessionId: sid }),
                              'Synthetic fixture processed. Review proposals before publishing.',
                            )
                          }
                        >
                          Load synthetic demo
                        </button>
                        <button onClick={() => setDialog({ type: 'evidence' })}>
                          Add transcript / note
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(
                              () =>
                                endpoint('extract-transcript', {
                                  sessionId: sid,
                                  visibility: 'PARTY',
                                }),
                              'Party transcript extraction completed. Review exact quotations before approval.',
                            )
                          }
                        >
                          Extract party proposals
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            run(
                              () =>
                                endpoint('extract-transcript', {
                                  sessionId: sid,
                                  visibility: 'DM',
                                }),
                              'GM-only extraction completed. These proposals stay private.',
                            )
                          }
                        >
                          Extract GM-only proposals
                        </button>
                        <small>
                          Extraction sends only the selected visibility scope to the configured
                          model and may incur provider charges. It never spends resources.
                        </small>
                      </>
                    )}
                  </div>
                  {sid ? (
                    <>
                      <section className="card consent-banner">
                        <Shield />
                        <div>
                          <h3>Consent comes before recording</h3>
                          <p>
                            Only upload audio with affirmative consent from every campaign
                            participant. Recording laws vary by jurisdiction. This MVP supports file
                            uploads; live recording is planned.{' '}
                            {hosted && ' Hosted uploads currently support clips up to 3 MB.'}
                          </p>
                          <button
                            disabled={busy}
                            onClick={() =>
                              run(
                                () => endpoint('consent', { sessionId: sid, granted: true }),
                                'Your consent was recorded',
                              )
                            }
                          >
                            I consent to audio processing
                          </button>{' '}
                          <button
                            onClick={() =>
                              run(
                                () => endpoint('consent', { sessionId: sid, granted: false }),
                                'Your consent was withdrawn',
                              )
                            }
                          >
                            Withdraw my consent
                          </button>
                          {dm && (
                            <label className="button">
                              Upload audio
                              <input
                                className="sr-only"
                                type="file"
                                accept="audio/wav,audio/webm,audio/mpeg,audio/mp4"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    const fd = new FormData();
                                    fd.set('file', f);
                                    fd.set('sessionId', sid);
                                    run(
                                      () => endpoint('upload-audio', fd),
                                      'Audio transcribed; review unknown speakers, then choose Extract party proposals',
                                    );
                                  }
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </section>
                      <section className="card">
                        <div className="section-heading">
                          <h2>Transcript & evidence</h2>
                          <Badge>
                            {sessions.find((s) => s.id === sid)?.synthetic
                              ? 'Synthetic fixture'
                              : 'Source records'}
                          </Badge>
                        </div>
                        <div className="timeline">
                          {data.evidence
                            .filter((e: Row) => e.session_id === sid)
                            .map((e: Row) => (
                              <article
                                key={e.id}
                                id={'evidence-' + e.id}
                                className={'transcript ' + (e.visibility === 'DM' ? 'private' : '')}
                              >
                                <span className="timestamp">{time(e.start_ms)}</span>
                                <div>
                                  <div className="transcript-head">
                                    <strong>{e.speaker}</strong>
                                    <Badge tone={e.visibility === 'DM' ? 'amber' : 'neutral'}>
                                      {e.visibility === 'DM' ? 'GM only' : 'Observed'}
                                    </Badge>
                                  </div>
                                  <p>{e.content}</p>
                                  <small>{e.source.replaceAll('_', ' ').toLowerCase()}</small>
                                </div>
                                {dm && (
                                  <button
                                    className="icon-button"
                                    title="Propose a canonical fact"
                                    onClick={() => setDialog({ type: 'fact', evidence: e })}
                                  >
                                    <Plus size={16} />
                                  </button>
                                )}
                              </article>
                            ))}
                        </div>
                        {!data.evidence.some((e: Row) => e.session_id === sid) && (
                          <div className="empty">
                            No evidence yet. Import a synthetic fixture or add a transcript.
                          </div>
                        )}
                      </section>
                    </>
                  ) : (
                    <section className="card empty">
                      <h2>Your journal is open</h2>
                      <p>Create a session to begin collecting evidence.</p>
                    </section>
                  )}
                </>
              )}
              {tab === 'Review queue' && (
                <>
                  <div className="toolbar">
                    <p>
                      <strong>{pending.length}</strong> pending · Changes are atomic and
                      evidence-linked.
                    </p>
                    {dm && (
                      <button
                        className="primary"
                        disabled={!checked.length || busy}
                        onClick={() =>
                          run(async () => {
                            await endpoint('review', { ids: checked, decision: 'APPROVED' });
                            setChecked([]);
                          }, 'Selected proposals approved atomically')
                        }
                      >
                        Approve selected ({checked.length})
                      </button>
                    )}
                  </div>
                  {(data.proposals as Row[]).map((p) => (
                    <section className="card proposal" key={p.id}>
                      <div className="proposal-head">
                        {dm && pending.some((x) => x.id === p.id) && (
                          <input
                            aria-label={'Select proposal ' + p.reason}
                            type="checkbox"
                            checked={checked.includes(p.id)}
                            onChange={(e) =>
                              setChecked(
                                e.target.checked
                                  ? [...checked, p.id]
                                  : checked.filter((x) => x !== p.id),
                              )
                            }
                          />
                        )}
                        <Badge
                          tone={
                            p.state.startsWith('APPROVED')
                              ? 'green'
                              : p.state === 'REJECTED'
                                ? 'neutral'
                                : 'amber'
                          }
                        >
                          {p.state.replaceAll('_', ' ')}
                        </Badge>
                        <Badge>
                          {p.submitted_by_type === 'AI'
                            ? 'AI inference'
                            : p.submitted_by_type === 'PLAYER'
                              ? 'Player claim'
                              : 'DM proposal'}
                        </Badge>
                        {p.visibility === 'DM' && <Badge tone="amber">GM only</Badge>}
                        <small>
                          {p.target_kind.toLowerCase()} · base revision {p.base_revision}
                        </small>
                      </div>
                      <h3>{p.reason}</h3>
                      <div className="diff">
                        <div>
                          <small>CURRENT CANON</small>
                          <p>
                            {p.target_kind === 'RESOURCE'
                              ? (data.resources.find((r: Row) => r.id === p.target_id)?.balance ??
                                '—')
                              : (data.facts.find((f: Row) => f.id === p.target_id)?.content ??
                                'No canonical entry yet')}
                          </p>
                        </div>
                        <div>
                          <small>PROPOSED CHANGE</small>
                          <p>
                            {p.patch.content ??
                              (p.patch.delta !== undefined
                                ? `Resource change: ${p.patch.delta > 0 ? '+' : ''}${p.patch.delta}`
                                : p.patch.name)}
                          </p>
                        </div>
                      </div>
                      <details>
                        <summary>Inspect source evidence ({p.evidence_ids.length})</summary>
                        {(data.extraction_links ?? [])
                          .filter((link: Row) => link.proposal_id === p.id)
                          .map((link: Row) => (
                            <p className="muted" key={link.id}>
                              Exact source characters {link.start_offset}–{link.end_offset} (UTF-16
                              offsets). Speaker identity remains as recorded.
                            </p>
                          ))}
                        {evidence(p.evidence_ids).map((e: Row) => (
                          <blockquote key={e.id}>
                            <strong>
                              {time(e.start_ms)} · {e.speaker}
                            </strong>
                            <p>{e.content}</p>
                          </blockquote>
                        ))}
                      </details>
                      {p.public_reason && (
                        <p className="review-reason">DM response: {p.public_reason}</p>
                      )}
                      {pending.some((x) => x.id === p.id) && (
                        <div className="actions">
                          {dm ? (
                            <>
                              <button
                                className="primary"
                                disabled={busy}
                                onClick={() =>
                                  run(
                                    () => endpoint('review', { ids: [p.id], decision: 'APPROVED' }),
                                    'Proposal approved',
                                  )
                                }
                              >
                                <Check size={15} /> Approve
                              </button>
                              <button onClick={() => setDialog({ type: 'review', proposal: p })}>
                                Edit / decide
                              </button>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  run(
                                    () => endpoint('review', { ids: [p.id], decision: 'REJECTED' }),
                                    'Proposal rejected; canon unchanged',
                                  )
                                }
                              >
                                <X size={15} /> Reject
                              </button>
                            </>
                          ) : p.submitted_by === user.id ? (
                            <button
                              onClick={() =>
                                run(() => endpoint('withdraw', { id: p.id }), 'Proposal withdrawn')
                              }
                            >
                              Retract suggestion
                            </button>
                          ) : (
                            <span className="muted">Awaiting DM review</span>
                          )}
                        </div>
                      )}
                    </section>
                  ))}
                  {!data.proposals.length && (
                    <section className="card empty">
                      <ListChecks size={32} />
                      <h2>A clear review queue</h2>
                      <p>Process a session or flag a published entry to start a conversation.</p>
                    </section>
                  )}
                </>
              )}
              {tab === 'Party ledger' && (
                <>
                  <div className="resource-grid">
                    {data.resources.map((r: Row) => (
                      <section className="card resource-card" key={r.id}>
                        <p className="eyebrow">
                          {data.characters.find((c: Row) => c.id === r.character_id)?.name}
                        </p>
                        <h2>{r.name}</h2>
                        <strong className="balance">{r.balance}</strong>
                        <span className="muted">Current balance · revision {r.revision}</span>
                        <button onClick={() => propose(r, 'RESOURCE')}>
                          <Flag size={14} /> Suggest correction
                        </button>
                      </section>
                    ))}
                  </div>
                  <section className="card">
                    <div className="section-heading">
                      <h2>Immutable transaction history</h2>
                      <Badge>DM-approved only</Badge>
                    </div>
                    {data.ledger_entries.length ? (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Resource</th>
                              <th>Change</th>
                              <th>Balance</th>
                              <th>Reason / provenance</th>
                              <th>Correction</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.ledger_entries.map((l: Row) => (
                              <tr key={l.id}>
                                <td>
                                  {data.resources.find((r: Row) => r.id === l.resource_id)?.name}
                                </td>
                                <td>
                                  {l.delta > 0 ? '+' : ''}
                                  {l.delta}
                                </td>
                                <td>
                                  {l.before_balance} → {l.after_balance}
                                </td>
                                <td>
                                  {l.reason}
                                  <small>
                                    {l.compensates_id ? 'Compensating event' : 'Approved event'} ·{' '}
                                    {l.evidence_ids.length} sources
                                  </small>
                                </td>
                                <td>
                                  <button
                                    onClick={() =>
                                      propose(
                                        data.resources.find((r: Row) => r.id === l.resource_id),
                                        'RESOURCE',
                                        l,
                                      )
                                    }
                                  >
                                    Flag / undo
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="empty">
                        <Coins size={30} />
                        <p>No approved resource changes. Mentioning a spell never spends a slot.</p>
                      </div>
                    )}
                  </section>
                </>
              )}
              {tab === 'Reports' && (
                <>
                  <div className="toolbar">
                    <label>
                      Session{' '}
                      <select
                        value={sid ?? ''}
                        onChange={(e) => setSelectedSession(e.target.value)}
                      >
                        {sessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    {dm && sid && (
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => endpoint('publish', { sessionId: sid }),
                            'New party-safe report revision published in-app',
                          )
                        }
                      >
                        Publish approved facts
                      </button>
                    )}
                  </div>
                  <div className="report-layout">
                    <section className="card report">
                      <p className="eyebrow">THE PARTY CHRONICLE</p>
                      <h2>{sessions.find((s) => s.id === sid)?.title ?? 'After action report'}</h2>
                      <p className="muted">A faithful record. Open to correction.</p>
                      {(() => {
                        const reports = data.reports
                          .filter((r: Row) => r.session_id === sid)
                          .sort((a: Row, b: Row) => b.revision - a.revision);
                        const report = reports[0];
                        return report ? (
                          <>
                            <div className="report-meta">
                              <Badge tone="green">Published · revision {report.revision}</Badge>
                              {report.amended && (
                                <Badge tone="amber">Amended after publication</Badge>
                              )}
                            </div>
                            {report.body.length ? (
                              report.body.map((f: Row) => (
                                <article className="report-entry" key={f.factId}>
                                  <Badge>DM-approved canon</Badge>
                                  <p>{f.content}</p>
                                  <div className="citations">
                                    {evidence(f.evidenceIds).map((e: Row) => (
                                      <button
                                        key={e.id}
                                        className="link"
                                        onClick={() => {
                                          setSelectedSession(sid);
                                          openTab('Sessions');
                                          setTimeout(
                                            () =>
                                              document
                                                .getElementById('evidence-' + e.id)
                                                ?.scrollIntoView({ behavior: 'smooth' }),
                                            100,
                                          );
                                        }}
                                      >
                                        <FileText size={12} />
                                        {time(e.start_ms)} · {e.speaker}
                                      </button>
                                    ))}
                                  </div>
                                  <button
                                    className="link"
                                    onClick={() =>
                                      propose(
                                        data.facts.find((x: Row) => x.id === f.factId) ?? {
                                          id: f.factId,
                                          content: f.content,
                                          revision: f.revision,
                                          evidence_ids: f.evidenceIds,
                                          session_id: sid,
                                        },
                                      )
                                    }
                                  >
                                    <Flag size={13} /> Flag this / suggest correction
                                  </button>
                                </article>
                              ))
                            ) : (
                              <p>No approved party facts were available at publication.</p>
                            )}
                            <details>
                              <summary>Earlier published revisions ({reports.length - 1})</summary>
                              {reports.slice(1).map((r: Row) => (
                                <div key={r.id}>
                                  <h3>Revision {r.revision}</h3>
                                  {r.body.map((f: Row) => (
                                    <p key={f.factId}>{f.content}</p>
                                  ))}
                                </div>
                              ))}
                            </details>
                          </>
                        ) : (
                          <div className="empty">
                            <ScrollText size={32} />
                            <h3>The story is taking shape</h3>
                            <p>
                              Approve evidence-linked facts, then publish your party-safe recap.
                            </p>
                          </div>
                        );
                      })()}
                    </section>
                    <aside className="card report-aside">
                      <Feather size={26} />
                      <h3>Every voice matters.</h3>
                      <p>
                        Spot something that doesn’t match your memory? Flag the entry. Your DM
                        reviews every suggestion.
                      </p>
                      <hr />
                      <p>No email or Discord messages are sent when you publish here.</p>
                      <Badge>In-app delivery</Badge>
                    </aside>
                  </div>
                </>
              )}
              {tab === 'Ask AAR' && (
                <section className="card ask">
                  <div className="seal">
                    <Search />
                  </div>
                  <h2>What does your party remember?</h2>
                  <p>Evidence-linked campaign search. If a fact isn’t known, AAR says so.</p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(
                        async () => setAnswer(await endpoint('ask', { question })),
                        'Search completed',
                      );
                    }}
                  >
                    <label className="sr-only" htmlFor="question">
                      Your question
                    </label>
                    <input
                      id="question"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="What happened to the chaos champion?"
                      required
                      maxLength={1000}
                    />
                    <button className="primary" disabled={busy}>
                      Ask AAR <ArrowUpRight size={16} />
                    </button>
                  </form>
                  {answer && (
                    <div className="answer">
                      <Badge>Accessible campaign records</Badge>
                      <p>{answer.answer}</p>
                      {answer.citations.map((c: Row) => (
                        <div key={c.factId}>
                          {evidence(c.evidenceIds).map((e: Row) => (
                            <blockquote key={e.id}>
                              {time(e.start_ms)} · {e.speaker}: {e.content}
                            </blockquote>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  <small>
                    Lexical retrieval in this MVP. Semantic retrieval and model-generated answers
                    are planned.
                  </small>
                </section>
              )}
              {tab === 'Settings & audit' && (
                <>
                  <div className="settings-grid">
                    <section className="card">
                      <h2>Campaign & access</h2>
                      <p>
                        Members can see party records. Only the DM can review and approve canon.
                      </p>
                      <button onClick={() => setDialog({ type: 'campaign' })}>
                        Create another campaign
                      </button>
                      {dm && (
                        <form
                          onSubmit={(e) => {
                            const d = values(e);
                            run(
                              async () => setInvite((await endpoint('invite', d)).token),
                              'One-time invitation created; no email sent',
                            );
                          }}
                        >
                          <Field
                            label="Invite player by email"
                            name="email"
                            type="email"
                            required
                          />
                          <button>Create invitation</button>
                        </form>
                      )}
                      {invite && (
                        <div className="notice">
                          <code>{invite}</code>
                          <p>Share securely with the invited person.</p>
                        </div>
                      )}
                      <form
                        onSubmit={(e) => {
                          const d = values(e);
                          run(async () => {
                            await api('invitations', d);
                            await loadCampaigns();
                          }, 'Joined campaign');
                        }}
                      >
                        <Field label="Accept invitation token" name="token" required />
                        <button>Join campaign</button>
                      </form>
                    </section>
                    <section className="card">
                      <h2>Integration capabilities</h2>
                      {[
                        ['Character sheets', 'PDF & manual import · review required'],
                        ['Audio', 'Upload supported · provider key required'],
                        ['Processing', 'Labeled synthetic demo available'],
                        [
                          'Transcript extraction',
                          'DM-triggered source quotations · key + extraction model required',
                        ],
                        ['Email / Discord', 'Unconfigured · no messages sent'],
                        ['D&D Beyond', 'PDF export only · no live sync'],
                        ['Foundry / Roll20', 'Planned · no connection claimed'],
                        ['Artwork', 'Planned · DM approval required'],
                      ].map(([name, status]) => (
                        <div className="integration" key={name}>
                          <strong>{name}</strong>
                          <small>{status}</small>
                        </div>
                      ))}
                    </section>
                  </div>
                  <section className="card">
                    <h2>Data & provenance</h2>
                    <p>
                      Local development stores private files on disk. Production encryption,
                      deletion pipelines, malware scanning and retention scheduling require
                      additional deployment work.
                    </p>
                    <button
                      onClick={() =>
                        run(async () => {
                          const content = await endpoint('export');
                          const url = URL.createObjectURL(
                            new Blob([JSON.stringify(content, null, 2)], {
                              type: 'application/json',
                            }),
                          );
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'aar-campaign-export.json';
                          a.click();
                          URL.revokeObjectURL(url);
                        }, 'Authorized campaign export downloaded')
                      }
                    >
                      <Download size={15} /> Export accessible campaign data
                    </button>
                    {dm && (
                      <button
                        onClick={() =>
                          run(async () => setJobs(await endpoint('jobs')), 'Job status loaded')
                        }
                      >
                        Inspect processing jobs
                      </button>
                    )}
                    {jobs.map((j) => (
                      <div className="integration" key={j.id}>
                        <strong>
                          {j.type}: {j.state}
                        </strong>
                        <small>
                          {j.error ?? 'No error'} · attempts {j.attempts}
                        </small>
                        {j.state === 'FAILED' && (
                          <button
                            onClick={() =>
                              run(() => endpoint('retry-job', { id: j.id }), 'Job retried')
                            }
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    ))}
                  </section>
                  {dm && (
                    <section className="card">
                      <h2>Audit trail</h2>
                      {data.audit.length ? (
                        data.audit.map((a: Row) => (
                          <div className="audit" key={a.id}>
                            <History size={15} />
                            <strong>{a.kind.replaceAll('_', ' ')}</strong>
                            <small>{new Date(a.created_at).toLocaleString()}</small>
                          </div>
                        ))
                      ) : (
                        <p className="muted">Review and publication decisions will appear here.</p>
                      )}
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </main>
        <footer>
          AAR <span>·</span> Built for the stories you tell together.
        </footer>
      </div>
      {dialog && (
        <div className="modal-backdrop" onClick={() => setDialog(null)}>
          <section
            className="modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close icon-button"
              aria-label="Close dialog"
              onClick={() => setDialog(null)}
            >
              <X />
            </button>
            <h2 id="dialog-title">
              {
                (
                  {
                    session: 'Start a session',
                    campaign: 'Create a campaign',
                    character: 'Add a hero',
                    resource: 'Set up a resource',
                    evidence: 'Add source evidence',
                    fact: 'Propose a canonical fact',
                    proposal: 'Suggest a correction',
                    review: 'Review proposal',
                    import: 'Review imported character',
                  } as Row
                )[dialog.type]
              }
            </h2>
            <form
              onSubmit={(e) => {
                const d = values(e);
                run(async () => {
                  if (dialog.type === 'campaign') {
                    const created = await api('campaigns', { name: d.name, ruleset: d.ruleset });
                    await loadCampaigns();
                    setCid(created.id);
                  }
                  if (dialog.type === 'session') await endpoint('sessions', { title: d.title });
                  if (dialog.type === 'character')
                    await endpoint('characters', { name: d.name, className: d.className });
                  if (dialog.type === 'resource')
                    await endpoint('resources', {
                      characterId: dialog.characterId,
                      name: d.name,
                      balance: Number(d.balance),
                    });
                  if (dialog.type === 'evidence')
                    await endpoint('evidence', {
                      sessionId: sid,
                      content: d.content,
                      speaker: d.speaker,
                      startMs: Number(d.seconds) * 1000,
                      visibility: d.visibility,
                    });
                  if (dialog.type === 'fact')
                    await endpoint('proposals', {
                      sessionId: sid,
                      targetKind: 'FACT',
                      visibility: dialog.evidence.visibility,
                      patch: { content: d.content, kind: d.kind },
                      reason: d.reason,
                      evidenceIds: [dialog.evidence.id],
                      baseRevision: 0,
                    });
                  if (dialog.type === 'proposal') {
                    const target = dialog.target;
                    await endpoint('proposals', {
                      sessionId: target.session_id ?? sid,
                      targetKind: dialog.kind,
                      targetId: target.id,
                      visibility: target.visibility ?? 'PARTY',
                      patch:
                        dialog.kind === 'RESOURCE'
                          ? {
                              delta: Number(d.delta),
                              ...(dialog.compensates
                                ? { compensatesId: dialog.compensates.id }
                                : {}),
                            }
                          : { content: d.content, kind: target.kind ?? 'EVENT' },
                      reason: d.reason,
                      evidenceIds: target.evidence_ids ?? (d.evidenceId ? [d.evidenceId] : []),
                      baseRevision: target.revision,
                    });
                  }
                  if (dialog.type === 'review') {
                    const p = dialog.proposal;
                    await endpoint('review', {
                      ids: [p.id],
                      decision: d.decision,
                      publicReason: d.publicReason,
                      privateReason: d.privateReason,
                      ...(d.decision === 'APPROVED'
                        ? {
                            patch:
                              p.target_kind === 'RESOURCE'
                                ? { ...p.patch, delta: Number(d.delta) }
                                : p.target_kind === 'FACT'
                                  ? { ...p.patch, content: d.content }
                                  : p.patch,
                          }
                        : {}),
                    });
                  }
                  if (dialog.type === 'import') {
                    if (!sid) throw new Error('Create a session to associate import provenance');
                    const target = data?.characters.find((c: Row) => c.id === d.targetId);
                    await endpoint('import-proposal', {
                      documentId: dialog.documentId,
                      sessionId: sid,
                      ...(target ? { targetId: target.id } : {}),
                      baseRevision: target?.revision ?? 0,
                      patch: {
                        name: d.name,
                        className: d.className,
                        fields: JSON.parse(String(d.fields)),
                      },
                    });
                  }
                  setDialog(null);
                }, 'Saved. Canonical changes require DM approval where applicable.');
              }}
            >
              {dialog.type === 'campaign' && (
                <>
                  <Field label="Campaign name" name="name" required />
                  <label className="field">
                    Ruleset
                    <select name="ruleset">
                      <option value="5e-2014">D&D 5e · 2014</option>
                      <option value="5e-2024">D&D 5e · 2024</option>
                      <option value="generic">System agnostic</option>
                    </select>
                  </label>
                </>
              )}
              {dialog.type === 'session' && <Field label="Session title" name="title" required />}
              {['character', 'import'].includes(dialog.type) && (
                <>
                  <Field
                    label="Character name"
                    name="name"
                    defaultValue={dialog.fields?.CharacterName ?? ''}
                    required
                  />
                  <Field
                    label="Class / identity"
                    name="className"
                    defaultValue={dialog.fields?.ClassLevel ?? ''}
                    required
                  />
                </>
              )}
              {dialog.type === 'import' && (
                <>
                  <label className="field">
                    Import destination
                    <select name="targetId">
                      <option value="">New character</option>
                      {data?.characters
                        .filter((c: Row) => dm || c.owner_id === user.id)
                        .map((c: Row) => (
                          <option value={c.id} key={c.id}>
                            {c.name} · revision {c.revision}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    Fields to share with the party (JSON)
                    <textarea
                      name="fields"
                      defaultValue={JSON.stringify(dialog.fields, null, 2)}
                      required
                    />
                  </label>
                  <p className="muted">
                    Only submit fields you want to share with your campaign. Remove private details.
                    Re-import proposes a revision; it never overwrites the sheet silently.
                  </p>
                </>
              )}
              {dialog.type === 'resource' && (
                <>
                  <Field
                    label="Resource name (include level / unit)"
                    name="name"
                    placeholder="Level 3 spell slots"
                    required
                  />
                  <Field
                    label="Initial observed balance"
                    name="balance"
                    type="number"
                    min="0"
                    required
                  />
                </>
              )}
              {dialog.type === 'evidence' && (
                <>
                  <Field label="Speaker / source" name="speaker" required />
                  <Field
                    label="Position in seconds"
                    name="seconds"
                    type="number"
                    min="0"
                    defaultValue="0"
                  />
                  <label className="field">
                    Visibility
                    <select name="visibility">
                      <option>PARTY</option>
                      <option>DM</option>
                    </select>
                  </label>
                  <label className="field">
                    Source text
                    <textarea name="content" required maxLength={10000} />
                  </label>
                </>
              )}
              {dialog.type === 'fact' && (
                <>
                  <blockquote>{dialog.evidence.content}</blockquote>
                  <label className="field">
                    Proposed fact
                    <textarea name="content" defaultValue={dialog.evidence.content} required />
                  </label>
                  <label className="field">
                    Category
                    <select name="kind">
                      {['EVENT', 'LOOT', 'QUEST', 'QUOTE', 'LORE'].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </label>
                  <Field label="Why should this become canon?" name="reason" required />
                </>
              )}
              {dialog.type === 'proposal' && (
                <>
                  <p className="muted">
                    Your suggestion goes to the DM. It does not overwrite the original record.
                  </p>
                  {dialog.kind === 'RESOURCE' ? (
                    <>
                      <Field
                        label="Proposed resource change (+ refund / − spend)"
                        name="delta"
                        type="number"
                        defaultValue={dialog.compensates ? -dialog.compensates.delta : 0}
                        required
                      />
                      {!dialog.target.evidence_ids && (
                        <label className="field">
                          Supporting evidence
                          <select name="evidenceId" required>
                            <option value="">Choose a source</option>
                            {data?.evidence
                              .filter((e: Row) => e.visibility === 'PARTY')
                              .map((e: Row) => (
                                <option value={e.id} key={e.id}>
                                  {time(e.start_ms)} · {e.content.slice(0, 60)}
                                </option>
                              ))}
                          </select>
                        </label>
                      )}
                    </>
                  ) : (
                    <label className="field">
                      Suggested correction
                      <textarea name="content" defaultValue={dialog.target.content} required />
                    </label>
                  )}
                  <label className="field">
                    Reason
                    <textarea name="reason" required />
                  </label>
                </>
              )}
              {dialog.type === 'review' && (
                <>
                  <label className="field">
                    Decision
                    <select name="decision">
                      <option value="APPROVED">Edit and approve</option>
                      <option value="REJECTED">Reject</option>
                      <option value="NEEDS_CLARIFICATION">Request clarification</option>
                    </select>
                  </label>
                  {dialog.proposal.target_kind === 'RESOURCE' ? (
                    <Field
                      label="Accepted resource change"
                      type="number"
                      name="delta"
                      defaultValue={dialog.proposal.patch.delta}
                    />
                  ) : (
                    <label className="field">
                      Accepted wording
                      <textarea
                        name="content"
                        defaultValue={
                          dialog.proposal.patch.content ?? JSON.stringify(dialog.proposal.patch)
                        }
                      />
                    </label>
                  )}
                  <label className="field">
                    Response visible to submitter
                    <textarea name="publicReason" />
                  </label>
                  <label className="field">
                    Private GM rationale
                    <textarea name="privateReason" />
                  </label>
                </>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="actions">
                <button type="button" onClick={() => setDialog(null)}>
                  Cancel
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
