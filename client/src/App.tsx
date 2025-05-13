import React, { useEffect, useState } from 'react';

interface Fortune {
  id: number;
  text: string;
}

// Get API base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function App() {
  const [fortune, setFortune] = useState<Fortune | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFortune = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/fortunes/random`);
      if (!res.ok) throw new Error('Failed to load fortune');
      setFortune(await res.json());
    } catch (e: any) {
      setError(e.message);
      console.error('Error fetching fortune:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFortune();
  }, []);

  return (
    <div className="app-container">
      <div className="card">
        {loading && <p>Loading…</p>}
        {error && <p className="error">Error: {error}</p>}
        {fortune && <p>{fortune.text}</p>}
      </div>
      <button className="btn" onClick={fetchFortune} disabled={loading}>
        moar fortunes
      </button>
    </div>
  );
}
