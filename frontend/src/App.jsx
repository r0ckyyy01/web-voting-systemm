import { useState, useEffect } from 'react';
import axios from 'axios';

const VOTER_STEPS = ['login', 'ballot', 'confirm', 'done'];

function VoterSteps({ currentStep }) {
  const labels = {
    login: '1. Access code',
    ballot: '2. Ballot',
    confirm: '3. Review',
    done: '4. Done',
  };

  return (
    <ol className="steps">
      {VOTER_STEPS.map((stepKey) => {
        const isActive = currentStep === stepKey;
        const isComplete =
          VOTER_STEPS.indexOf(currentStep) > VOTER_STEPS.indexOf(stepKey);
        const className = [
          'step',
          isActive ? 'active' : '',
          isComplete ? 'complete' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <li key={stepKey} className={className}>
            {labels[stepKey]}
          </li>
        );
      })}
    </ol>
  );
}

function AccessCodeLogin({ onLoggedIn, step }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post(
        '/api/voter/login',
        { accessCode: code.trim() },
        { withCredentials: true }
      );
      onLoggedIn();
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <VoterSteps currentStep={step} />
      <h2>Step 1: Enter your access code</h2>
      <p>
        Enter the code you were given (for example, <code>VOTE-0001</code>). Each
        code can be used exactly once.
      </p>
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="e.g. VOTE-0001"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Checking…' : 'Continue'}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function Ballot({ positions, selections, setSelections, onNext, step }) {
  const handleChange = (positionId, candidateId) => {
    setSelections({ ...selections, [positionId]: candidateId });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form className="card" onSubmit={handleSubmit}>
      <VoterSteps currentStep={step} />
      <h2>Step 2: Complete your ballot</h2>
      <p>Please choose exactly one candidate in each position.</p>
      {positions.map((p) => (
        <div key={p.id} className="position">
          <h3>{p.name}</h3>
          {p.description && <p className="description">{p.description}</p>}
          {p.candidates.map((c) => (
            <label key={c.id} className="candidate">
              <input
                type="radio"
                name={`position-${p.id}`}
                value={c.id}
                checked={selections[p.id] === c.id}
                onChange={() => handleChange(p.id, c.id)}
                required
              />
              <span className="alias">{c.alias}</span>
              <span className="full-name">{c.fullName}</span>
            </label>
          ))}
        </div>
      ))}
      <button type="submit">Review selections</button>
    </form>
  );
}

function Confirm({
  positions,
  selections,
  onBack,
  onSubmit,
  submitting,
  error,
  step,
}) {
  const summary = positions.map((p) => ({
    position: p.name,
    candidate:
      p.candidates.find((c) => c.id === selections[p.id])?.alias || 'No selection',
  }));

  return (
    <div className="card">
      <VoterSteps currentStep={step} />
      <h2>Step 3: Review and confirm</h2>
      <p>Please review your choices. Once submitted, your vote cannot be changed.</p>
      <ul className="summary">
        {summary.map((s, idx) => (
          <li key={idx}>
            <strong>{s.position}:</strong> {s.candidate}
          </li>
        ))}
      </ul>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="button" onClick={onBack} disabled={submitting}>
          Back
        </button>
        <button type="button" onClick={onSubmit} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit ballot'}
        </button>
      </div>
    </div>
  );
}

function ThankYou() {
  return (
    <div className="card">
      <VoterSteps currentStep="done" />
      <h2>Step 4: Thank you</h2>
      <p>Your ballot has been recorded. You may now close this window.</p>
    </div>
  );
}

function AdminLogin({ onLoggedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post(
        '/api/admin/login',
        { username, password },
        { withCredentials: true }
      );
      onLoggedIn();
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h2>Admin Login</h2>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function AdminDashboard() {
  const [results, setResults] = useState([]);
  const [turnout, setTurnout] = useState(null);
  const [logs, setLogs] = useState([]);

  const load = async () => {
    const [resultsRes, turnoutRes, logsRes] = await Promise.all([
      axios.get('/api/admin/results', { withCredentials: true }),
      axios.get('/api/admin/turnout', { withCredentials: true }),
      axios.get('/api/admin/audit-logs', { withCredentials: true }),
    ]);
    setResults(resultsRes.data.positions || []);
    setTurnout(turnoutRes.data);
    setLogs(logsRes.data.logs || []);
  };

  useEffect(() => {
    load().catch((err) => console.error(err));
  }, []);

  const exportCsv = async () => {
    const res = await axios.get('/api/admin/export', {
      withCredentials: true,
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'results.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="card admin">
      <h2>Results Dashboard</h2>
      {turnout && (
        <p>
          Turnout: {turnout.voted} / {turnout.totalVoters} voters (
          {turnout.percentage}% )
        </p>
      )}
      <button onClick={exportCsv}>Export results as CSV</button>

      <h3>Results by position</h3>
      {results.map((p) => (
        <div key={p.id} className="position">
          <h4>{p.name}</h4>
          <ul>
            {p.candidates.map((c) => (
              <li key={c.id}>
                <strong>{c.alias}</strong> ({c.fullName}) — {c.votes} votes
              </li>
            ))}
          </ul>
        </div>
      ))}

      <h3>Audit log (latest 500 events)</h3>
      <div className="audit-log">
        {logs.map((l) => (
          <div key={l.id} className="audit-row">
            <span>{new Date(l.created_at).toLocaleString()}</span>
            <span>{l.actor}</span>
            <span>{l.action}</span>
            <span>{l.details}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState('voter'); // 'voter' | 'admin'
  const [step, setStep] = useState('login'); // login | ballot | confirm | done
  const [positions, setPositions] = useState([]);
  const [selections, setSelections] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);

  useEffect(() => {
    if (step === 'ballot') {
      axios
        .get('/api/voter/ballot', { withCredentials: true })
        .then((res) => setPositions(res.data.positions || []))
        .catch((err) => console.error(err));
    }
  }, [step]);

  const submitBallot = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const votes = positions.map((p) => ({
        positionId: p.id,
        candidateId: selections[p.id],
      }));
      await axios.post(
        '/api/voter/ballot',
        { votes },
        { withCredentials: true }
      );
      setStep('done');
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to submit ballot');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="layout">
      <header>
        <h1>Secure Web Voting System</h1>
        <nav>
          <button
            className={mode === 'voter' ? 'active' : ''}
            onClick={() => {
              setMode('voter');
              setStep('login');
            }}
          >
            Voter
          </button>
          <button
            className={mode === 'admin' ? 'active' : ''}
            onClick={() => setMode('admin')}
          >
            Admin
          </button>
        </nav>
      </header>

      <main>
        {mode === 'voter' && (
          <>
            {step === 'login' && (
              <AccessCodeLogin
                step={step}
                onLoggedIn={() => {
                  setStep('ballot');
                }}
              />
            )}
            {step === 'ballot' && (
              <Ballot
                step={step}
                positions={positions}
                selections={selections}
                setSelections={setSelections}
                onNext={() => setStep('confirm')}
              />
            )}
            {step === 'confirm' && (
              <Confirm
                step={step}
                positions={positions}
                selections={selections}
                onBack={() => setStep('ballot')}
                onSubmit={submitBallot}
                submitting={submitting}
                error={submitError}
              />
            )}
            {step === 'done' && <ThankYou />}
          </>
        )}

        {mode === 'admin' && !adminLoggedIn && (
          <AdminLogin onLoggedIn={() => setAdminLoggedIn(true)} />
        )}
        {mode === 'admin' && adminLoggedIn && <AdminDashboard />}
      </main>
    </div>
  );
}