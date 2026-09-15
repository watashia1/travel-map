import React, { useState } from 'react';
import { Place, PlaceRecord } from '../types';
import {
  MapPin,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Trash2,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Sparkles,
  Plus,
  GripVertical
} from 'lucide-react';
import { parseCoordinateLine } from '../parser/coordinates';

interface PlaceListProps {
  places: Place[];
  onAddPlace: (inputLine: string) => void;
  onBatchUpdate: (inputText: string) => void;
  onReorderPlaces: (newPlaces: Place[]) => void;
  onDeletePlace: (placeId: string) => void;
  onRequestClearAll: () => void;
  onResetPlaceOffset: (placeId: string) => void;
  onResolveAmbiguity: (placeId: string, candidate: PlaceRecord) => void;
  onManualResolveCoord: (placeId: string, lat: number, lon: number) => void;
}

export const PlaceList: React.FC<PlaceListProps> = ({
  places,
  onBatchUpdate,
  onReorderPlaces,
  onDeletePlace,
  onRequestClearAll,
  onResetPlaceOffset,
  onResolveAmbiguity,
  onManualResolveCoord
}) => {
  const [inputText, setInputText] = useState('');
  const [editingCoordId, setEditingCoordId] = useState<string | null>(null);
  const [manualCoordInput, setManualCoordInput] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleParseClick = () => {
    if (!inputText.trim()) return;
    onBatchUpdate(inputText);
    setInputText('');
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= places.length) return;

    const updated = [...places];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const reindexed = updated.map((p, idx) => ({ ...p, order: idx }));
    onReorderPlaces(reindexed);
  };

  // HTML5 Drag and Drop Reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...places];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, movedItem);

    const reindexed = updated.map((p, idx) => ({ ...p, order: idx }));
    onReorderPlaces(reindexed);

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleManualCoordSubmit = (placeId: string) => {
    const parsed = parseCoordinateLine(manualCoordInput);
    if (parsed.isCoordinate) {
      onManualResolveCoord(placeId, parsed.lat, parsed.lon);
      setEditingCoordId(null);
      setManualCoordInput('');
    } else {
      alert('请输入有效的“纬度, 经度”，例如：35.6762, 139.6503');
    }
  };

  const loadSamplePreset = () => {
    const sample = `东京
43.0618, 141.3545 | 札幌
奥斯陆
64.1466, -21.9426 | 雷克雅未克
78.2232, 15.6469 | 朗伊尔城`;
    onBatchUpdate(sample);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Input Area */}
      <div className="p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            输入地点或坐标 (一行一个)
          </label>
          <button
            onClick={loadSamplePreset}
            className="text-xs text-blue-600 hover:text-blue-700 flex items-center hover:underline"
            title="一键加载官方验收示例"
          >
            <Sparkles size={12} className="mr-1" />
            填入示例
          </button>
        </div>

        <textarea
          rows={4}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder={`例如：\n东京\n43.0618, 141.3545 | 札幌\n奥斯陆\n64.1466, -21.9426 | 雷克雅未克`}
          className="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none leading-relaxed"
        />

        <div className="mt-2.5 flex justify-between items-center">
          <button
            onClick={handleParseClick}
            disabled={!inputText.trim()}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-medium rounded-lg transition flex items-center shadow-sm"
          >
            <Plus size={14} className="mr-1" />
            生成路线 / 添加
          </button>

          {places.length > 0 && (
            <button
              onClick={onRequestClearAll}
              className="text-xs text-red-500 hover:text-red-700 hover:underline"
            >
              清空地点
            </button>
          )}
        </div>
      </div>

      {/* Places List Header */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-xs text-slate-500">
        <span>已添加地点 ({places.length})</span>
        <span className="text-[11px]">长按抓手自由拖动排序 · 路线自动连线</span>
      </div>

      {/* Places Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {places.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <MapPin size={28} className="mx-auto mb-2 text-slate-300" />
            暂无地点，请在上方输入框添加地名或坐标
          </div>
        ) : (
          places.map((place, index) => {
            const hasManualOffset =
              (place.manualOffsetX && place.manualOffsetX !== 0) ||
              (place.manualOffsetY && place.manualOffsetY !== 0) ||
              (place.labelOffsetX && place.labelOffsetX !== 12) ||
              (place.labelOffsetY && place.labelOffsetY !== -12);

            const isDragged = draggedIndex === index;
            const isDragOver = dragOverIndex === index;

            return (
              <div
                key={place.id}
                draggable
                onDragStart={e => handleDragStart(e, index)}
                onDragOver={e => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`p-2.5 rounded-lg border transition bg-white shadow-sm hover:shadow ${
                  isDragged ? 'opacity-40 border-dashed border-blue-400' : ''
                } ${isDragOver ? 'border-t-2 border-t-blue-600 bg-blue-50/20' : ''} ${
                  place.status === 'unresolved'
                    ? 'border-amber-300 bg-amber-50/30'
                    : place.status === 'ambiguous'
                    ? 'border-blue-300 bg-blue-50/30'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  {/* Left: Drag Handle, Sequence Number and Place Name */}
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600 p-0.5 shrink-0">
                      <GripVertical size={15} />
                    </div>

                    <span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 text-slate-700 text-xs font-bold shrink-0">
                      {index + 1}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs font-semibold text-slate-800 truncate">
                          {place.displayName}
                        </span>

                        {place.status === 'resolved' && (
                          <span title="已成功定位">
                            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          </span>
                        )}
                        {place.status === 'ambiguous' && (
                          <span title="有多处同名地点">
                            <HelpCircle size={13} className="text-blue-500 shrink-0" />
                          </span>
                        )}
                        {place.status === 'unresolved' && (
                          <span title="未在本地数据库中查找到">
                            <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {place.status === 'resolved' ? (
                          `${place.lat.toFixed(4)}, ${place.lon.toFixed(4)}`
                        ) : place.status === 'ambiguous' ? (
                          <span className="text-blue-600">存在歧义，点击下方选择</span>
                        ) : (
                          <span className="text-amber-600">未识别，可手动填入坐标</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions: Move, Reset, Delete */}
                  <div className="flex items-center space-x-1 shrink-0 ml-2">
                    {hasManualOffset && (
                      <button
                        onClick={() => onResetPlaceOffset(place.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition"
                        title="恢复红点和文字自动位置"
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}

                    <button
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0}
                      className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 rounded hover:bg-slate-100 transition"
                      title="上移"
                    >
                      <ChevronUp size={14} />
                    </button>

                    <button
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === places.length - 1}
                      className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 rounded hover:bg-slate-100 transition"
                      title="下移"
                    >
                      <ChevronDown size={14} />
                    </button>

                    {/* Single item delete without modal confirmation (undoable via Ctrl+Z) */}
                    <button
                      onClick={() => onDeletePlace(place.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition"
                      title="删除此地点 (Ctrl+Z 可撤销)"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Ambiguity Resolution Options */}
                {place.status === 'ambiguous' && place.ambiguousCandidates && (
                  <div className="mt-2 pt-2 border-t border-blue-100 space-y-1">
                    <div className="text-[10px] text-blue-700 font-medium">请选择精确地点：</div>
                    {place.ambiguousCandidates.map((cand, cIdx) => (
                      <button
                        key={cIdx}
                        onClick={() => onResolveAmbiguity(place.id, cand)}
                        className="w-full text-left px-2 py-1 text-xs bg-white rounded border border-blue-200 hover:bg-blue-50 text-slate-700 flex justify-between"
                      >
                        <span>{cand.displayName} ({cand.country})</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {cand.lat.toFixed(2)}, {cand.lon.toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Unresolved Manual Coordinate Entry */}
                {place.status === 'unresolved' && (
                  <div className="mt-2 pt-2 border-t border-amber-100">
                    {editingCoordId === place.id ? (
                      <div className="flex space-x-1 mt-1">
                        <input
                          type="text"
                          value={manualCoordInput}
                          onChange={e => setManualCoordInput(e.target.value)}
                          placeholder="例如: 35.6762, 139.6503"
                          className="flex-1 text-xs px-2 py-1 border border-amber-300 rounded font-mono"
                        />
                        <button
                          onClick={() => handleManualCoordSubmit(place.id)}
                          className="px-2 py-1 bg-amber-600 text-white rounded text-xs"
                        >
                          确定
                        </button>
                        <button
                          onClick={() => setEditingCoordId(null)}
                          className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingCoordId(place.id);
                          setManualCoordInput('');
                        }}
                        className="text-[11px] text-amber-700 hover:underline font-medium"
                      >
                        + 手动输入经纬度定位
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};