import React from 'react';
import { ReceiptSettingsPanel } from './ReceiptSettingsPanel';
import { X, Receipt } from 'lucide-react';

interface ReceiptSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptSettingsModal: React.FC<ReceiptSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] my-4">
        {/* Modal Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between no-print">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Pengaturan Format Struk & Identitas Toko
              </h3>
              <p className="text-xs text-slate-500">
                Ubah nama toko, alamat, dan catatan kaki struk yang dicetak
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <ReceiptSettingsPanel isModal={true} onClose={onClose} onSaved={onClose} />
        </div>
      </div>
    </div>
  );
};
