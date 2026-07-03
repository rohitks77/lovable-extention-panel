import { useState, useEffect, useCallback } from 'react'
import { supabase, generateKey, calcExpiry, type License, type Plan, type Status } from '../lib/supabase'
import {
  Key, Plus, Copy, Check, Trash2, Power, PowerOff,
  RefreshCw, Search, LogOut, ShieldCheck, Clock,
  Users, Activity, AlertCircle, Globe, Mail, User, FileText, ChevronDown
} from 'lucide-react'

// ── helpers ────────────────────────────────────────────────────────────────
function planLabel(plan: Plan) {
  return { hourly: 'Hourly', daily: 'Daily', monthly: 'Monthly', yearly: 'Yearly', lifetime: 'Lifetime' }[plan]
}

function fmt(date: string | null) {
  if (!date) return '♾ Lifetime'
  return new Date(date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

function isExpired(lic: License): boolean {
  if (lic.plan === 'lifetime') return false
  if (!lic.expires_at) return false
  return new Date(lic.expires_at) < new Date()
}

function statusOf(lic: License): Status {
  if (lic.status === 'inactive') return 'inactive'
  if (isExpired(lic)) return 'expired'
  return 'active'
}

// ── stat card ──────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ fontSize: '1.8rem', fontWeight: 800, lineHeight: 1 }}>{value}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem', fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  )
}

// ── main dashboard ──────────────────────────────────────────────────────────
interface DashboardProps { onLogout: () => void }

export default function Dashboard({ onLogout }: DashboardProps) {
  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [planFilter, setPlanFilter] = useState<string>('all')
  const [copied, setCopied] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  // Form state
  const [form, setForm] = useState({
    domain: '', plan: 'monthly' as Plan,
    customer_name: '', customer_email: '', notes: ''
  })

  const toast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  const fetchLicenses = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    const { data, error } = await supabase.from('licenses').select('*').order('created_at', { ascending: false })
    if (!error && data) setLicenses(data as License[])
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { fetchLicenses() }, [fetchLicenses])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.domain.trim()) { toast('Domain is required!'); return }
    setGenerating(true)
    const key = generateKey()
    const expires_at = calcExpiry(form.plan)
    const { error } = await supabase.from('licenses').insert([{
      key,
      domain: form.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, ''),
      plan: form.plan,
      status: 'active',
      customer_name: form.customer_name,
      customer_email: form.customer_email,
      notes: form.notes,
      expires_at: expires_at ? expires_at.toISOString() : null,
    }])
    if (error) { toast('Error: ' + error.message) }
    else {
      toast(`✅ License generated: ${key}`)
      setForm({ domain: '', plan: 'monthly', customer_name: '', customer_email: '', notes: '' })
      setShowForm(false)
      fetchLicenses(true)
    }
    setGenerating(false)
  }

  const toggleStatus = async (lic: License) => {
    const newStatus = lic.status === 'active' ? 'inactive' : 'active'
    await supabase.from('licenses').update({ status: newStatus }).eq('id', lic.id)
    setLicenses(prev => prev.map(l => l.id === lic.id ? { ...l, status: newStatus } : l))
    toast(`Key ${newStatus === 'active' ? 'activated' : 'deactivated'}`)
  }

  const deleteLicense = async (id: string) => {
    if (!confirm('Delete this license key permanently?')) return
    await supabase.from('licenses').delete().eq('id', id)
    setLicenses(prev => prev.filter(l => l.id !== id))
    toast('License deleted')
  }

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  // Stats
  const total = licenses.length
  const active = licenses.filter(l => statusOf(l) === 'active').length
  const expired = licenses.filter(l => statusOf(l) === 'expired').length
  const inactive = licenses.filter(l => l.status === 'inactive').length

  // Filtered
  const filtered = licenses.filter(l => {
    const s = statusOf(l)
    const matchStatus = statusFilter === 'all' || s === statusFilter
    const matchPlan = planFilter === 'all' || l.plan === planFilter
    const q = search.toLowerCase()
    const matchSearch = !q || l.key.toLowerCase().includes(q) || l.domain.includes(q) ||
      l.customer_name.toLowerCase().includes(q) || l.customer_email.toLowerCase().includes(q)
    return matchStatus && matchPlan && matchSearch
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Toast */}
      {toastMsg && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: 'var(--bg-card2)', border: '1.5px solid var(--border)',
          borderRadius: 10, padding: '0.75rem 1.2rem',
          color: 'var(--text)', fontSize: '0.875rem', fontWeight: 600,
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.25s ease'
        }}>
          {toastMsg}
        </div>
      )}

      {/* Navbar */}
      <nav style={{
        background: 'var(--bg-card)', borderBottom: '1.5px solid var(--border)',
        padding: '0 2rem', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ShieldCheck size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.01em' }}>MeroTools</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '-1px' }}>License Manager</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            className="copy-btn"
            onClick={() => fetchLicenses(true)}
            title="Refresh"
            style={{ padding: '6px' }}
          >
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
          </button>
          <button className="btn-ghost" onClick={onLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </nav>

      <div style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>License Keys</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
              Generate, manage and monitor all MeroTools licenses
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={() => setShowForm(!showForm)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.3rem' }}
          >
            <Plus size={18} /> Generate New Key
          </button>
        </div>

        {/* Stats */}
        <div className="grid-stats" style={{ marginBottom: '1.5rem' }}>
          <StatCard icon={Key} label="Total Keys" value={total} color="#6366f1" />
          <StatCard icon={Activity} label="Active" value={active} color="#10b981" />
          <StatCard icon={AlertCircle} label="Expired" value={expired} color="#ef4444" />
          <StatCard icon={PowerOff} label="Inactive" value={inactive} color="#94a3b8" />
        </div>

        {/* Generate Form */}
        {showForm && (
          <div className="card fade-in" style={{ marginBottom: '1.5rem', borderColor: 'rgba(99,102,241,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={16} color="#a5b4fc" />
              </div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Generate License Key</h2>
            </div>
            <form onSubmit={handleGenerate}>
              <div className="grid-2">
                <div className="form-group">
                  <label><Globe size={11} style={{ display: 'inline', marginRight: 4 }} />Target Domain *</label>
                  <input
                    placeholder="e.g. merotools.shop or 192.168.1.1"
                    value={form.domain}
                    onChange={e => setForm({ ...form, domain: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label><Clock size={11} style={{ display: 'inline', marginRight: 4 }} />License Plan *</label>
                  <select value={form.plan} onChange={e => setForm({ ...form, plan: e.target.value as Plan })}>
                    <option value="hourly">Hourly (1 Hour)</option>
                    <option value="daily">Daily (24 Hours)</option>
                    <option value="monthly">Monthly (1 Month)</option>
                    <option value="yearly">Yearly (1 Year)</option>
                    <option value="lifetime">Lifetime (Never Expires)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label><User size={11} style={{ display: 'inline', marginRight: 4 }} />Customer Name</label>
                  <input
                    placeholder="John Doe"
                    value={form.customer_name}
                    onChange={e => setForm({ ...form, customer_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label><Mail size={11} style={{ display: 'inline', marginRight: 4 }} />Customer Email</label>
                  <input
                    type="email"
                    placeholder="john@example.com"
                    value={form.customer_email}
                    onChange={e => setForm({ ...form, customer_email: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label><FileText size={11} style={{ display: 'inline', marginRight: 4 }} />Notes</label>
                  <input
                    placeholder="e.g. Order #1234 — Paid via eSewa"
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={generating} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 160 }}>
                  {generating ? (
                    <div className="spin" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
                  ) : <Key size={16} />}
                  {generating ? 'Generating...' : 'Generate Key'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                placeholder="Search by key, domain, customer..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: '2rem' }}
              />
            </div>
            <div style={{ position: 'relative' }}>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ paddingRight: '2rem', minWidth: 130 }}>
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="inactive">Inactive</option>
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
            </div>
            <div style={{ position: 'relative' }}>
              <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} style={{ paddingRight: '2rem', minWidth: 130 }}>
                <option value="all">All Plans</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="lifetime">Lifetime</option>
              </select>
              <ChevronDown size={13} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              {filtered.length} of {total} keys
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spin" style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', margin: '0 auto 1rem' }} />
              Loading licenses...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Key size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No license keys found</div>
              <div style={{ fontSize: '0.85rem' }}>Generate your first key using the button above</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>License Key</th>
                    <th>Domain</th>
                    <th>Customer</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Expires At</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(lic => {
                    const s = statusOf(lic)
                    return (
                      <tr key={lic.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span className="key-mono">{lic.key}</span>
                            <button className="copy-btn" onClick={() => copyKey(lic.key)}>
                              {copied === lic.key ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                            </button>
                          </div>
                          {lic.notes && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{lic.notes}</div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Globe size={12} color="var(--text-muted)" />
                            <span style={{ fontSize: '0.85rem' }}>{lic.domain}</span>
                          </div>
                        </td>
                        <td>
                          {lic.customer_name ? (
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{lic.customer_name}</div>
                              {lic.customer_email && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lic.customer_email}</div>}
                            </div>
                          ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>}
                        </td>
                        <td>
                          <span className={`badge badge-${lic.plan}`}>{planLabel(lic.plan)}</span>
                        </td>
                        <td>
                          <span className={`badge badge-${s}`}>
                            {s === 'active' ? '● Active' : s === 'expired' ? '✕ Expired' : '○ Inactive'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.82rem', color: s === 'expired' ? 'var(--danger)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {fmt(lic.expires_at)}
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(lic.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <button
                              className="copy-btn"
                              title={lic.status === 'active' ? 'Deactivate' : 'Activate'}
                              onClick={() => toggleStatus(lic)}
                              style={{ color: lic.status === 'active' ? 'var(--success)' : 'var(--text-muted)', padding: '5px 8px' }}
                            >
                              {lic.status === 'active' ? <Power size={15} /> : <PowerOff size={15} />}
                            </button>
                            <button
                              className="copy-btn btn-danger"
                              title="Delete"
                              onClick={() => deleteLicense(lic.id)}
                              style={{ padding: '5px 8px' }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          MeroTools License Manager · Built with Supabase & React
        </div>
      </div>
    </div>
  )
}
