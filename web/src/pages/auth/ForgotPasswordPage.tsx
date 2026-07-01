import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
    } finally {
      setSent(true);
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Forgot password</h1>
        <p className="subtitle">We'll email you a reset link if the account exists</p>
        {sent ? (
          <p>If an account exists for that email, a reset link has been sent.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}
        <div className="mt-16" style={{ fontSize: 13 }}>
          <Link to="/login">Back to login</Link>
        </div>
      </div>
    </div>
  );
}
