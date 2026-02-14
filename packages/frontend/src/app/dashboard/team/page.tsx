'use client';

import { useState, useEffect } from 'react';
import { Users, Plus, Shield, Mail, Clock, Crown, User } from 'lucide-react';
import { api } from '@/lib/api';
import { IUser, UserRole } from '@flowforge/shared';
import { cn, formatRelativeTime } from '@/lib/utils';

const roleIcons: Record<string, React.ComponentType<any>> = {
  owner: Crown,
  admin: Shield,
  member: User,
  viewer: Users,
};

const roleColors: Record<string, string> = {
  owner: 'bg-yellow-100 text-yellow-700',
  admin: 'bg-purple-100 text-purple-700',
  member: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-700',
};

export default function TeamPage() {
  const [users, setUsers] = useState<IUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'member' as UserRole,
    password: '',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const res = await api.get<IUser[]>('/auth/users');
      setUsers(res.data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }

  async function inviteUser() {
    try {
      await api.post('/auth/users/invite', form);
      setShowInvite(false);
      setForm({ email: '', firstName: '', lastName: '', role: 'member', password: '' });
      loadUsers();
    } catch (err) {
      console.error('Failed to invite user:', err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team Members</h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            {users.length} member{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowInvite(true)} className="btn-primary">
          <Plus size={18} className="mr-2" />
          Invite Member
        </button>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="card space-y-4">
          <h3 className="font-semibold">Invite Team Member</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">First Name</label>
              <input
                type="text"
                className="input-field"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last Name</label>
              <input
                type="text"
                className="input-field"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              className="input-field"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Temporary Password</label>
            <input
              type="password"
              className="input-field"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              className="input-field"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowInvite(false)} className="btn-secondary">Cancel</button>
            <button onClick={inviteUser} className="btn-primary">Send Invite</button>
          </div>
        </div>
      )}

      {/* Users list */}
      <div className="space-y-3">
        {users.map((user) => {
          const RoleIcon = roleIcons[user.role] || User;
          return (
            <div key={user.id} className="card flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold">
                  {user.firstName[0]}{user.lastName[0]}
                </div>
                <div>
                  <div className="font-medium">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                      <Mail size={12} />
                      {user.email}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                    roleColors[user.role]
                  )}
                >
                  <RoleIcon size={12} />
                  {user.role}
                </span>
                {user.lastLoginAt && (
                  <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                    <Clock size={12} />
                    {formatRelativeTime(user.lastLoginAt)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
