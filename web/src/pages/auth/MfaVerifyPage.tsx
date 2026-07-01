import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';

export default function MfaVerifyPage() {
  const { verifyMfa } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const mfaChallengeToken = (location.state as { mfaChallengeToken?: string })?.mfaChallengeToken;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!mfaChallengeToken) {
    navigate('/login');
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyMfa(mfaChallengeToken!, code);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Invalid code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Two-factor verification</h1>
        <p className="subtitle">Enter the 6-digit code from your authenticator app, or a backup code</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Verification code</label>
            <input required autoFocus value={code} onChange={(e) => setCode(e.target.value)} maxLength={10} />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      </div>
    </div>
  );
}
