import React, { useState } from 'react';

import { authHeaders } from "../services/api";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';


export default function ActionConsole({ selectedViolation }) {
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // 1. THE VERIFY BUTTON LOGIC
  const handleVerify = async () => {
    if (!selectedViolation) {
      setStatusMessage({ type: 'error', text: '⚠ Select a violation first!' });
      return;
    }

    setStatusMessage({ type: 'info', text: 'Re-fetching page and verifying SHA-256 Hash...' });

    try {
      const response = await fetch(`${API_BASE_URL}/verify/${selectedViolation.id}/`, {
        method: 'POST',
        headers: authHeaders, // <-- This is where the magic happens!
      });

      if (!response.ok) throw new Error("Server rejected the request");

      const result = await response.json();

      setStatusMessage(
        result.verified
          ? { type: 'success', text: `✅ Hash confirmed: ${result.current_hash.substring(0, 10)}...` }
          : { type: 'error', text: `⚠ ${result.note || 'Hash mismatch — evidence may be stale'}` }
      );
    } catch (error) {
      setStatusMessage({ type: 'error', text: '❌ Verification request failed.' });
    }
  };

  // 2. THE ENFORCE (KILL SWITCH) LOGIC
  // 2. THE ENFORCE (KILL SWITCH) LOGIC
  const handleEnforce = async () => {
    if (!selectedViolation) {
      setStatusMessage({ type: 'error', text: '⚠ Select a violation first!' });
      return;
    }

    setIsLoading(true);
    setStatusMessage({ type: 'info', text: '⚖ Drafting Legal Notice via Gemini...' });

    try {
      // FIXED: Now hitting the /enforce/ endpoint
      const response = await fetch(`${API_BASE_URL}/enforce/${selectedViolation.id}/`, {
        method: 'POST',
        headers: authHeaders,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || "Server rejected the request");
      }

      // ---> THE MAGIC HAPPENS HERE <---
      // If the backend returns a success status and a PDF URL, open it in a new tab!
      if (result.status === "success" && result.pdf_url) {
        window.open(result.pdf_url, '_blank');
      }

      setStatusMessage({ type: 'success', text: `✅ ${result.message}` });

    } catch (error) {
      setStatusMessage({ type: 'error', text: `❌ ${error.message}` });
    } finally {
      // Ensure the button stops saying "PROCESSING..." whether it succeeds or fails
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4 bg-zinc-900 border border-zinc-800 rounded-lg">
      <h2 className="text-lg font-semibold text-zinc-100">Action Console</h2>

      {/* Status Message Display */}
      {statusMessage && (
        <div className={`p-2 text-sm rounded ${statusMessage.type === 'error' ? 'bg-red-900/50 text-red-200' :
          statusMessage.type === 'success' ? 'bg-green-900/50 text-green-200' :
            'bg-blue-900/50 text-blue-200'
          }`}>
          {statusMessage.text}
        </div>
      )}

      {/* Selected Asset Info */}
      <div className="text-xs text-zinc-400 mb-2">
        TARGET: {selectedViolation ? selectedViolation.asset_name : 'No Target Selected'}
      </div>

      {/* BUTTON 1: Verify */}
      <button
        onClick={handleVerify}
        disabled={!selectedViolation || isLoading}
        className={`w-full py-2 font-medium rounded transition-colors ${!selectedViolation ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' :
          'bg-zinc-700 hover:bg-zinc-600 text-white'
          }`}
      >
        VERIFY EVIDENCE
      </button>

      {/* BUTTON 2: Enforce */}
      <button
        onClick={handleEnforce}
        disabled={!selectedViolation || isLoading}
        className={`w-full py-2 font-bold rounded transition-colors flex justify-center items-center ${!selectedViolation ? 'bg-red-900/30 text-red-800 cursor-not-allowed' :
          'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]'
          }`}
      >
        {isLoading ? (
          <span className="animate-pulse">PROCESSING...</span>
        ) : (
          "ENFORCE TAKEDOWN"
        )}
      </button>
    </div>
  );
}