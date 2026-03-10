'use client';

import { useState } from 'react';

interface ApiKeyModalProps {
  onSave: (key: string) => void;
  onDemo: () => void;
  initialKey?: string;
}

export function ApiKeyModal({ onSave, onDemo, initialKey = '' }: ApiKeyModalProps) {
  const [key, setKey] = useState(initialKey);
  const [error, setError] = useState('');

  const handleSave = () => {
    const trimmed = key.trim();
    if (!trimmed) {
      setError('Please enter an API key or try demo mode.');
      return;
    }
    onSave(trimmed);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-xl">
              🚢
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Ship Visualizer</h2>
              <p className="text-gray-400 text-sm">Real-time maritime tracking</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-gray-300 text-sm mb-4">
            Connect to <strong className="text-white">aisstream.io</strong> for live AIS ship data,
            or try the demo mode to explore with simulated vessels.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1.5">
                aisstream.io API Key
              </label>
              <input
                type="text"
                value={key}
                onChange={(e) => { setKey(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="Paste your API key here…"
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2.5 text-white text-sm
                  placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50
                  font-mono"
                autoFocus
              />
              {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
            </div>

            <a
              href="https://aisstream.io"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Get a free API key at aisstream.io
            </a>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 pb-6 flex flex-col gap-2.5">
          <button
            onClick={handleSave}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl
              transition-colors text-sm"
          >
            Connect to Live Data
          </button>
          <button
            onClick={onDemo}
            className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300
              hover:text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
          >
            Try Demo Mode (simulated ships)
          </button>
        </div>
      </div>
    </div>
  );
}
