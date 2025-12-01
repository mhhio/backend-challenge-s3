"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";

const PRESET_EVENTS = [
    { label: "🔐 Login", payload: { action: "login", user: "demo_user", method: "oauth" } },
    { label: "🚪 Logout", payload: { action: "logout", duration_seconds: 3600 } },
    { label: "🖱️ Click", payload: { action: "click", element: "button", x: 150, y: 200 } },
    { label: "📄 Page View", payload: { action: "page_view", path: "/dashboard", referrer: "/home" } },
    { label: "❌ Error", payload: { action: "error", code: 500, message: "Internal Server Error" } },
    { label: "🛒 Add to Cart", payload: { action: "add_to_cart", product_id: "ABC123", quantity: 2 } },
];

export default function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newEventData, setNewEventData] = useState("");

    useEffect(() => {
        fetchEvents();
    }, [id]);

    const fetchEvents = async () => {
        try {
            const res = await fetch(`http://localhost:8000/sessions/${id}/events`);
            if (res.ok) {
                const data = await res.json();
                setEvents(data);
            }
        } catch (error) {
            console.error("Failed to fetch events", error);
        } finally {
            setLoading(false);
        }
    };

    const sendEvent = async (payload?: any) => {
        try {
            const eventPayload = payload || (newEventData ? JSON.parse(newEventData) : { action: "ping" });
            await fetch("http://localhost:8000/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: id,
                    payload: eventPayload,
                }),
            });
            setNewEventData("");
            fetchEvents();
        } catch (error) {
            alert("Invalid JSON or Server Error");
        }
    };

    return (
        <main className="min-h-screen p-8 bg-gray-50 text-gray-900 font-sans">
            <div className="max-w-5xl mx-auto">
                <Link
                    href="/"
                    className="inline-flex items-center text-gray-500 hover:text-blue-600 mb-8 transition-colors"
                >
                    ← Back to Sessions
                </Link>

                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Session: {id}</h1>
                    <p className="text-gray-500">Event Stream</p>
                </header>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Event Simulator */}
                    <div className="lg:col-span-1 space-y-4">
                        {/* Quick Actions */}
                        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
                            <h2 className="text-lg font-semibold mb-4 text-gray-800">Quick Actions</h2>
                            <div className="grid grid-cols-2 gap-2">
                                {PRESET_EVENTS.map((preset, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => sendEvent(preset.payload)}
                                        className="px-3 py-2 bg-gradient-to-br from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-gray-700 text-sm font-medium rounded-lg transition-all border border-blue-200 hover:border-blue-300 hover:shadow-md"
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Event */}
                        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 sticky top-8">
                            <h2 className="text-lg font-semibold mb-4 text-gray-800">Custom Event</h2>
                            <textarea
                                value={newEventData}
                                onChange={(e) => setNewEventData(e.target.value)}
                                placeholder='{"action": "custom", "data": "value"}'
                                className="w-full h-32 p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono text-sm mb-4 resize-none"
                            />
                            <button
                                onClick={() => sendEvent()}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-indigo-200"
                            >
                                Send Custom
                            </button>
                        </div>
                    </div>

                    {/* Event Feed */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                <h2 className="font-semibold text-gray-700">Event Log</h2>
                                <span className="text-sm text-gray-500">{events.length} events</span>
                            </div>

                            {loading ? (
                                <div className="p-12 text-center text-gray-500">Loading events...</div>
                            ) : events.length === 0 ? (
                                <div className="p-12 text-center text-gray-400 italic">No events recorded yet.</div>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {events.map((event, idx) => (
                                        <div key={idx} className="p-5 hover:bg-gray-50 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-mono text-gray-400">
                                                    {new Date(event.timestamp).toLocaleString()}
                                                </span>
                                                <span className="text-xs font-mono bg-blue-50 text-blue-600 px-2 py-1 rounded-md">
                                                    ID: {event.id.slice(0, 8)}...
                                                </span>
                                            </div>
                                            <pre className="text-sm text-gray-700 font-mono overflow-x-auto whitespace-pre-wrap">
                                                {JSON.stringify(event, null, 2)}
                                            </pre>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
