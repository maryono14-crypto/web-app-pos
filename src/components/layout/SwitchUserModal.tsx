import React, { useEffect, useState } from 'react';
import { db } from '../../db/indexedDB';
import { UserAccount } from '../../types';
import { useApp } from '../../context/AppContext';
import { Shield, UserCheck, X, KeyRound } from 'lucide-react';

export const SwitchUserModal: React.FC = () => {
  const { isSwitchUserModalOpen, setSwitchUserModalOpen, activeUser, setActiveUser, showToast } =
    useApp();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    if (isSwitchUserModalOpen) {
      db.users.toArray().then((list) => {
        setUsers(list.filter((u) => u.active));
        setSelectedUser(null);
        setEnteredPin('');
        setPinError('');
      });
    }
  }, [isSwitchUserModalOpen]);

  if (!isSwitchUserModalOpen) return null;

  const handleSelectUser = (user: UserAccount) => {
    setSelectedUser(user);
    setEnteredPin('');
    setPinError('');
  };

  const handleConfirmSwitch = () => {
    if (!selectedUser) return;
    if (enteredPin !== selectedUser.pin) {
      setPinError('PIN salah! Coba lagi.');
      return;
    }

    setActiveUser(selectedUser);
    showToast(`Beralih ke akun ${selectedUser.name} (${selectedUser.role})`, 'success');
    setSwitchUserModalOpen(false);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'MANAGER':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'CASHIER':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Ganti Pengguna / Kasir</h3>
              <p className="text-xs text-slate-500">Pilih akun dan masukkan PIN 4-digit</p>
            </div>
          </div>
          <button
            onClick={() => setSwitchUserModalOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 gap-2">
            {users.map((u) => {
              const isSelected = selectedUser?.id === u.id;
              const isCurrent = activeUser?.id === u.id;
              return (
                <button
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-sm border border-slate-200">
                      {u.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900">{u.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] font-medium bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                            Aktif
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">PIN: {u.pin}</span>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium border ${getRoleBadge(
                      u.role
                    )}`}
                  >
                    {u.role}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedUser && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Masukkan PIN untuk {selectedUser.name}:
              </label>
              <div className="relative">
                <input
                  type="password"
                  maxLength={6}
                  value={enteredPin}
                  onChange={(e) => {
                    setEnteredPin(e.target.value);
                    setPinError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmSwitch();
                  }}
                  autoFocus
                  placeholder="PIN 4 digit"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-center text-lg font-mono tracking-widest focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              </div>
              {pinError && <p className="text-xs text-rose-600 font-medium">{pinError}</p>}
            </div>
          )}
        </div>

        <div className="bg-slate-50 px-5 py-3.5 flex justify-end gap-2 border-t border-slate-100">
          <button
            onClick={() => setSwitchUserModalOpen(false)}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200/60"
          >
            Batal
          </button>
          <button
            disabled={!selectedUser || !enteredPin}
            onClick={handleConfirmSwitch}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Masuk Akun
          </button>
        </div>
      </div>
    </div>
  );
};
