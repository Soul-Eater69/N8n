'use client';

import { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Edit3, Shield, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { ICredential } from '@flowforge/shared';
import { formatRelativeTime } from '@/lib/utils';

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<ICredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', type: '', data: '{}' });

  useEffect(() => {
    loadCredentials();
  }, []);

  async function loadCredentials() {
    try {
      const res = await api.get<ICredential[]>('/credentials');
      setCredentials(res.data || []);
    } catch (err) {
      console.error('Failed to load credentials:', err);
    } finally {
      setLoading(false);
    }
  }

  async function createCredential() {
    try {
      await api.post('/credentials', {
        name: form.name,
        type: form.type,
        data: JSON.parse(form.data),
      });
      setShowForm(false);
      setForm({ name: '', type: '', data: '{}' });
      loadCredentials();
    } catch (err) {
      console.error('Failed to create credential:', err);
    }
  }

  async function deleteCredential(id: string) {
    if (!confirm('Delete this credential?')) return;
    try {
      await api.delete(`/credentials/${id}`);
      loadCredentials();
    } catch (err) {
      console.error('Failed to delete credential:', err);
    }
  }

  const credentialTypes = [
    'httpBasicAuth',
    'httpBearerAuth',
    'apiKey',
    'oauth2',
    'smtp',
    'database',
    'aws',
    'gcp',
    'slack',
    'github',
    'custom',
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Credentials</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            Securely store API keys, tokens, and authentication data
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={18} className="mr-2" />
          Add Credential
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card space-y-4">
          <h3 className="font-semibold">New Credential</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                className="input-field"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="My API Key"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                className="input-field"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="">Select type...</option>
                {credentialTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Data (JSON)</label>
            <textarea
              className="input-field font-mono text-sm"
              rows={4}
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
              placeholder='{"apiKey": "your-key-here"}'
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary">
              Cancel
            </button>
            <button onClick={createCredential} className="btn-primary">
              Create
            </button>
          </div>
        </div>
      )}

      {/* Credentials list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse h-16" />
          ))}
        </div>
      ) : credentials.length === 0 ? (
        <div className="card text-center py-12">
          <Key size={48} className="mx-auto mb-4 text-[var(--color-text-muted)] opacity-30" />
          <h3 className="text-lg font-medium mb-2">No credentials yet</h3>
          <p className="text-[var(--color-text-muted)]">
            Add credentials to connect your workflows to external services
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {credentials.map((cred) => (
            <div key={cred.id} className="card flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-purple-50">
                  <Shield className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="font-medium">{cred.name}</div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] px-2 py-0.5 rounded">
                      {cred.type}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                      <Clock size={12} />
                      {formatRelativeTime(cred.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => deleteCredential(cred.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
