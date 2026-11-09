import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats, CameraDevice } from 'html5-qrcode';
import { Product } from '../../types';
import {
  X,
  Camera,
  Flashlight,
  FlashlightOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  VolumeX,
  Layers,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onProductScanned: (product: Product) => void;
  playBeep?: (freq?: number, type?: OscillatorType, duration?: number) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  onProductScanned,
  playBeep,
}) => {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);
  const [lastScannedResult, setLastScannedResult] = useState<{
    code: string;
    product?: Product;
    timestamp: number;
    success: boolean;
  } | null>(null);
  const [scannedCount, setScannedCount] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'barcode-camera-scanner-view';
  const lastCodeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  // Load available cameras when modal opens
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      return;
    }

    let isMounted = true;
    setErrorMessage(null);
    setLastScannedResult(null);
    setScannedCount(0);

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back/rear camera if available
          const backCam = devices.find(
            (d) =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment')
          );
          const chosenId = backCam ? backCam.id : devices[0].id;
          setSelectedCameraId(chosenId);
          startScanner(chosenId);
        } else {
          setErrorMessage('Tidak ada kamera yang terdeteksi pada perangkat Anda.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Camera access error:', err);
        setErrorMessage(
          'Izin kamera tidak diberikan atau diblokir oleh browser. Pastikan izin kamera aktif di browser settings.'
        );
      });

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = async (cameraId: string) => {
    try {
      await stopScanner();

      const html5QrCode = new Html5Qrcode(readerElementId);
      scannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: { width: 280, height: 180 },
        aspectRatio: 1.333333,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
      };

      await html5QrCode.start(
        cameraId,
        config,
        (decodedText) => {
          handleDetectedBarcode(decodedText);
        },
        () => {
          // Ignore individual frame miss
        }
      );

      setIsScanning(true);
      setErrorMessage(null);

      // Check torch capability
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities() as any;
        if (capabilities && capabilities.torch) {
          setTorchSupported(true);
        } else {
          setTorchSupported(false);
        }
      } catch {
        setTorchSupported(false);
      }
    } catch (err: any) {
      console.error('Failed to start camera scanner:', err);
      setIsScanning(false);
      setErrorMessage(
        err?.message || 'Gagal memulai streaming kamera. Pastikan kamera tidak sedang dipakai aplikasi lain.'
      );
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      } finally {
        scannerRef.current = null;
        setIsScanning(false);
      }
    }
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !torchSupported) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as any],
      });
      setTorchOn(nextState);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  };

  const switchCamera = async (newCameraId: string) => {
    setSelectedCameraId(newCameraId);
    await startScanner(newCameraId);
  };

  const handleDetectedBarcode = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    // Debounce duplicate scans within 1.5 seconds to avoid spamming cart
    const now = Date.now();
    if (lastCodeRef.current.code === code && now - lastCodeRef.current.time < 1500) {
      return;
    }
    lastCodeRef.current = { code, time: now };

    // Search product in list by barcode or SKU
    const matched = products.find(
      (p) =>
        p.barcode?.toLowerCase() === code.toLowerCase() ||
        p.sku?.toLowerCase() === code.toLowerCase()
    );

    if (matched) {
      // Audio feedback
      if (playBeep) playBeep(1050, 'sine', 0.1);

      // Add to cart
      onProductScanned(matched);
      setScannedCount((c) => c + 1);

      setLastScannedResult({
        code,
        product: matched,
        timestamp: now,
        success: true,
      });

      if (!continuousMode) {
        // If single mode, close scanner after small delay so user sees confirmation
        setTimeout(() => {
          onClose();
        }, 500);
      }
    } else {
      // Product not found
      if (playBeep) playBeep(280, 'sawtooth', 0.2);
      setLastScannedResult({
        code,
        timestamp: now,
        success: false,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col text-white animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                Scanner Barcode Kamera
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Live View
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Arahkan barcode atau QR produk ke dalam kotak bidik
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Tutup (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder & Video Section */}
        <div className="relative bg-black flex flex-col items-center justify-center min-h-[320px] overflow-hidden">
          {/* HTML5 Qrcode target container */}
          <div
            id={readerElementId}
            className="w-full h-full max-h-[360px] overflow-hidden flex items-center justify-center [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
          />

          {/* Scanner Overlay Graphics: Reticle & Laser */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
              {/* Target Bounding Box */}
              <div className="relative w-64 h-44 sm:w-72 sm:h-48 rounded-2xl border border-white/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden">
                {/* 4 Framing Corner Accents */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

                {/* Animated Horizontal Laser Beam */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-pulse absolute" />

                <span className="text-[11px] text-white/70 font-mono tracking-wider drop-shadow-md bg-black/40 px-2.5 py-0.5 rounded-full border border-white/10">
                  Arahkan Barcode Kemari
                </span>
              </div>
            </div>
          )}

          {/* Error Message Fallback */}
          {errorMessage && (
            <div className="absolute inset-0 p-6 flex flex-col items-center justify-center text-center bg-slate-900/95 space-y-3 z-10">
              <div className="p-3 bg-red-500/20 text-red-400 rounded-2xl border border-red-500/30">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold text-red-200 max-w-sm">
                {errorMessage}
              </p>
              <div className="text-xs text-slate-400 max-w-xs space-y-1">
                <p>Tips perbaikan:</p>
                <p>&bull; Izinkan akses kamera pada ikon gembok browser</p>
                <p>&bull; Pastikan perangkat Anda memiliki webcam / kamera belakang aktif</p>
              </div>
              <button
                onClick={() => selectedCameraId && startScanner(selectedCameraId)}
                className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold cursor-pointer border border-slate-700"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Coba Hubungkan Ulang</span>
              </button>
            </div>
          )}

          {/* Quick Hardware Controls inside Viewfinder (Torch & Camera Switch) */}
          {isScanning && (
            <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
              {torchSupported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-2 rounded-xl backdrop-blur-md transition-all cursor-pointer ${
                    torchOn
                      ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_#f59e0b]'
                      : 'bg-black/60 text-white/80 hover:bg-black/80 border border-white/10'
                  }`}
                  title={torchOn ? 'Matikan Senter' : 'Nyalakan Senter'}
                >
                  {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
                </button>
              )}

              {cameras.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
                    const nextIndex = (currentIndex + 1) % cameras.length;
                    switchCamera(cameras[nextIndex].id);
                  }}
                  className="p-2 rounded-xl bg-black/60 text-white/80 hover:bg-black/80 border border-white/10 backdrop-blur-md transition-all cursor-pointer"
                  title="Ganti Kamera Depan / Belakang"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Live Feedback Toast Banner */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          {lastScannedResult ? (
            lastScannedResult.success && lastScannedResult.product ? (
              <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-emerald-300 uppercase tracking-wider">
                        {lastScannedResult.product.sku}
                      </span>
                      <span className="text-[10px] bg-emerald-500/30 text-emerald-200 px-1.5 rounded">
                        +1 Masuk Keranjang
                      </span>
                    </div>
                    <p className="font-bold text-sm text-white truncate">
                      {lastScannedResult.product.name}
                    </p>
                    <p className="text-xs text-emerald-400 font-semibold">
                      Rp {lastScannedResult.product.sellingPrice.toLocaleString('id-ID')}{' '}
                      <span className="text-slate-400 font-normal">
                        (Sisa stok: {lastScannedResult.product.currentStock})
                      </span>
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-900/60 px-2.5 py-1 rounded-lg border border-emerald-700/50">
                    Scan #{scannedCount}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2">
                <div className="p-2 bg-red-500/20 text-red-400 rounded-xl shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-xs text-red-200">
                    Barcode Tidak Dikenali: <code className="text-white font-mono">{lastScannedResult.code}</code>
                  </p>
                  <p className="text-[11px] text-red-300">
                    Produk belum terdaftar di katalog. Tambahkan di menu Inventaris.
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="p-3 bg-slate-800/60 border border-slate-700/50 rounded-2xl flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Mendukung barcode 1D (EAN-13, Code 128) & QR Code</span>
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                {products.length} SKU Aktif
              </span>
            </div>
          )}

          {/* Bottom Settings & Finish Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Continuous Mode Toggle */}
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={continuousMode}
                onChange={(e) => setContinuousMode(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded bg-slate-800 border-slate-700 focus:ring-emerald-500"
              />
              <span>Scan Beruntun (Tetap buka scanner)</span>
            </label>

            {/* Selesai / Tutup Button */}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Selesai ({scannedCount} item terscan)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
