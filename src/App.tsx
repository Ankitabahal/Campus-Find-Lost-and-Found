import React, { useEffect, useState } from 'react';
import {
  Search,
  Plus,
  Compass,
  Bell,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
  MapPin,
  CalendarDays,
  ShieldCheck,
  Package,
  Heart,
  Filter,
  CheckCircle2,
  ImagePlus,
  LayoutDashboard,
  ClipboardList,
  Check,
  XCircle,
  Sparkles,
} from 'lucide-react';

const API = ((import.meta as any).env?.VITE_API_URL || '/api').replace(/\/+$/, '');
const ASSET_BASE = (
  (import.meta as any).env?.VITE_ASSET_URL ||
  (API.startsWith('http') ? API.replace(/\/api\/?$/, '') : '')
).replace(/\/+$/, '');

const moneyDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Date not set';

const CATEGORIES = [
  'Electronics',
  'ID Cards',
  'Wallets & Bags',
  'Keys',
  'Books & Stationery',
  'Clothing',
  'Accessories',
  'Other',
];

export default function App() {
  const [token, setToken] = useState<string>(localStorage.getItem('cf_token') || '');
  const [user, setUser] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem('cf_user') || 'null');
    } catch {
      return null;
    }
  });
  const [page, setPage] = useState<string>('home');
  const [items, setItems] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [adminItems, setAdminItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [modal, setModal] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [mobile, setMobile] = useState(false);

  const api = async (path: string, opts: RequestInit = {}) => {
    const headers: Record<string, string> = {
      ...(opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const res = await fetch(API + path, {
      ...opts,
      headers: { ...headers, ...(opts.headers as Record<string, string>) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Something went wrong');
    return data;
  };

  const say = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(''), 3200);
  };

  const refreshItems = async () => {
    try {
      const p = new URLSearchParams();
      if (query) p.set('q', query);
      if (type) p.set('type', type);
      if (category) p.set('category', category);
      setItems(await api('/items?' + p.toString()));
    } catch (e: any) {
      say(e.message);
    }
  };

  const refreshPrivate = async () => {
    if (!token) return;
    try {
      const [n] = await Promise.all([api('/notifications')]);
      setNotifications(n);
    } catch {
      // handled on active views
    }
  };

  useEffect(() => {
    refreshItems();
  }, [query, type, category]);

  useEffect(() => {
    refreshPrivate();
  }, [token]);

  useEffect(() => {
    if (user?.role === 'ADMIN' && token) {
      Promise.all([
        api('/admin/stats'),
        api('/items/admin/all'),
        api('/claims/admin/all'),
        api('/admin/users'),
      ])
        .then(([s, i, c, u]) => {
          setStats(s);
          setAdminItems(i);
          setClaims(c);
          setUsers(u);
        })
        .catch((e) => say(e.message));
    }
  }, [user, token, page]);

  const logout = () => {
    localStorage.removeItem('cf_token');
    localStorage.removeItem('cf_user');
    setToken('');
    setUser(null);
    setPage('home');
    say('You have been logged out.');
  };

  const login = async (form: Record<string, string>) => {
    setBusy(true);
    try {
      const d = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setToken(d.token);
      setUser(d.user);
      localStorage.setItem('cf_token', d.token);
      localStorage.setItem('cf_user', JSON.stringify(d.user));
      setModal('');
      setPage(d.user.role === 'ADMIN' ? 'admin' : 'dashboard');
      say(`Welcome back, ${d.user.full_name.split(' ')[0]}!`);
    } catch (e: any) {
      say(e.message);
    } finally {
      setBusy(false);
    }
  };

  const register = async (form: Record<string, string>) => {
    setBusy(true);
    try {
      const d = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setToken(d.token);
      setUser(d.user);
      localStorage.setItem('cf_token', d.token);
      localStorage.setItem('cf_user', JSON.stringify(d.user));
      setModal('');
      setPage('dashboard');
      say('Account created successfully.');
    } catch (e: any) {
      say(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitItem = async (form: Record<string, any>) => {
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') fd.append(k, v);
      });
      const d = await api('/items', { method: 'POST', body: fd });
      setModal('');
      setPage('browse');
      say(d.message);
      refreshItems();
    } catch (e: any) {
      say(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitClaim = async (item: any) => {
    const proof = window.prompt(
      'Describe a few private details that can prove this item belongs to you:'
    );
    if (!proof) return;
    try {
      const d = await api('/claims', {
        method: 'POST',
        body: JSON.stringify({ item_id: item.item_id, proof_details: proof }),
      });
      say(d.message);
    } catch (e: any) {
      say(e.message);
    }
  };

  const nav: Array<[string, string, any]> = [
    ['home', 'Home', Compass],
    ['browse', 'Browse items', Search],
  ];
  const go = (p: string) => {
    setPage(p);
    setMobile(false);
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => go('home')}>
          <span className="brand-mark">
            <Compass size={21} />
          </span>
          <span>
            campus<span className="brand-accent">find</span>
            <small>LOST &amp; FOUND, RECONNECTED</small>
          </span>
        </button>

        <nav className={mobile ? 'nav open' : 'nav'}>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? 'nav-link active' : 'nav-link'}
              onClick={() => go(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
          {user && (
            <>
              <button
                className={page === 'dashboard' ? 'nav-link active' : 'nav-link'}
                onClick={() => go('dashboard')}
              >
                <LayoutDashboard size={16} />
                My dashboard
              </button>
              {user.role === 'ADMIN' && (
                <button
                  className={page === 'admin' ? 'nav-link active' : 'nav-link'}
                  onClick={() => go('admin')}
                >
                  <ShieldCheck size={16} />
                  Admin
                </button>
              )}
            </>
          )}
        </nav>

        <div className="top-actions">
          {user ? (
            <>
              <button
                className="icon-btn notification-btn"
                onClick={() => go('notifications')}
                aria-label="Notifications"
              >
                <Bell size={19} />
                {notifications.some((n) => !n.is_read) && <i />}
              </button>
              <button
                className="user-chip"
                onClick={() => go(user.role === 'ADMIN' ? 'admin' : 'dashboard')}
              >
                <span className="avatar">{user.full_name?.[0]}</span>
                <span>{user.full_name?.split(' ')[0]}</span>
              </button>
              <button className="icon-btn" onClick={logout} title="Log out">
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <>
              <button className="text-btn" onClick={() => setModal('login')}>
                Log in
              </button>
              <button className="primary small" onClick={() => setModal('register')}>
                Create account <ArrowUpRight size={15} />
              </button>
            </>
          )}
          <button className="icon-btn menu-btn" onClick={() => setMobile(!mobile)}>
            {mobile ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {page === 'home' && (
        <>
          <section className="hero">
            <div className="hero-content">
              <div className="eyebrow">
                <span className="pulse" /> A CAMPUS THAT LOOKS OUT FOR YOU
              </div>
              <h1>
                Lost something?
                <br />
                <em>Let&apos;s bring it</em> back.
              </h1>
              <p className="hero-copy">
                A little help goes a long way. Report what you&apos;ve lost, share what you&apos;ve
                found, and let our campus community reconnect the dots.
              </p>
              <div className="hero-actions">
                <button
                  className="primary"
                  onClick={() => (user ? setModal('report') : setModal('login'))}
                >
                  <Plus size={18} /> Report an item
                </button>
                <button className="secondary" onClick={() => go('browse')}>
                  Explore found items <ArrowUpRight size={17} />
                </button>
              </div>
              <div className="hero-proof">
                <div className="proof-avatars">
                  <b>A</b>
                  <b>R</b>
                  <b>S</b>
                  <b>+</b>
                </div>
                <span>Made for our campus community</span>
              </div>
            </div>

            <div className="hero-art">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="float-card card-top">
                <span className="float-icon mint">
                  <CheckCircle2 />
                </span>
                <div>
                  <b>Found something?</b>
                  <small>Give it a way home.</small>
                </div>
              </div>
              <div className="main-illustration">
                <div className="illustration-glow" />
                <div className="phone">
                  <div className="phone-top">
                    <span />
                    <span />
                  </div>
                  <div className="phone-heading">Your campus board</div>
                  <div className="phone-search">
                    <Search size={12} /> Search items
                  </div>
                  <div className="phone-item">
                    <div className="item-emoji blue">🎧</div>
                    <div>
                      <b>Wireless headphones</b>
                      <small>Library · Today</small>
                    </div>
                    <span className="tiny-tag">FOUND</span>
                  </div>
                  <div className="phone-item">
                    <div className="item-emoji yellow">🔑</div>
                    <div>
                      <b>Keychain with keys</b>
                      <small>Block C · Yesterday</small>
                    </div>
                    <span className="tiny-tag">FOUND</span>
                  </div>
                  <div className="phone-item">
                    <div className="item-emoji pink">💳</div>
                    <div>
                      <b>Student ID card</b>
                      <small>Cafeteria · 2 days ago</small>
                    </div>
                    <span className="tiny-tag">LOST</span>
                  </div>
                  <div className="phone-tab">
                    <span>⌂</span>
                    <span>⌕</span>
                    <span>＋</span>
                    <span>♡</span>
                  </div>
                </div>
              </div>
              <div className="float-card card-bottom">
                <span className="float-icon lavender">
                  <Sparkles />
                </span>
                <div>
                  <b>Possible match!</b>
                  <small>We found a connection.</small>
                </div>
                <span className="match-score">92%</span>
              </div>
            </div>
          </section>

          <section className="stats-strip">
            <div>
              <strong>01</strong>
              <span>One campus community</span>
            </div>
            <div>
              <strong>02</strong>
              <span>Lost &amp; found, together</span>
            </div>
            <div>
              <strong>03</strong>
              <span>Every item has a way home</span>
            </div>
          </section>

          <section className="section how-section">
            <div className="section-heading">
              <div>
                <span className="kicker">A SIMPLE WAY BACK</span>
                <h2>Three steps. One less worry.</h2>
              </div>
              <p>From the moment you notice something missing to the moment it finds its way back.</p>
            </div>
            <div className="steps-grid">
              <article className="step-card">
                <span className="step-num">01</span>
                <div className="step-icon">
                  <ClipboardList />
                </div>
                <h3>Tell us about it</h3>
                <p>
                  Share a few details about the item you&apos;ve lost or found. A photo helps, but
                  it&apos;s optional.
                </p>
              </article>
              <article className="step-card">
                <span className="step-num">02</span>
                <div className="step-icon peach">
                  <Search />
                </div>
                <h3>Find the connection</h3>
                <p>
                  Search campus reports and explore possible matches based on item details, category
                  and location.
                </p>
              </article>
              <article className="step-card">
                <span className="step-num">03</span>
                <div className="step-icon green">
                  <Heart />
                </div>
                <h3>Make it home</h3>
                <p>Submit a claim, let an administrator verify it, and arrange a safe handover.</p>
              </article>
            </div>
          </section>

          <section className="cta-band">
            <div>
              <span className="kicker light">BE THE REASON IT GETS FOUND</span>
              <h2>
                Someone might be looking
                <br />
                for what you&apos;ve found.
              </h2>
              <p>A quick report can make someone&apos;s day.</p>
            </div>
            <button
              className="light-btn"
              onClick={() => (user ? setModal('report') : setModal('register'))}
            >
              Post a report <ArrowUpRight size={17} />
            </button>
          </section>
          <Footer />
        </>
      )}

      {page === 'browse' && (
        <main className="page-wrap">
          <div className="page-title-row">
            <div>
              <span className="kicker">THE CAMPUS BOARD</span>
              <h1>Browse items</h1>
              <p>See what&apos;s been lost, found, and waiting to be reunited.</p>
            </div>
            <button
              className="primary"
              onClick={() => (user ? setModal('report') : setModal('login'))}
            >
              <Plus size={17} /> Report an item
            </button>
          </div>
          <div className="search-panel">
            <div className="search-field">
              <Search size={19} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by item name or details..."
              />
            </div>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All reports</option>
              <option value="LOST">Lost items</option>
              <option value="FOUND">Found items</option>
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>
          <div className="results-line">
            <span>
              {items.length} {items.length === 1 ? 'report' : 'reports'} on the board
            </span>
            <span>
              <Filter size={14} /> Updated as new reports arrive
            </span>
          </div>
          {items.length ? (
            <div className="items-grid">
              {items.map((item) => (
                <ItemCard
                  key={item.item_id}
                  item={item}
                  onClaim={() => (user ? submitClaim(item) : setModal('login'))}
                />
              ))}
            </div>
          ) : (
            <Empty
              title="Nothing here just yet"
              body="Try another search, or be the first to add a report."
              action={() => (user ? setModal('report') : setModal('login'))}
            />
          )}
        </main>
      )}

      {page === 'dashboard' && (
        <Dashboard api={api} user={user} say={say} onReport={() => setModal('report')} />
      )}

      {page === 'notifications' && (
        <main className="page-wrap">
          <div className="page-title-row">
            <div>
              <span className="kicker">YOUR UPDATES</span>
              <h1>Notifications</h1>
              <p>Matches, claims and important changes in one place.</p>
            </div>
          </div>
          <div className="notification-list">
            {notifications.length ? (
              notifications.map((n) => (
                <div
                  className={!n.is_read ? 'notification unread' : 'notification'}
                  key={n.notification_id}
                >
                  <span className="notification-icon">
                    <Bell size={18} />
                  </span>
                  <div>
                    <b>{n.notification_type}</b>
                    <p>{n.message}</p>
                    <small>{moneyDate(n.created_at)}</small>
                  </div>
                  {!n.is_read && (
                    <button
                      className="text-btn"
                      onClick={async () => {
                        await api(`/notifications/${n.notification_id}/read`, { method: 'PATCH' });
                        refreshPrivate();
                      }}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))
            ) : (
              <Empty
                title="You're all caught up"
                body="New matches and claim updates will appear here."
              />
            )}
          </div>
        </main>
      )}

      {page === 'admin' && user?.role === 'ADMIN' && (
        <Admin
          stats={stats}
          items={adminItems}
          claims={claims}
          users={users}
          api={api}
          say={say}
          reload={() => {
            Promise.all([
              api('/admin/stats'),
              api('/items/admin/all'),
              api('/claims/admin/all'),
              api('/admin/users'),
            ])
              .then(([s, i, c, u]) => {
                setStats(s);
                setAdminItems(i);
                setClaims(c);
                setUsers(u);
              })
              .catch((e) => say(e.message));
          }}
        />
      )}

      {modal && (
        <Modal
          title={
            modal === 'login'
              ? 'Welcome back'
              : modal === 'register'
                ? 'Join your campus community'
                : 'Create a report'
          }
          onClose={() => setModal('')}
        >
          {modal === 'login' ? (
            <AuthForm mode="login" submit={login} busy={busy} switchMode={() => setModal('register')} />
          ) : modal === 'register' ? (
            <AuthForm
              mode="register"
              submit={register}
              busy={busy}
              switchMode={() => setModal('login')}
            />
          ) : (
            <ReportForm submit={submitItem} busy={busy} />
          )}
        </Modal>
      )}

      {toast && (
        <div className="toast">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
      <div className="footer-mini">
        CAMPUSFIND <span>·</span> A COMMUNITY-POWERED CAMPUS PROJECT
      </div>
    </div>
  );
}

function ItemCard({ item, onClaim }: { item: any; onClaim: () => void }) {
  const found = item.report_type === 'FOUND';
  const imgSrc = item.image_url
    ? item.image_url.startsWith('http')
      ? item.image_url
      : `${ASSET_BASE}${item.image_url}`
    : '';
  return (
    <article className="item-card">
      <div className="item-image">
        {imgSrc ? (
          <img src={imgSrc} alt={item.item_name} referrerPolicy="no-referrer" />
        ) : (
          <div className="image-placeholder">
            <Package size={34} />
            <span>{item.category}</span>
          </div>
        )}
        <span className={found ? 'status-pill found' : 'status-pill lost'}>
          {found ? 'FOUND' : 'LOST'}
        </span>
      </div>
      <div className="item-info">
        <div className="item-category">{item.category}</div>
        <h3>{item.item_name}</h3>
        <p>{item.description}</p>
        <div className="item-meta">
          <span>
            <MapPin size={14} />
            {item.location}
          </span>
          <span>
            <CalendarDays size={14} />
            {moneyDate(item.item_date)}
          </span>
        </div>
        <div className="item-bottom">
          <small>Posted by {item.reporter_name || 'Campus member'}</small>
          {found && (
            <button className="claim-btn" onClick={onClaim}>
              This is mine <ArrowUpRight size={14} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function AuthForm({
  mode,
  submit,
  busy,
  switchMode,
}: {
  mode: string;
  submit: (f: Record<string, string>) => void;
  busy: boolean;
  switchMode: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const change = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        submit(form);
      }}
    >
      {mode === 'register' && (
        <>
          <label>
            Full name
            <input required name="full_name" onChange={change} placeholder="Your name" />
          </label>
          <div className="form-row">
            <label>
              Username
              <input required name="username" onChange={change} placeholder="Choose a username" />
            </label>
            <label>
              Phone number
              <input name="phone_number" onChange={change} placeholder="Optional" />
            </label>
          </div>
          <label>
            College / Department
            <input name="college_or_department" onChange={change} placeholder="e.g. CSE" />
          </label>
        </>
      )}
      <label>
        Email address
        <input required type="email" name="email" onChange={change} placeholder="you@example.com" />
      </label>
      <label>
        Password
        <input
          required
          type="password"
          minLength={8}
          name="password"
          onChange={change}
          placeholder="At least 8 characters"
        />
      </label>
      <button className="primary full" disabled={busy}>
        {busy ? 'Please wait...' : mode === 'login' ? 'Log in to CampusFind' : 'Create my account'}{' '}
        <ArrowUpRight size={16} />
      </button>
      <p className="switch-auth">
        {mode === 'login' ? 'New to CampusFind?' : 'Already have an account?'}{' '}
        <button type="button" onClick={switchMode}>
          {mode === 'login' ? 'Create an account' : 'Log in'}
        </button>
      </p>
    </form>
  );
}

function ReportForm({ submit, busy }: { submit: (f: Record<string, any>) => void; busy: boolean }) {
  const [form, setForm] = useState<Record<string, any>>({
    report_type: 'LOST',
    item_date: new Date().toISOString().slice(0, 10),
  });
  const change = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const target = e.target as HTMLInputElement;
    setForm({
      ...form,
      [target.name]: target.type === 'file' ? target.files?.[0] : target.value,
    });
  };
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        submit(form);
      }}
    >
      <div className="segmented">
        <button
          type="button"
          className={form.report_type === 'LOST' ? 'selected' : ''}
          onClick={() => setForm({ ...form, report_type: 'LOST' })}
        >
          I lost something
        </button>
        <button
          type="button"
          className={form.report_type === 'FOUND' ? 'selected' : ''}
          onClick={() => setForm({ ...form, report_type: 'FOUND' })}
        >
          I found something
        </button>
      </div>
      <label>
        Item name
        <input
          required
          name="item_name"
          onChange={change}
          placeholder="e.g. Black wireless earbuds"
        />
      </label>
      <div className="form-row">
        <label>
          Category
          <select required name="category" onChange={change} defaultValue="">
            <option value="" disabled>
              Select category
            </option>
            {CATEGORIES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date {form.report_type === 'LOST' ? 'lost' : 'found'}
          <input required type="date" name="item_date" value={form.item_date} onChange={change} />
        </label>
      </div>
      <label>
        Description
        <textarea
          required
          name="description"
          onChange={change}
          rows={3}
          placeholder="Colour, brand, identifying details..."
        />
      </label>
      <label>
        Approximate location
        <input
          required
          name="location"
          onChange={change}
          placeholder="e.g. Central Library, Block C"
        />
      </label>
      <label className="upload-field">
        <ImagePlus size={19} />
        <span>
          <b>Add an item photo</b>
          <small>Optional · JPG, PNG or WEBP · up to 5 MB</small>
        </span>
        <input type="file" name="image" accept="image/png,image/jpeg,image/webp" onChange={change} />
        {form.image && <small>{form.image.name}</small>}
      </label>
      <button className="primary full" disabled={busy}>
        {busy ? 'Publishing...' : 'Publish report'} <ArrowUpRight size={16} />
      </button>
      <small className="privacy-note">
        <ShieldCheck size={13} /> Your contact details are not shown on public item cards.
      </small>
    </form>
  );
}

function Dashboard({
  api,
  user,
  say,
  onReport,
}: {
  api: any;
  user: any;
  say: (s: string) => void;
  onReport: () => void;
}) {
  const [reports, setReports] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  useEffect(() => {
    Promise.all([api('/items/mine'), api('/claims/mine')])
      .then(async ([a, b]) => {
        setReports(a);
        setClaims(b);
        const found = await Promise.all(a.map((x: any) => api(`/items/matches/${x.item_id}`)));
        setMatches(found.flat());
      })
      .catch((e) => say(e.message));
  }, []);
  return (
    <main className="page-wrap">
      <div className="page-title-row">
        <div>
          <span className="kicker">YOUR CAMPUS SPACE</span>
          <h1>Hello, {user?.full_name?.split(' ')[0]}.</h1>
          <p>Here&apos;s what&apos;s happening with your reports and claims.</p>
        </div>
        <button className="primary" onClick={onReport}>
          <Plus size={17} /> New report
        </button>
      </div>
      <div className="dashboard-stats">
        <div>
          <span>My reports</span>
          <b>{reports.length}</b>
          <small>Items you&apos;ve reported</small>
        </div>
        <div>
          <span>My claims</span>
          <b>{claims.length}</b>
          <small>Ownership requests</small>
        </div>
        <div>
          <span>Awaiting review</span>
          <b>{claims.filter((c) => c.claim_status === 'PENDING').length}</b>
          <small>Claims in progress</small>
        </div>
      </div>
      <section className="dash-section">
        <div className="section-title">
          <h2>My item reports</h2>
          <span>{reports.length} total</span>
        </div>
        {reports.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((x) => (
                  <tr key={x.item_id}>
                    <td>
                      <b>{x.item_name}</b>
                      <small>
                        {x.category} · {x.location}
                      </small>
                    </td>
                    <td>{x.report_type}</td>
                    <td>{moneyDate(x.item_date)}</td>
                    <td>
                      <span className="table-status">{x.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Your board starts here"
            body="Add a lost or found report and we'll help look for a match."
            action={onReport}
          />
        )}
      </section>
      <section className="dash-section">
        <div className="section-title">
          <h2>Possible matches</h2>
          <span>{matches.length} suggestions</span>
        </div>
        {matches.length ? (
          <div className="match-list">
            {matches.map((m) => (
              <div className="match-row" key={m.match_id}>
                <span className="match-percent">{Math.round(m.match_score)}%</span>
                <div>
                  <b>
                    {m.lost_name} ↔ {m.found_name}
                  </b>
                  <small>{m.match_reason}</small>
                </div>
                <span className="table-status">Possible match</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">
            No possible matches yet. New reports will be compared automatically.
          </p>
        )}
      </section>
      <section className="dash-section">
        <div className="section-title">
          <h2>My claims</h2>
          <span>{claims.length} total</span>
        </div>
        {claims.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Review note</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c.claim_id}>
                    <td>
                      <b>{c.item_name}</b>
                      <small>{c.location}</small>
                    </td>
                    <td>{moneyDate(c.created_at)}</td>
                    <td>
                      <span className="table-status">{c.claim_status}</span>
                    </td>
                    <td>{c.review_notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">You haven&apos;t submitted any claims yet.</p>
        )}
      </section>
    </main>
  );
}

function Admin({ stats, items, claims, users, api, say, reload }: any) {
  const [tab, setTab] = useState('overview');
  const review = async (id: number, status: string) => {
    try {
      await api(`/claims/admin/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ claim_status: status }),
      });
      say('Claim decision updated.');
      reload();
    } catch (e: any) {
      say(e.message);
    }
  };
  const itemStatus = async (id: number, status: string) => {
    try {
      await api(`/items/admin/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      say('Report updated.');
      reload();
    } catch (e: any) {
      say(e.message);
    }
  };
  return (
    <main className="page-wrap">
      <div className="page-title-row">
        <div>
          <span className="kicker">CONTROL CENTRE</span>
          <h1>Administrator</h1>
          <p>Review reports, verify claims and keep the campus board healthy.</p>
        </div>
        <span className="admin-badge">
          <ShieldCheck size={16} /> ADMIN ACCESS
        </span>
      </div>
      <div className="admin-tabs">
        {[
          ['overview', 'Overview'],
          ['reports', 'Item reports'],
          ['claims', 'Claims'],
          ['users', 'Users'],
        ].map(([k, v]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {v}
          </button>
        ))}
      </div>
      {tab === 'overview' && (
        <>
          <div className="dashboard-stats admin-stats">
            {[
              ['Users', stats?.users],
              ['All reports', stats?.items],
              ['Lost items', stats?.lost],
              ['Found items', stats?.found],
              ['Pending claims', stats?.pendingClaims],
              ['Recovered / closed', stats?.recovered],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <span>{k}</span>
                <b>{v ?? '—'}</b>
                <small>Current total</small>
              </div>
            ))}
          </div>
          <div className="dash-section">
            <div className="section-title">
              <h2>Needs your attention</h2>
            </div>
            <p className="muted">
              {stats?.pendingClaims ?? 0} claim(s) are waiting for review. Open the Claims tab to
              approve, reject or request more information.
            </p>
          </div>
        </>
      )}
      {tab === 'reports' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Reporter</th>
                <th>Type</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i: any) => (
                <tr key={i.item_id}>
                  <td>
                    <b>{i.item_name}</b>
                    <small>
                      {i.category} · {i.location}
                    </small>
                  </td>
                  <td>
                    {i.reporter_name}
                    <small>{i.email}</small>
                  </td>
                  <td>{i.report_type}</td>
                  <td>{i.status}</td>
                  <td className="actions-cell">
                    <button onClick={() => itemStatus(i.item_id, 'PUBLISHED')}>
                      <Check size={14} /> Publish
                    </button>
                    <button onClick={() => itemStatus(i.item_id, 'REJECTED')}>
                      <XCircle size={14} /> Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'claims' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item / Claimant</th>
                <th>Proof details (private)</th>
                <th>Status</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c: any) => (
                <tr key={c.claim_id}>
                  <td>
                    <b>{c.item_name}</b>
                    <small>
                      {c.claimant_name} · {c.email}
                    </small>
                  </td>
                  <td className="proof-cell">{c.proof_details}</td>
                  <td>{c.claim_status}</td>
                  <td className="actions-cell">
                    <button onClick={() => review(c.claim_id, 'APPROVED')}>
                      <Check size={14} /> Approve
                    </button>
                    <button onClick={() => review(c.claim_id, 'MORE_INFO')}>More info</button>
                    <button onClick={() => review(c.claim_id, 'REJECTED')}>
                      <XCircle size={14} /> Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === 'users' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Account</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.user_id}>
                  <td>
                    <b>{u.full_name}</b>
                    <small>@{u.username}</small>
                  </td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.account_status}</td>
                  <td>
                    <button
                      className="table-action"
                      onClick={async () => {
                        try {
                          await api(`/admin/users/${u.user_id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({
                              role: u.role,
                              account_status: u.account_status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE',
                            }),
                          });
                          say('User account updated.');
                          reload();
                        } catch (e: any) {
                          say(e.message);
                        }
                      }}
                    >
                      {u.account_status === 'ACTIVE' ? 'Block' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        <div className="modal-head">
          <div>
            <span className="kicker">CAMPUSFIND</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: () => void;
}) {
  return (
    <div className="empty">
      <span>
        <Package size={25} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action && (
        <button className="secondary" onClick={action}>
          Get started <ArrowUpRight size={15} />
        </button>
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-brand">
        <span className="brand-mark">
          <Compass size={20} />
        </span>
        <b>
          campus<span className="brand-accent">find</span>
        </b>
      </div>
      <p>A little kindness can help something find its way home.</p>
      <small>© 2026 CampusFind · Smart Lost &amp; Found System</small>
    </footer>
  );
}
