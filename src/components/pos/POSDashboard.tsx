import React, { useEffect, useRef, useState } from 'react';
import { db } from '../../db/indexedDB';
import { CartItem, Category, Customer, Product, Sale } from '../../types';
import { useApp } from '../../context/AppContext';
import { CartPanel } from './CartPanel';
import { PaymentModal } from './PaymentModal';
import { ReceiptModal } from './ReceiptModal';
import { HoldOrdersModal } from './HoldOrdersModal';
import {
  Search,
  Barcode,
  AlertTriangle,
  Package,
  Layers,
  Sparkles,
  ShoppingBag,
  Clock,
  DollarSign,
  TrendingUp,
  Receipt,
  RotateCcw,
  CheckCircle2,
  Printer,
  X,
  Volume2,
  VolumeX,
  Camera,
  ShoppingCart,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { BarcodeScannerModal } from './BarcodeScannerModal';

export const POSDashboard: React.FC = () => {
  const { activeShift, setShiftModalOpen, settings, showToast, activeUser } = useApp();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Mobile layout state: toggle between 'catalog' and 'cart' on small screens
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);


  // Modals state
  const [isPaymentOpen, setPaymentOpen] = useState(false);
  const [isReceiptOpen, setReceiptOpen] = useState(false);
  const [isHoldModalOpen, setHoldModalOpen] = useState(false);
  const [isRecentSalesOpen, setRecentSalesOpen] = useState(false);
  const [isCameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [holdCount, setHoldCount] = useState(0);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);

  // Sound feedback toggle
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Today's summary stats
  const [todayOmzet, setTodayOmzet] = useState(0);
  const [todayTransactions, setTodayTransactions] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Play subtle beep sound on barcode scan / cart add using Web Audio API
  const playBeep = (freq = 880, type: OscillatorType = 'sine', duration = 0.08) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch {
      // Audio not permitted or not supported
    }
  };

  // Load products, categories, and today's sales
  const loadData = async () => {
    const todayStr = new Date().toDateString();
    const [pList, cList, hCount, allSales] = await Promise.all([
      db.products.filter((p) => p.active).toArray(),
      db.categories.toArray(),
      db.holdOrders.count(),
      db.sales.reverse().sortBy('timestamp'),
    ]);

    setProducts(pList);
    setCategories(cList);
    setHoldCount(hCount);

    const validSalesToday = allSales.filter(
      (s) => s.status !== 'VOID' && new Date(s.timestamp).toDateString() === todayStr
    );
    setTodayOmzet(validSalesToday.reduce((sum, s) => sum + s.grandTotal, 0));
    setTodayTransactions(validSalesToday.length);
    setRecentSales(allSales.slice(0, 8));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Keyboard Shortcuts: F2=Reset, F3=Focus Search, F4=Payment, F8=Toggle Recent
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault();
        if (cartItems.length > 0) setPaymentOpen(true);
      } else if (e.key === 'F2') {
        e.preventDefault();
        handleResetCart();
      } else if (e.key === 'F3' || (e.key === '/' && document.activeElement?.tagName !== 'INPUT')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F8') {
        e.preventDefault();
        setRecentSalesOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems]);

  const handleAddToCart = (product: Product) => {
    if (product.currentStock <= 0) {
      playBeep(300, 'sawtooth', 0.15);
      showToast(`Stok "${product.name}" habis!`, 'error');
      return;
    }

    playBeep(980, 'sine', 0.08);

    setCartItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        if (existing.qty + 1 > product.currentStock) {
          showToast(`Stok "${product.name}" hanya tersisa ${product.currentStock}`, 'error');
          return prev;
        }
        return prev.map((i) =>
          i.productId === product.id ? { ...i, qty: i.qty + 1 } : i
        );
      } else {
        return [
          ...prev,
          {
            productId: product.id,
            product,
            qty: 1,
            sellingPrice: product.sellingPrice,
            discountItem: 0,
          },
        ];
      }
    });
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const query = searchQuery.trim().toLowerCase();
    const matched = products.find(
      (p) => p.barcode === query || p.sku.toLowerCase() === query
    );

    if (matched) {
      handleAddToCart(matched);
      setSearchQuery('');
      showToast(`Scan berhasil: ${matched.name}`, 'info');
    } else {
      playBeep(300, 'sawtooth', 0.2);
      showToast(`Produk dengan barcode/SKU "${searchQuery}" tidak ditemukan`, 'error');
    }
  };

  const handleUpdateQty = (productId: string, newQty: number) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    if (newQty <= 0) {
      handleRemoveItem(productId);
      return;
    }

    if (newQty > prod.currentStock) {
      playBeep(350, 'sawtooth', 0.15);
      showToast(`Maksimal stok tersedia adalah ${prod.currentStock}`, 'error');
      return;
    }

    playBeep(850, 'sine', 0.05);
    setCartItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, qty: newQty } : i))
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCartItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  const handleResetCart = () => {
    setCartItems([]);
    setSelectedCustomer(null);
    setCustomerName('');
    setOrderNotes('');
    setOrderDiscount(0);
    setPointsToRedeem(0);
  };

  const handleHoldCurrentOrder = async () => {
    if (cartItems.length === 0) return;

    const subtotal = cartItems.reduce(
      (s, i) => s + i.qty * i.sellingPrice - i.discountItem,
      0
    );

    await db.holdOrders.add({
      id: `HLD-${Date.now()}`,
      orderName: selectedCustomer ? `${selectedCustomer.name} (Member)` : (customerName || `Pesanan #${Date.now().toString().slice(-4)}`),
      items: cartItems,
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer ? selectedCustomer.name : customerName,
      notes: orderNotes,
      savedAt: new Date().toISOString(),
      subtotal,
    });

    showToast('Pesanan berhasil ditahan.', 'info');
    handleResetCart();
    const count = await db.holdOrders.count();
    setHoldCount(count);
  };

  const handleResumeHoldOrder = async (
    items: CartItem[],
    custName?: string,
    notes?: string,
    custId?: string
  ) => {
    setCartItems(items);
    if (custId) {
      try {
        const c = await db.customers.get(custId);
        if (c) {
          setSelectedCustomer(c);
          setCustomerName(c.name);
        } else if (custName) {
          setCustomerName(custName);
        }
      } catch {
        if (custName) setCustomerName(custName);
      }
    } else if (custName) {
      setCustomerName(custName);
    }
    if (notes) setOrderNotes(notes);
    showToast('Pesanan berhasil dipanggil kembali ke kasir.', 'success');
  };

  const handlePaymentSuccess = (sale: Sale) => {
    playBeep(1200, 'triangle', 0.25);
    setCompletedSale(sale);
    setPaymentOpen(false);
    setReceiptOpen(true);
    handleResetCart();
    loadData(); // refresh stock numbers & KPI
  };

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === 'ALL' || p.categoryId === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  // Calculate cart financials for payment modal including loyalty points
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.qty * item.sellingPrice - item.discountItem,
    0
  );
  const redemptionValue = settings?.loyaltyPointRedemptionValue || 100;
  const pointsDiscountAmount = pointsToRedeem * redemptionValue;
  const discountedSubtotal = Math.max(0, subtotal - orderDiscount - pointsDiscountAmount);
  const taxRate = settings?.taxEnabled ? settings.taxRatePercent : 0;
  const taxAmount = settings?.taxEnabled ? Math.round((discountedSubtotal * taxRate) / 100) : 0;
  const grandTotal = discountedSubtotal + taxAmount;
  const pointsToEarn = Math.floor(grandTotal / (settings?.loyaltyPointsPerAmount || 10000));


  return (
    <div className="flex flex-col h-full bg-slate-100 overflow-hidden">
      {/* 1. Top Mini Dashboard Banner */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 shrink-0 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        {/* Left: KPIs */}
        <div className="flex items-center gap-4 text-xs">
          {/* Omzet Hari Ini */}
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
              <DollarSign className="w-3.5 h-3.5" />
            </span>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block leading-none">
                Omzet Hari Ini
              </span>
              <span className="font-black text-slate-900 text-xs mt-0.5 block leading-none">
                Rp {todayOmzet.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          {/* Transaksi Hari Ini */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-100 text-blue-800">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block leading-none">
                Transaksi
              </span>
              <span className="font-bold text-slate-800 text-xs mt-0.5 block leading-none">
                {todayTransactions} Struk
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden md:block" />

          {/* Laci Kasir */}
          <div className="hidden md:flex items-center gap-2">
            <span
              className={`p-1.5 rounded-lg ${
                activeShift ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
            </span>
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block leading-none">
                Laci Kasir
              </span>
              <span className="font-bold text-slate-800 text-xs mt-0.5 block leading-none">
                {activeShift
                  ? `Rp ${activeShift.expectedEndingCash.toLocaleString('id-ID')}`
                  : 'Belum Buka Shift'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quick Controls & Modals */}
        <div className="flex items-center gap-2 text-xs">
          {/* Audio Beep Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-1.5 rounded-lg border text-slate-600 transition-colors cursor-pointer ${
              soundEnabled ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200'
            }`}
            title={soundEnabled ? 'Suara Scanner Aktif' : 'Suara Scanner Hening'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Recent Transactions Drawer Toggle */}
          <button
            onClick={() => setRecentSalesOpen(!isRecentSalesOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
            title="Riwayat 8 Struk Terakhir (F8)"
          >
            <Receipt className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Struk Terakhir</span>
            <span className="text-[10px] font-mono opacity-70">F8</span>
          </button>

          {/* Shift Button */}
          {!activeShift && (
            <button
              onClick={() => setShiftModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-xs cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Buka Shift</span>
            </button>
          )}

          {/* Mobile Cart Toggle Button */}
          <button
            onClick={() => setMobileTab(mobileTab === 'catalog' ? 'cart' : 'catalog')}
            className={`lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer ${
              mobileTab === 'cart'
                ? 'bg-slate-900 text-white'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>{mobileTab === 'catalog' ? `Keranjang (${cartItems.reduce((s, i) => s + i.qty, 0)})` : 'Katalog'}</span>
          </button>
        </div>
      </div>

      {/* 2. Main POS Workspace: Catalog Grid + Cart Panel */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Left: Search, Category Tabs & Product Cards */}
        <div className={`flex-1 flex flex-col min-w-0 ${mobileTab === 'cart' ? 'hidden lg:flex' : 'flex'}`}>
          {/* Fast Search & Barcode Scanner Form */}
          <div className="p-3 bg-white border-b border-slate-200 flex items-center gap-2.5 shrink-0">
            <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Scan barcode scanner fisik atau ketik nama produk / SKU... [Shortcut: F3 atau /]"
                className="w-full pl-10 pr-28 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
              />
              <div className="absolute right-2.5 top-2 flex items-center gap-1 text-[11px] text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                <Barcode className="w-3.5 h-3.5" />
                <span>Enter</span>
              </div>
            </form>

            {/* Camera Barcode Scanner Trigger Button */}
            <button
              type="button"
              onClick={() => setCameraScannerOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0"
              title="Buka Kamera Barcode Scanner (Webcam / HP)"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Kamera Barcode</span>
            </button>
          </div>

          {/* Horizontal Category Filter Pills */}
          <div className="px-3 py-2 bg-white border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
              }`}
            >
              Semua ({products.length})
            </button>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const count = products.filter((p) => p.categoryId === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                  }`}
                >
                  <span>{cat.icon || '📦'}</span>
                  <span>{cat.name}</span>
                  <span className="text-[10px] opacity-75 font-mono">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Product Grid Area */}
          <div className={`flex-1 overflow-y-auto p-3 sm:p-4 ${cartItems.length > 0 ? 'pb-24 lg:pb-4' : ''}`}>
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <Package className="w-12 h-12 opacity-40 mb-2" />
                <p className="text-sm font-semibold text-slate-600">Produk tidak ditemukan</p>
                <p className="text-xs text-slate-400 mt-1">
                  Coba kata kunci lain atau periksa stok di menu Inventaris.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3">
                {filteredProducts.map((p) => {
                  const isOutOfStock = p.currentStock <= 0;
                  const isLowStock = p.currentStock > 0 && p.currentStock <= p.minStock;

                  return (
                    <button
                      key={p.id}
                      onClick={() => handleAddToCart(p)}
                      disabled={isOutOfStock}
                      className={`relative p-2.5 sm:p-3 rounded-2xl border text-left flex flex-col justify-between transition-all select-none group cursor-pointer ${
                        isOutOfStock
                          ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                          : 'bg-white border-slate-200/80 hover:border-emerald-500 hover:shadow-md hover:ring-2 hover:ring-emerald-500/20 active:scale-[0.98]'
                      }`}
                    >
                      <div>
                        {/* SKU & Stock Badge */}
                        <div className="flex items-center justify-between gap-1 mb-1.5 sm:mb-2">
                          <span className="text-[10px] font-mono text-slate-500 truncate">
                            {p.sku}
                          </span>
                          {isOutOfStock ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                              Habis
                            </span>
                          ) : isLowStock ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              Sisa {p.currentStock}
                            </span>
                          ) : (
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              Stok {p.currentStock}
                            </span>
                          )}
                        </div>

                        {/* Product Title */}
                        <h3 className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 line-clamp-2 leading-tight">
                          {p.name}
                        </h3>
                      </div>

                      {/* Selling Price & Unit */}
                      <div className="mt-2.5 sm:mt-3 pt-2 border-t border-slate-100 flex items-baseline justify-between">
                        <span className="text-xs font-black text-emerald-700 tracking-tight">
                          Rp {p.sellingPrice.toLocaleString('id-ID')}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">{p.unit}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart Panel */}
        <div
          className={`w-full lg:w-80 xl:w-96 shrink-0 h-full bg-white z-20 ${
            mobileTab === 'catalog' ? 'hidden lg:flex flex-col' : 'flex flex-col'
          }`}
        >
          {/* Mobile Back Button in Cart Header */}
          <div className="lg:hidden p-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <button
              onClick={() => setMobileTab('catalog')}
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali Pilih Produk (Katalog)</span>
            </button>
            <span className="text-xs text-slate-300 font-mono">
              {cartItems.reduce((s, i) => s + i.qty, 0)} item
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            <CartPanel
              items={cartItems}
              onUpdateQty={handleUpdateQty}
              onRemoveItem={handleRemoveItem}
              onClearCart={handleResetCart}
              selectedCustomer={selectedCustomer}
              onSelectCustomer={setSelectedCustomer}
              customerName={customerName}
              setCustomerName={setCustomerName}
              orderNotes={orderNotes}
              setOrderNotes={setOrderNotes}
              orderDiscount={orderDiscount}
              setOrderDiscount={setOrderDiscount}
              pointsToRedeem={pointsToRedeem}
              onChangePointsToRedeem={setPointsToRedeem}
              onHoldOrder={handleHoldCurrentOrder}
              onOpenHoldModal={() => setHoldModalOpen(true)}
              holdCount={holdCount}
              onOpenPayment={() => setPaymentOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Floating Bottom Cart Bar for Mobile when browsing Catalog and Cart has items */}
      {cartItems.length > 0 && mobileTab === 'catalog' && (
        <div className="lg:hidden fixed bottom-16 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl flex items-center justify-between z-30 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 relative">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-600 text-white rounded-full text-[10px] font-black flex items-center justify-center">
                {cartItems.reduce((s, i) => s + i.qty, 0)}
              </span>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-semibold uppercase leading-none">
                Total Keranjang
              </div>
              <div className="text-sm font-black text-slate-900 font-mono mt-0.5 leading-none">
                Rp {grandTotal.toLocaleString('id-ID')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileTab('cart')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors min-h-[40px]"
            >
              Rincian
            </button>
            <button
              onClick={() => setPaymentOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 cursor-pointer transition-all min-h-[40px]"
            >
              <span>Bayar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Recent Transactions Drawer Modal */}
      {isRecentSalesOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Transaksi Terakhir Hari Ini</h3>
              </div>
              <button
                onClick={() => setRecentSalesOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {recentSales.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Belum ada transaksi tersimpan.
                </div>
              ) : (
                recentSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white shadow-2xs space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-slate-900 font-mono text-xs">
                          {sale.receiptNo}
                        </span>
                        <div className="text-[11px] text-slate-500">
                          {new Date(sale.timestamp).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          &bull; Kasir: {sale.cashierName}
                        </div>
                      </div>
                      <span className="font-black text-sm text-emerald-700">
                        Rp {sale.grandTotal.toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-100 flex items-center justify-between">
                      <span>{sale.items.length} jenis item</span>
                      <button
                        onClick={() => {
                          setCompletedSale(sale);
                          setReceiptOpen(true);
                        }}
                        className="flex items-center gap-1 text-slate-700 hover:text-emerald-700 font-bold cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Cetak Ulang</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setRecentSalesOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-200 text-slate-700 hover:bg-slate-300"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Payment Modal */}
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setPaymentOpen(false)}
        cartItems={cartItems}
        subtotal={subtotal}
        orderDiscount={orderDiscount}
        taxAmount={taxAmount}
        taxRatePercent={taxRate}
        grandTotal={grandTotal}
        selectedCustomer={selectedCustomer}
        pointsToRedeem={pointsToRedeem}
        pointsDiscountAmount={pointsDiscountAmount}
        pointsToEarn={pointsToEarn}
        customerName={selectedCustomer ? selectedCustomer.name : customerName}
        orderNotes={orderNotes}
        onPaymentSuccess={handlePaymentSuccess}
      />


      {/* 5. Thermal Printable Receipt Modal */}
      <ReceiptModal
        sale={completedSale}
        isOpen={isReceiptOpen}
        onClose={() => setReceiptOpen(false)}
        onNewTransaction={() => {
          setReceiptOpen(false);
          setCompletedSale(null);
        }}
      />

      {/* 6. Hold / Parked Orders Modal */}
      <HoldOrdersModal
        isOpen={isHoldModalOpen}
        onClose={() => setHoldModalOpen(false)}
        onResumeOrder={handleResumeHoldOrder}
      />

      {/* 7. Camera Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setCameraScannerOpen(false)}
        products={products}
        onProductScanned={(prod) => {
          handleAddToCart(prod);
          showToast(`Scan berhasil: ${prod.name} (+1)`, 'info');
        }}
        playBeep={playBeep}
      />
    </div>
  );
};

export default POSDashboard;
