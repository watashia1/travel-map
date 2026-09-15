import React from 'react';
import { PlaceRecord } from '../types';
import { MapPin } from 'lucide-react';

interface AmbiguityModalProps {
  isOpen: boolean;
  placeName: string;
  candidates: PlaceRecord[];
  onSelectCandidate: (candidate: PlaceRecord) => void;
  onCancel: () => void;
}

export const AmbiguityModal: React.FC<AmbiguityModalProps> = ({
  isOpen,
  placeName,
  candidates,
  onSelectCandidate,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 border border-slate-200">
        <h3 className="text-base font-semibold text-slate-800 mb-1">
          发现多个同名地点：“{placeName}”
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          请点击选择您实际要标记的目标位置：
        </p>

        <div className="space-y-2 max-h-60 overflow-y-auto mb-4 pr-1">
          {candidates.map((cand, idx) => (
            <button
              key={`${cand.name}-${idx}`}
              onClick={() => onSelectCandidate(cand)}
              className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition flex items-start space-x-3 group"
            >
              <div className="p-1.5 bg-blue-100/60 text-blue-600 rounded mt-0.5 group-hover:bg-blue-500 group-hover:text-white transition">
                <MapPin size={16} />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-800 group-hover:text-blue-600">
                  {cand.displayName}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {cand.country} · 经纬度 ({cand.lat.toFixed(4)}, {cand.lon.toFixed(4)})
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            稍后选择
          </button>
        </div>
      </div>
    </div>
  );
};