import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  isDangerous = true,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 border border-slate-200">
        <div className="flex items-center space-x-3 mb-3">
          {isDangerous && (
            <div className="p-2 bg-red-50 text-red-600 rounded-full">
              <AlertTriangle size={20} />
            </div>
          )}
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
        </div>
        <p className="text-sm text-slate-600 mb-5 leading-relaxed">{message}</p>
        <div className="flex justify-end space-x-2">
          <button
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium text-white transition ${
              isDangerous ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};