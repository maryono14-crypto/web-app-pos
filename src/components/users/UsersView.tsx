import React, { useEffect, useState } from 'react';
import { db } from '../../db/indexedDB';
import { AuditLog, Role, UserAccount } from '../../types';
import { useApp } from '../../context/AppContext';
import { ConfirmModal } from '../common/ConfirmModal';
import {
  Users,
  Shield,
  KeyRound,
  History,
  CheckCircle,
  X,
  Plus,
  UserCheck,
  Edit,
  Trash2,
  Lock,
  Mail,
  User as UserIcon,
  Search,
} from 'lucide-react';

export const UsersView: React.FC = () => {
  const { activeUser, setActiveUser, setSwitchUserModalOpen, showToast } = useApp();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<'USERS' | 'AUDIT'>('USERS');
  const [searchUser, setSearchUser] = useState('');

  // Add / Edit User modal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    role: 'CASHIER' as Role,
    pin: '1234',
    active: true,
  });

  // Delete User confirmation modal
  const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);

  const loadData = async () => {
    const [uList, aList] = await Promise.all([
      db.users.toArray(),
      db.auditLogs.reverse().sortBy('timestamp'),
    ]);
    setUsers(uList);
    setAuditLogs(aList.slice(0, 50));
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddUserModal = () => {
    setEditingUser(null);
    setUserForm({
      name: '',
      email: '',
      role: 'CASHIER',
      pin: '1234',
      active: true,
    });
    setIsUserModalOpen(true);
  };

  const openEditUserModal = (user: UserAccount) => {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      pin: user.pin,
      active: user.active ?? true,
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!userForm.name.trim() || !userForm.pin.trim()) {
      showToast('Nama karyawan dan PIN wajib diisi', 'error');
      return;
    }

    if (userForm.pin.length < 4) {
      showToast('PIN keamanan minimal 4 digit', 'error');
      return;
    }

    const now = new Date().toISOString();

    if (editingUser) {
      // Update existing user
      await db.users.update(editingUser.id, {
        name: userForm.name.trim(),
        email: userForm.email.trim() || editingUser.email,
        role: userForm.role,
        pin: userForm.pin.trim(),
        active: userForm.active,
      });

      // If updating currently active user, update context too
      if (activeUser?.id === editingUser.id) {
        setActiveUser({
          ...editingUser,
          name: userForm.name.trim(),
          email: userForm.email.trim() || editingUser.email,
          role: userForm.role,
          pin: userForm.pin.trim(),
          active: userForm.active,
        });
      }

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: now,
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'UPDATE_USER',
        category: 'USERS',
        details: `Pengguna diubah: ${userForm.name} (Role: ${userForm.role}, Aktif: ${userForm.active ? 'Ya' : 'Tidak'})`,
      });

      showToast(`Data akun ${userForm.name} berhasil diperbarui!`, 'success');
    } else {
      // Create new user
      const newAcc: UserAccount = {
        id: `USR-${Date.now().toString().slice(-4)}`,
        name: userForm.name.trim(),
        email: userForm.email.trim() || `${userForm.name.toLowerCase().replace(/\s+/g, '')}@toko.com`,
        role: userForm.role,
        pin: userForm.pin.trim(),
        active: userForm.active,
      };

      await db.users.add(newAcc);

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: now,
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'CREATE_USER',
        category: 'USERS',
        details: `Karyawan/Pengguna baru ditambahkan: ${newAcc.name} (Role: ${newAcc.role})`,
      });

      showToast(`Akun ${userForm.name} (${userForm.role}) berhasil didaftarkan!`, 'success');
    }

    setIsUserModalOpen(false);
    loadData();
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    if (users.length <= 1) {
      showToast('Tidak dapat menghapus satu-satunya akun pengguna dalam sistem', 'error');
      setUserToDelete(null);
      return;
    }

    if (activeUser?.id === userToDelete.id) {
      showToast('Tidak dapat menghapus akun yang sedang aktif digunakan. Silakan ganti akun terlebih dahulu.', 'error');
      setUserToDelete(null);
      return;
    }

    try {
      const now = new Date().toISOString();
      const u = userToDelete;

      await db.users.delete(u.id);

      await db.auditLogs.add({
        id: `AUD-${Date.now()}`,
        timestamp: now,
        userId: activeUser.id,
        userName: activeUser.name,
        action: 'DELETE_USER',
        category: 'USERS',
        details: `Pengguna dihapus: ${u.name} (ID: ${u.id}, Role: ${u.role})`,
      });

      showToast(`Akun karyawan "${u.name}" berhasil dihapus`, 'success');
      setUserToDelete(null);
      loadData();
    } catch (err: any) {
      showToast('Gagal menghapus pengguna: ' + err.message, 'error');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Manajemen Pengguna & Audit Log (RBAC)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Hak akses role Owner, Admin, Manager, Cashier, serta log riwayat aktivitas sistem
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSwitchUserModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-xs cursor-pointer"
          >
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>Ganti Akun Aktif</span>
          </button>
          <button
            onClick={openAddUserModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Karyawan / Pengguna</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('USERS')}
            className={`px-4 py-2 font-bold text-xs border-b-2 transition-all cursor-pointer ${
              activeTab === 'USERS'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Daftar Pengguna ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('AUDIT')}
            className={`px-4 py-2 font-bold text-xs border-b-2 transition-all cursor-pointer ${
              activeTab === 'AUDIT'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Audit Log Aktivitas ({auditLogs.length})
          </button>
        </div>

        {activeTab === 'USERS' && (
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              placeholder="Cari nama atau email..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Users Grid */}
      {activeTab === 'USERS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {users
            .filter((u) => {
              const q = searchUser.toLowerCase();
              return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
            })
            .map((u) => {
              const isCurrent = activeUser?.id === u.id;
              const isInactive = u.active === false;

              return (
                <div
                  key={u.id}
                  className={`p-4 rounded-2xl border bg-white shadow-2xs space-y-3 transition-all flex flex-col justify-between ${
                    isCurrent
                      ? 'ring-2 ring-emerald-500/40 border-emerald-500'
                      : isInactive
                      ? 'opacity-60 border-slate-200 bg-slate-50/60'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    {/* Header: Avatar, Role Badge, and Action Buttons */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 font-bold text-slate-700 flex items-center justify-center text-sm border border-slate-200 shrink-0">
                          {u.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-xs text-slate-900 truncate max-w-[130px]">
                              {u.name}
                            </h3>
                          </div>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                              u.role === 'OWNER'
                                ? 'bg-purple-100 text-purple-800'
                                : u.role === 'ADMIN'
                                ? 'bg-rose-100 text-rose-800'
                                : u.role === 'MANAGER'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {u.role}
                          </span>
                        </div>
                      </div>

                      {/* Edit and Delete Action Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => openEditUserModal(u)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                          title="Ubah Data Pengguna (Edit)"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={isCurrent}
                          onClick={() => setUserToDelete(u)}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            isCurrent
                              ? 'border-slate-200 text-slate-300 cursor-not-allowed opacity-40'
                              : 'border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer'
                          }`}
                          title={isCurrent ? 'Akun aktif tidak dapat dihapus' : 'Hapus Karyawan / Pengguna'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Email & Status */}
                    <div className="mt-3 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] truncate">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{u.email}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-slate-400 font-medium">Status Akun:</span>
                        <span className={`font-semibold ${isInactive ? 'text-slate-400' : 'text-emerald-700'}`}>
                          {isInactive ? 'Non-Aktif' : 'Aktif'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Card: PIN & Active Indicator */}
                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-slate-500 text-[11px]">
                      <Lock className="w-3 h-3 text-slate-400" />
                      <span>PIN:</span>
                      <span className="font-mono font-bold text-slate-800">•••• ({u.pin})</span>
                    </div>

                    {isCurrent ? (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        Akun Anda
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveUser(u);
                          showToast(`Beralih ke akun ${u.name} (${u.role})`, 'info');
                        }}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                      >
                        Gunakan Akun
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Tab 2: Audit Logs */}
      {activeTab === 'AUDIT' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Pengguna</th>
                  <th className="py-3 px-4">Aksi</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Rincian Perubahan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{log.userName}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">{log.category}</td>
                    <td className="py-3 px-4 text-slate-700">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Tambah / Ubah User (Edit & Create) */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92dvh] flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingUser ? 'Ubah Akun Pengguna' : 'Tambah Pengguna Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 text-xs flex-1 overflow-y-auto">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Karyawan:</label>
                <input
                  type="text"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="Contoh: Rian Pratama"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Alamat Email:</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="rian@toko.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Role &amp; Hak Akses (RBAC):</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as Role })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="CASHIER">CASHIER (Akses Kasir POS, Shift &amp; Piutang)</option>
                  <option value="MANAGER">MANAGER (Inventaris HPP, Pembelian PO &amp; Supplier)</option>
                  <option value="ADMIN">ADMIN (Semua Modul Bisnis &amp; Pengaturan)</option>
                  <option value="OWNER">OWNER (Pemilik Usaha - Hak Akses Penuh)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Menentukan batasan izin akses modul dan tindakan di sistem.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">PIN Kasir (4–6 Angka):</label>
                <div className="relative">
                  <input
                    type="password"
                    maxLength={6}
                    value={userForm.pin}
                    onChange={(e) => setUserForm({ ...userForm, pin: e.target.value.replace(/\D/g, '') })}
                    placeholder="1234"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-center tracking-widest text-base font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block text-center">
                  Digunakan untuk otorisasi cepat login kasir dan pergantian shift
                </span>
              </div>

              {editingUser && (
                <div className="pt-2 border-t border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userForm.active}
                      onChange={(e) => setUserForm({ ...userForm, active: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span className="font-semibold text-slate-700">Status Akun Aktif (Dapat Login)</span>
                  </label>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                onClick={handleSaveUser}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-xs"
              >
                {editingUser ? 'Simpan Perubahan' : 'Daftarkan Pengguna'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete User */}
      <ConfirmModal
        isOpen={!!userToDelete}
        title="Hapus Akun Karyawan"
        message={`Apakah Anda yakin ingin menghapus akun "${userToDelete?.name}" (${userToDelete?.role})? Akun ini tidak akan dapat login lagi ke sistem.`}
        confirmText="Hapus Akun"
        cancelText="Batal"
        isDestructive={true}
        onConfirm={handleDeleteUser}
        onClose={() => setUserToDelete(null)}
      />
    </div>
  );
};
