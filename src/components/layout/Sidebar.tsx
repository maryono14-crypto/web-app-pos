import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Layers,
  Truck,
  Receipt,
  Wallet,
  TrendingUp,
  Users,
  Settings,
  Store,
  X,
  Award,
  FileText,
  Building2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { activeUser } = useApp();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pos', label: 'POS Kasir', icon: ShoppingCart },
    { id: 'products', label: 'Master Produk', icon: Package },
    { id: 'inventory', label: 'Inventaris & HPP', icon: Layers },
    { id: 'suppliers', label: 'Supplier & Pasokan', icon: Building2 },
    { id: 'purchases', label: 'Pembelian & PO', icon: Truck },
    { id: 'sales', label: 'Riwayat Penjualan', icon: Receipt },
    { id: 'receivables', label: 'Piutang & Kasbon', icon: FileText },
    { id: 'customers', label: 'Pelanggan & Poin', icon: Award },
    { id: 'finance', label: 'Keuangan & Biaya', icon: Wallet },
    { id: 'analytics', label: 'Analisis Bisnis', icon: TrendingUp },
    { id: 'users', label: 'Pengguna & Akses', icon: Users },
    { id: 'settings', label: 'Pengaturan & Cloud', icon: Settings },
  ];


  const handleNavClick = (id: string) => {
    onNavigate(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col justify-between transition-transform duration-200 ease-in-out shrink-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand & Logo */}
        <div>
          <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-md">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <span className="font-black text-white text-sm tracking-tight block">
                  BERKAH POS
                </span>
                <span className="text-[10px] text-emerald-400 font-medium block">
                  Inventory & BI System
                </span>
              </div>
            </div>

            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-900/20'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Info Card in Footer */}
        <div className="p-4 border-t border-slate-800">
          <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-xs border border-emerald-500/30">
              {activeUser.name.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-xs text-white truncate leading-tight">
                {activeUser.name}
              </div>
              <div className="text-[10px] font-semibold text-emerald-400 mt-0.5">
                {activeUser.role}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
