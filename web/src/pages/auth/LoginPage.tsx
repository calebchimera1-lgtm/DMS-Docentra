import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await login(email, password, organizationSlug || undefined);
      if (result.mfaRequired && result.mfaChallengeToken) {
        navigate('/mfa', { state: { mfaChallengeToken: result.mfaChallengeToken } });
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p className="subtitle">Sign in to your Docentra workspace</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input id="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input id="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="field">
            <label>Organization slug (optional)</label>
            <input value={organizationSlug} onChange={(e) => setOrganizationSlug(e.target.value)} placeholder="docentra-demo" />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <div className="flex-between mt-16" style={{ fontSize: 13 }}>
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/register">Create an organization</Link>
        </div>
      </div>
    </div>
  );
}
