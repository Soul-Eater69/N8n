'use client';

import { useState } from 'react';
import { Settings, Building2, Bell, Shield, Database, Zap } from 'lucide-react';
import { useAuthStore } from '@/lib/store';

export default function SettingsPage() {
  const { tenant, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('general');

  const tabs = [
    { id: 'general', label: 'General', icon: Building2 },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'execution', label: 'Execution', icon: Zap },
    { id: 'data', label: 'Data Management', icon: Database },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-[var(--color-text-muted)] text-sm mt-1">
          Manage your organization settings and preferences
        </p>
      </div>

      <div className="flex gap-6">
        {/* Tabs */}
        <div className="w-56 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'general' && (
            <div className="card space-y-6">
              <h2 className="text-lg font-semibold">General Settings</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Organization Name</label>
                  <input
                    type="text"
                    className="input-field max-w-md"
                    defaultValue={tenant?.name}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Timezone</label>
                  <select className="input-field max-w-md">
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="Europe/London">London</option>
                    <option value="Europe/Berlin">Berlin</option>
                    <option value="Asia/Tokyo">Tokyo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Default Workflow Timeout (ms)</label>
                  <input
                    type="number"
                    className="input-field max-w-md"
                    defaultValue={300000}
                    min={1000}
                    max={3600000}
                  />
                </div>
              </div>

              <button className="btn-primary">Save Changes</button>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="card space-y-6">
              <h2 className="text-lg font-semibold">Security Settings</h2>

              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" defaultChecked />
                  <div>
                    <div className="text-sm font-medium">Require two-factor authentication</div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      All team members must enable 2FA
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                  <div>
                    <div className="text-sm font-medium">IP Allowlist</div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      Restrict access to specific IP addresses
                    </div>
                  </div>
                </label>

                <div>
                  <label className="block text-sm font-medium mb-1">Session Timeout (minutes)</label>
                  <input type="number" className="input-field max-w-md" defaultValue={30} min={5} max={1440} />
                </div>
              </div>

              <button className="btn-primary">Save Changes</button>
            </div>
          )}

          {activeTab === 'execution' && (
            <div className="card space-y-6">
              <h2 className="text-lg font-semibold">Execution Settings</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Max Concurrent Executions</label>
                  <input type="number" className="input-field max-w-md" defaultValue={50} min={1} max={500} />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Execution Data Retention (days)</label>
                  <input type="number" className="input-field max-w-md" defaultValue={30} min={1} max={365} />
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" defaultChecked />
                  <div>
                    <div className="text-sm font-medium">Save execution data</div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      Store input/output data for each execution node
                    </div>
                  </div>
                </label>
              </div>

              <button className="btn-primary">Save Changes</button>
            </div>
          )}

          {(activeTab === 'notifications' || activeTab === 'data') && (
            <div className="card text-center py-12">
              <Settings size={48} className="mx-auto mb-4 text-[var(--color-text-muted)] opacity-30" />
              <h3 className="text-lg font-medium mb-2">Coming Soon</h3>
              <p className="text-[var(--color-text-muted)]">
                This settings section is under development
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
