'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const [values, setValues] = useState({ username: '', password: '' });
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to sign in.');
      router.push('/admin');
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-body">
      <section className="auth-card">
        <Link className="brand" href="/"><span className="brand-mark">C</span><span>CabConnect<small>OPERATIONS</small></span></Link>
        <div className="eyebrow">WELCOME BACK</div>
        <h1>Sign in to your workspace</h1>
        <p className="muted">Manage trips, vehicles and customer inquiries.</p>
        <form className="stack" onSubmit={submit}>
          <label>Username<input autoComplete="username" value={values.username} onChange={event => setValues(current => ({ ...current, username: event.target.value }))} required /></label>
          <label>Password
            <div className="password-control">
              <input type={visible ? 'text' : 'password'} autoComplete="current-password" value={values.password} onChange={event => setValues(current => ({ ...current, password: event.target.value }))} required />
              <button className="password-toggle" type="button" aria-label={`${visible ? 'Hide' : 'Show'} password`} aria-pressed={visible} onClick={() => setVisible(current => !current)}>{visible ? 'Hide' : 'Show'}</button>
            </div>
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn btn-primary full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in →'}</button>
        </form>
        <Link className="back-link" href="/">← Back to website</Link>
      </section>
    </main>
  );
}
