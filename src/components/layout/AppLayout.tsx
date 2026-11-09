import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ShiftModal } from '../pos/ShiftModal';
import { SwitchUserModal } from './SwitchUserModal';
import { SyncQueueModal } from '../common/SyncQueueModal';
import { DashboardView } from '../dashboard/DashboardView';
import { POSCheckout } from '../pos/POSCheckout';
import { ProductsView } from '../products/ProductsView';
import { InventoryView } from '../inventory/InventoryView';
import { PurchasesView } from '../purchases/PurchasesView';
import { SuppliersView } from '../suppliers/SuppliersView';
import { SalesHistoryView } from '../sales/SalesHistoryView';
import { ReceivablesView } from '../receivables/ReceivablesView';
import { CustomersView } from '../customers/CustomersView';
import { FinanceView } from '../finance/FinanceView';
import { AnalyticsView } from '../analytics/AnalyticsView';
import { UsersView } from '../users/UsersView';
import { SettingsView } from '../settings/SettingsView';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  ShoppingCart,
  LayoutDashboard,
  Package,
  Receipt,
  TrendingUp,
  Menu,
} from 'lucide-react';

export const AppLayout: React.FC = () => {
  const [currentView, setCurrentView] = useState<string>('pos');
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { toastMessage } = useApp();

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView onNavigate={setCurrentView} />;
      case 'pos':
        return <POSCheckout />;
      case 'products':
        return <ProductsView />;
      case 'inventory':
        return <InventoryView />;
      case 'suppliers':
        return <SuppliersView />;
      case 'purchases':
        return <PurchasesView />;
      case 'sales':
        return <SalesHistoryView />;
      case 'receivables':
        return <ReceivablesView />;
      case 'customers':
        return <CustomersView />;
      case 'finance':
        return <FinanceView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'users':
        return <UsersView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <POSCheckout />;
    }
  };

  const mobileNavItems = [
    { id: 'pos', label: 'Kasir', icon: ShoppingCart },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Produk', icon: Package },
    { id: 'sales', label: 'Riwayat', icon: Receipt },
    { id: 'analytics', label: 'Tren BI', icon: TrendingUp },
  ];

  return (
    <div className="flex h-screen h-[100dvh] w-screen overflow-hidden bg-slate-100 font-sans text-slate-900 select-none">
      {/* Sidebar Navigation (Desktop static + Mobile slide-over drawer) */}
      <Sidebar
        currentView={currentView}
        onNavigate={setCurrentView}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          onToggleMobileMenu={() => setMobileMenuOpen(!isMobileMenuOpen)}
          onNavigate={setCurrentView}
        />

        {/* View Content: Padded bottom on mobile so content is reachable above bottom navigation */}
        <main className={`flex-1 overflow-y-auto relative ${currentView === 'pos' ? 'pb-0' : 'pb-20 lg:pb-0'}`}>
          {renderContent()}
        </main>

        {/* Mobile Fixed Bottom Navigation Bar (Touch-first Ergonomics) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 flex items-center justify-around h-16 px-1 shadow-lg">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`flex flex-col items-center justify-center flex-1 py-1 min-h-[48px] rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? 'text-emerald-700 font-bold'
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px] scale-105' : 'stroke-[1.75px]'}`} />
                <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
              </button>
            );
          })}

          {/* Menu Drawer Trigger */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center flex-1 py-1 min-h-[48px] rounded-xl text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
            title="Menu Lainnya"
          >
            <Menu className="w-5 h-5 stroke-[1.75px]" />
            <span className="text-[10px] mt-0.5 tracking-tight font-medium">Menu</span>
          </button>
        </nav>
      </div>

      {/* Global Modals */}
      <ShiftModal />
      <SwitchUserModal />
      <SyncQueueModal />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold transition-all animate-in fade-in slide-in-from-bottom-5 bg-white">
          {toastMessage.type === 'success' && (
            <div className="p-1 rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}
          {toastMessage.type === 'error' && (
            <div className="p-1 rounded-full bg-rose-100 text-rose-700">
              <AlertCircle className="w-4 h-4" />
            </div>
          )}
          {toastMessage.type === 'info' && (
            <div className="p-1 rounded-full bg-blue-100 text-blue-700">
              <Info className="w-4 h-4" />
            </div>
          )}
          <span className="text-slate-800">{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
};
