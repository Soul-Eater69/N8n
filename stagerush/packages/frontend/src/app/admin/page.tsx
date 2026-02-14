'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3, Calendar, Users, DollarSign, Plus, Eye,
  TrendingUp, Ticket, MapPin, ArrowRight, RefreshCw,
  CheckCircle, XCircle, Clock, Zap, Activity,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatPrice, formatDate, formatRelativeTime, cn, getStatusColor } from '@/lib/utils';
import { IEvent } from '@stagerush/shared';

export default function AdminDashboard() {
  const router = useRouter();
  const [events, setEvents] = useState<IEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showCreateVenue, setShowCreateVenue] = useState(false);
  const [eventForm, setEventForm] = useState({
    name: '', artist: '', description: '', venueId: '', date: '',
    doorsOpen: '', showTime: '', saleStartsAt: '',
  });
  const [venueForm, setVenueForm] = useState({
    name: '', city: '', country: '', sections: [
      { name: 'VIP', code: 'VIP', category: 'vip', priceCents: 35000, rows: 5, seatsPerRow: 20, color: '#f59e0b' },
      { name: 'Premium', code: 'PREM', category: 'premium', priceCents: 22000, rows: 10, seatsPerRow: 30, color: '#8b5cf6' },
      { name: 'Standard', code: 'STD', category: 'standard', priceCents: 12000, rows: 20, seatsPerRow: 40, color: '#3b82f6' },
      { name: 'Economy', code: 'ECO', category: 'economy', priceCents: 6500, rows: 15, seatsPerRow: 50, color: '#10b981' },
    ],
  });

  useEffect(() => { loadEvents(); }, []);

  async function loadEvents() {
    try {
      const res = await api.get<any>('/events?limit=50');
      setEvents(res.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function createVenue() {
    try {
      const res = await api.post<any>('/admin/venues', {
        name: venueForm.name,
        city: venueForm.city,
        country: venueForm.country,
        capacity: venueForm.sections.reduce((sum, s) => sum + s.rows * s.seatsPerRow, 0),
        sections: venueForm.sections.map((s) => ({
          name: s.name, code: s.code, category: s.category, priceCents: s.priceCents,
          color: s.color, rowCount: s.rows, seatsPerRow: s.seatsPerRow,
        })),
      });
      if (res.success) {
        alert(`Venue created! ID: ${res.data.id}`);
        setShowCreateVenue(false);
      }
    } catch (err: any) { alert(err.message); }
  }

  async function createEvent() {
    try {
      const res = await api.post<any>('/admin/events', eventForm);
      if (res.success) {
        await api.post(`/admin/events/${res.data.id}/generate-seats`);
        await loadEvents();
        setShowCreateEvent(false);
        alert('Event created with seats generated!');
      }
    } catch (err: any) { alert(err.message); }
  }

  async function publishEvent(id: string) {
    try {
      await api.post(`/admin/events/${id}/publish`);
      loadEvents();
    } catch (err: any) { alert(err.message); }
  }

  const totalSeats = events.reduce((s, e) => s + e.totalSeats, 0);
  const totalSold = events.reduce((s, e) => s + e.soldSeats, 0);
  const activeEvents = events.filter((e) => ['on_sale', 'published'].includes(e.status)).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-brand-600 flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">StageRush Admin</h1>
              <p className="text-xs text-gray-500">Event Management Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCreateVenue(true)} className="btn-secondary text-sm">
              <MapPin size={16} className="mr-1.5" /> New Venue
            </button>
            <button onClick={() => setShowCreateEvent(true)} className="btn-primary text-sm">
              <Plus size={16} className="mr-1.5" /> New Event
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Events', value: events.length, icon: Calendar, color: 'text-brand-600 bg-brand-50' },
            { label: 'Active Events', value: activeEvents, icon: Activity, color: 'text-green-600 bg-green-50' },
            { label: 'Total Seats', value: totalSeats.toLocaleString(), icon: Users, color: 'text-purple-600 bg-purple-50' },
            { label: 'Tickets Sold', value: totalSold.toLocaleString(), icon: Ticket, color: 'text-orange-600 bg-orange-50' },
          ].map((s) => (
            <div key={s.label} className="card flex items-center gap-4">
              <div className={cn('p-3 rounded-xl', s.color)}><s.icon size={22} /></div>
              <div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-sm text-gray-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Create Venue Modal */}
        {showCreateVenue && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create Venue</h2>
              <button onClick={() => setShowCreateVenue(false)} className="text-gray-400 hover:text-gray-600">X</button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <input className="input-field" placeholder="Venue Name" value={venueForm.name} onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })} />
              <input className="input-field" placeholder="City" value={venueForm.city} onChange={(e) => setVenueForm({ ...venueForm, city: e.target.value })} />
              <input className="input-field" placeholder="Country" value={venueForm.country} onChange={(e) => setVenueForm({ ...venueForm, country: e.target.value })} />
            </div>
            <h3 className="text-sm font-medium text-gray-700">Sections</h3>
            <div className="space-y-2">
              {venueForm.sections.map((sec, i) => (
                <div key={i} className="grid grid-cols-6 gap-2 items-center">
                  <input className="input-field text-sm" value={sec.name} onChange={(e) => { const s = [...venueForm.sections]; s[i].name = e.target.value; setVenueForm({ ...venueForm, sections: s }); }} />
                  <select className="input-field text-sm" value={sec.category} onChange={(e) => { const s = [...venueForm.sections]; s[i].category = e.target.value; setVenueForm({ ...venueForm, sections: s }); }}>
                    {['vip', 'premium', 'standard', 'economy', 'floor', 'accessible'].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input className="input-field text-sm" type="number" placeholder="Price (cents)" value={sec.priceCents} onChange={(e) => { const s = [...venueForm.sections]; s[i].priceCents = +e.target.value; setVenueForm({ ...venueForm, sections: s }); }} />
                  <input className="input-field text-sm" type="number" placeholder="Rows" value={sec.rows} onChange={(e) => { const s = [...venueForm.sections]; s[i].rows = +e.target.value; setVenueForm({ ...venueForm, sections: s }); }} />
                  <input className="input-field text-sm" type="number" placeholder="Seats/row" value={sec.seatsPerRow} onChange={(e) => { const s = [...venueForm.sections]; s[i].seatsPerRow = +e.target.value; setVenueForm({ ...venueForm, sections: s }); }} />
                  <div className="text-sm text-gray-500">{(sec.rows * sec.seatsPerRow).toLocaleString()} seats</div>
                </div>
              ))}
            </div>
            <div className="text-sm text-gray-500">
              Total capacity: {venueForm.sections.reduce((s, sec) => s + sec.rows * sec.seatsPerRow, 0).toLocaleString()} seats
            </div>
            <button onClick={createVenue} className="btn-primary">Create Venue</button>
          </div>
        )}

        {/* Create Event Modal */}
        {showCreateEvent && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create Event</h2>
              <button onClick={() => setShowCreateEvent(false)} className="text-gray-400 hover:text-gray-600">X</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input className="input-field" placeholder="Event Name" value={eventForm.name} onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })} />
              <input className="input-field" placeholder="Artist" value={eventForm.artist} onChange={(e) => setEventForm({ ...eventForm, artist: e.target.value })} />
              <input className="input-field" placeholder="Venue ID" value={eventForm.venueId} onChange={(e) => setEventForm({ ...eventForm, venueId: e.target.value })} />
              <input className="input-field" type="datetime-local" placeholder="Event Date" value={eventForm.date} onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })} />
              <input className="input-field" type="datetime-local" placeholder="Doors Open" value={eventForm.doorsOpen} onChange={(e) => setEventForm({ ...eventForm, doorsOpen: e.target.value })} />
              <input className="input-field" type="datetime-local" placeholder="Show Time" value={eventForm.showTime} onChange={(e) => setEventForm({ ...eventForm, showTime: e.target.value })} />
              <input className="input-field col-span-2" type="datetime-local" placeholder="Sale Starts At" value={eventForm.saleStartsAt} onChange={(e) => setEventForm({ ...eventForm, saleStartsAt: e.target.value })} />
            </div>
            <textarea className="input-field" rows={3} placeholder="Description" value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} />
            <button onClick={createEvent} className="btn-primary">Create Event + Generate Seats</button>
          </div>
        )}

        {/* Events Table */}
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Events</h2>
            <button onClick={loadEvents} className="btn-ghost text-sm"><RefreshCw size={14} className="mr-1" /> Refresh</button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3 text-left">Event</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-right">Seats</th>
                <th className="px-6 py-3 text-right">Sold</th>
                <th className="px-6 py-3 text-right">Price Range</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : events.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No events yet. Create one above!</td></tr>
              ) : events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium">{event.name}</div>
                    <div className="text-sm text-gray-500">{event.artist}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn('inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium', getStatusColor('event', event.status))}>
                      {event.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{event.date ? formatDate(event.date) : '-'}</td>
                  <td className="px-6 py-4 text-sm text-right">{event.totalSeats.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-sm font-medium">{event.soldSeats.toLocaleString()}</div>
                    <div className="text-xs text-gray-400">
                      {event.totalSeats > 0 ? Math.round((event.soldSeats / event.totalSeats) * 100) : 0}%
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-right">
                    {formatPrice(event.minPriceCents)} - {formatPrice(event.maxPriceCents)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {event.status === 'draft' && (
                        <button onClick={() => publishEvent(event.id)} className="btn-primary text-xs px-2 py-1">
                          Publish
                        </button>
                      )}
                      <button onClick={() => router.push(`/events/${event.id}`)} className="btn-ghost text-xs px-2 py-1">
                        <Eye size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
