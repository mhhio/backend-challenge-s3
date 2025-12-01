"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function Home() {
  const [sessions, setSessions] = useState<string[]>([]);
  const [newSessionId, setNewSessionId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch("http://localhost:8000/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (error) {
      console.error("Failed to fetch sessions", error);
    } finally {
      setLoading(false);
    }
  };

  const createSession = async () => {
    if (!newSessionId) return;
    try {
      await fetch("http://localhost:8000/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: newSessionId,
          payload: { message: "Session Started" },
        }),
      });
      setNewSessionId("");
      fetchSessions();
    } catch (error) {
      console.error("Failed to create session", error);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50 text-gray-900 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-2">
            S3 Event Logger
          </h1>
          <p className="text-gray-600">Serverless Session Management</p>
        </header>

        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-100">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Start New Session</h2>
          <div className="flex gap-4">
            <input
              type="text"
              value={newSessionId}
              onChange={(e) => setNewSessionId(e.target.value)}
              placeholder="Enter Session ID (e.g., user-123)"
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
            <button
              onClick={createSession}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-blue-200"
            >
              Create
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Active Sessions</h2>
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300 text-gray-500">
              No sessions found. Start one above!
            </div>
          ) : (
            <div className="grid gap-3">
              {sessions.map((session) => (
                <Link
                  key={session}
                  href={`/sessions/${session}`}
                  className="block group"
                >
                  <div className="bg-white p-5 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all flex justify-between items-center">
                    <span className="font-medium text-gray-700 group-hover:text-blue-600 transition-colors">
                      {session}
                    </span>
                    <span className="text-gray-400 group-hover:translate-x-1 transition-transform">
                      →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
