import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ organizationName: '', firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(form);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: any) {
      const details = err?.response?.data?.details;
      setError(Array.isArray(details) ? details.map((d: any) => d.msg).join(', ') : err?.response?.data?.message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create your organization</h1>
        <p className="subtitle">You'll be the Super Admin for this workspace</p>
        {success ? (
          <p>Organization created! Redirecting to login...</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Organization name</label>
              <input required value={form.organizationName} onChange={(e) => update('organizationName', e.target.value)} />
            </div>
            <div className="grid grid-cols-2">
              <div className="field">
                <label>First name</label>
                <input required value={form.firstName} onChange={(e) => update('firstName', e.target.value)} />
              </div>
              <div className="field">
                <label>Last name</label>
                <input required value={form.lastName} onChange={(e) => update('lastName', e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" required value={form.password} onChange={(e) => update('password', e.target.value)} />
              <small className="muted">Min 10 characters, upper/lowercase, number, and special character.</small>
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Creating...' : 'Create organization'}
            </button>
          </form>
        )}
        <div className="mt-16" style={{ fontSize: 13 }}>
          <Link to="/login">Already have an account? Sign in</Link>
        </div>
      </div>
    </div>
  );
}
