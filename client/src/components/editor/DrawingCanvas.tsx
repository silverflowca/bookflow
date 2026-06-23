import { useRef, useState, useEffect, useCallback } from 'react';
import { X, Trash2, Undo2, Check, Minus, Square, Circle, Triangle, Minus as LineIcon, Pencil } from 'lucide-react';
import type { DrawingData } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool = 'pen' | 'line' | 'rect' | 'ellipse' | 'triangle' | 'eraser';

interface DrawingCanvasProps {
  initialData?: DrawingData;
  onSave: (data: DrawingData) => void;
  onClose: () => void;
}

// ─── Colour palette ──────────────────────────────────────────────────────────

const COLORS = [
  '#000000', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#ffffff',
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6',
  '#EC4899', '#14B8A6', '#6366F1', '#F59E0B', '#10B981', '#0EA5E9',
];

const STROKE_SIZES = [2, 4, 8, 14, 22];
const ERASER_SIZES = [10, 20, 40, 60];

const WIDTH_OPTIONS: { label: string; value: DrawingData['width'] }[] = [
  { label: 'Small', value: 'small' },
  { label: 'Medium', value: 'medium' },
  { label: 'Large', value: 'large' },
  { label: 'Full', value: 'full' },
];

// ─── Canvas helpers ───────────────────────────────────────────────────────────

function getCanvasPoint(canvas: HTMLCanvasElement, e: { clientX: number; clientY: number }): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DrawingCanvas({ initialData, onSave, onClose }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null); // live preview layer for shapes
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#000000');
  const [strokeSize, setStrokeSize] = useState(4);
  const [eraserSize, setEraserSize] = useState(20);
  const [displayWidth, setDisplayWidth] = useState<DrawingData['width']>('full');
  const [title, setTitle] = useState(initialData?.title ?? '');
  const [caption, setCaption] = useState(initialData?.caption ?? '');

  // Undo stack — each entry is a full canvas ImageData snapshot
  const undoStack = useRef<ImageData[]>([]);

  // Drawing state refs (not React state to avoid re-renders during draw)
  const isDrawing = useRef(false);
  const startPt = useRef<{ x: number; y: number } | null>(null);

  // ── Canvas init ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // If editing, load existing drawing
    if (initialData?.dataUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = initialData.dataUrl;
    }
    // Push initial state
    undoStack.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
    if (initialData?.width) setDisplayWidth(initialData.width);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Snapshot for undo ────────────────────────────────────────────────────────

  const pushUndo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    undoStack.current = [...undoStack.current.slice(-30), ctx.getImageData(0, 0, canvas.width, canvas.height)];
  }, []);

  const handleUndo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || undoStack.current.length <= 1) return;
    const ctx = canvas.getContext('2d')!;
    undoStack.current = undoStack.current.slice(0, -1);
    ctx.putImageData(undoStack.current[undoStack.current.length - 1], 0, 0);
  }, []);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    pushUndo();
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    pushUndo();
  }, [pushUndo]);

  // ── Shape drawing helpers ─────────────────────────────────────────────────

  function drawShape(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }, clear?: () => void) {
    if (clear) clear();
    ctx.lineWidth = strokeSize;
    ctx.strokeStyle = color;
    ctx.fillStyle = 'transparent';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const w = to.x - from.x;
    const h = to.y - from.y;

    ctx.beginPath();
    switch (tool) {
      case 'line':
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        break;
      case 'rect':
        ctx.strokeRect(from.x, from.y, w, h);
        break;
      case 'ellipse': {
        const cx = from.x + w / 2;
        const cy = from.y + h / 2;
        ctx.ellipse(cx, cy, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'triangle':
        ctx.moveTo(from.x + w / 2, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.lineTo(from.x, to.y);
        ctx.closePath();
        ctx.stroke();
        break;
    }
  }

  // ── Pointer event handlers ─────────────────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    canvas.setPointerCapture(e.pointerId);
    pushUndo();
    isDrawing.current = true;
    const pt = getCanvasPoint(canvas, e.nativeEvent);
    startPt.current = pt;

    if (tool === 'pen' || tool === 'eraser') {
      const ctx = canvas.getContext('2d')!;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
    }
  }, [tool, pushUndo]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const pt = getCanvasPoint(canvas, e.nativeEvent);

    if (tool === 'pen') {
      const ctx = canvas.getContext('2d')!;
      ctx.lineWidth = strokeSize;
      ctx.strokeStyle = color;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
    } else if (tool === 'eraser') {
      const ctx = canvas.getContext('2d')!;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, eraserSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Re-fill transparent areas with white
      const ctx2 = canvas.getContext('2d')!;
      ctx2.save();
      ctx2.globalCompositeOperation = 'destination-over';
      ctx2.fillStyle = '#ffffff';
      ctx2.fillRect(0, 0, canvas.width, canvas.height);
      ctx2.restore();
    } else if (startPt.current) {
      // Shape preview on overlay canvas
      const octx = overlay.getContext('2d')!;
      octx.clearRect(0, 0, overlay.width, overlay.height);
      drawShape(octx, startPt.current, pt);
    }
  }, [tool, color, strokeSize, eraserSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const pt = getCanvasPoint(canvas, e.nativeEvent);

    if (startPt.current && tool !== 'pen' && tool !== 'eraser') {
      // Commit shape from overlay to main canvas
      const ctx = canvas.getContext('2d')!;
      drawShape(ctx, startPt.current, pt);
      const octx = overlay.getContext('2d')!;
      octx.clearRect(0, 0, overlay.width, overlay.height);
    }
    startPt.current = null;
  }, [tool]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave({
      dataUrl,
      title: title.trim() || undefined,
      caption: caption.trim() || undefined,
      width: displayWidth,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    });
  }, [title, caption, displayWidth, onSave]);

  // ── Keyboard shortcut: Ctrl+Z ─────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo]);

  // ── Cursor ────────────────────────────────────────────────────────────────

  const cursorStyle: React.CSSProperties = tool === 'eraser'
    ? { cursor: `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='${eraserSize}' height='${eraserSize}'><circle cx='${eraserSize/2}' cy='${eraserSize/2}' r='${eraserSize/2-1}' fill='none' stroke='%23666' stroke-width='1'/></svg>") ${eraserSize/2} ${eraserSize/2}, crosshair` }
    : tool === 'pen'
      ? { cursor: 'crosshair' }
      : { cursor: 'crosshair' };

  // ─── Render ────────────────────────────────────────────────────────────────

  const TOOLS: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'pen',      icon: <Pencil className="h-4 w-4" />,  label: 'Pen' },
    { id: 'line',     icon: <LineIcon className="h-4 w-4" />, label: 'Line' },
    { id: 'rect',     icon: <Square className="h-4 w-4" />,  label: 'Rectangle' },
    { id: 'ellipse',  icon: <Circle className="h-4 w-4" />,  label: 'Ellipse' },
    { id: 'triangle', icon: <Triangle className="h-4 w-4" />, label: 'Triangle' },
    { id: 'eraser',   icon: <Minus className="h-4 w-4" />,   label: 'Eraser' },
  ];

  const currentSizes = tool === 'eraser' ? ERASER_SIZES : STROKE_SIZES;
  const currentSize = tool === 'eraser' ? eraserSize : strokeSize;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-2" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[96vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
        ref={containerRef}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
          <h2 className="font-bold text-base flex-1">Drawing</h2>

          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="px-2 py-1 border rounded text-sm w-36 hidden sm:block"
          />

          {/* Display width */}
          <div className="flex gap-1 hidden sm:flex">
            {WIDTH_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDisplayWidth(opt.value)}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  displayWidth === opt.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button onClick={handleUndo} title="Undo (Ctrl+Z)" className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
            <Undo2 className="h-4 w-4" />
          </button>
          <button onClick={handleClear} title="Clear canvas" className="p-1.5 rounded hover:bg-red-50 text-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Check className="h-4 w-4" /> Add to Book
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 min-h-0">

          {/* ── Left sidebar: tools, colours, sizes ── */}
          <div className="flex flex-col gap-4 p-3 border-r shrink-0 w-14 sm:w-52 overflow-y-auto">

            {/* Tool buttons */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 hidden sm:block">Tool</p>
              <div className="flex flex-col gap-1">
                {TOOLS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTool(t.id)}
                    title={t.label}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                      tool === t.id
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {t.icon}
                    <span className="hidden sm:inline">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Stroke / eraser size */}
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 hidden sm:block">
                {tool === 'eraser' ? 'Eraser Size' : 'Stroke'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {currentSizes.map(sz => (
                  <button
                    key={sz}
                    onClick={() => tool === 'eraser' ? setEraserSize(sz) : setStrokeSize(sz)}
                    title={`${sz}px`}
                    className={`rounded-full border-2 transition-all flex items-center justify-center ${
                      currentSize === sz
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    style={{ width: 28, height: 28 }}
                  >
                    <span
                      className="rounded-full bg-gray-700"
                      style={{
                        width: Math.min(sz, 20),
                        height: Math.min(sz, 20),
                        background: tool === 'eraser' ? '#e5e7eb' : '#374151',
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Colour palette */}
            {tool !== 'eraser' && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 hidden sm:block">Colour</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      title={c}
                      className={`rounded-lg border-2 transition-all ${
                        color === c ? 'border-blue-500 scale-110' : 'border-gray-200 hover:border-gray-400'
                      }`}
                      style={{ width: 24, height: 24, background: c }}
                    />
                  ))}
                </div>
                {/* Custom colour picker */}
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-[10px] text-gray-400 hidden sm:block">Custom:</label>
                  <input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                    title="Pick a custom colour"
                  />
                  <span
                    className="text-xs text-gray-500 font-mono hidden sm:block"
                  >{color}</span>
                </div>
              </div>
            )}

            {/* Caption (mobile-hidden, shown on wider sidebar) */}
            <div className="hidden sm:block">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Caption</p>
              <input
                type="text"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Caption (optional)"
                className="w-full px-2 py-1 border rounded text-xs"
              />
            </div>
          </div>

          {/* ── Canvas area ── */}
          <div className="flex-1 min-w-0 bg-gray-100 flex items-center justify-center p-2 overflow-auto">
            <div className="relative shadow-lg" style={{ lineHeight: 0 }}>
              {/* Main canvas */}
              <canvas
                ref={canvasRef}
                width={800}
                height={500}
                className="rounded-lg block bg-white"
                style={{ ...cursorStyle, maxWidth: '100%', touchAction: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
              {/* Overlay canvas for live shape preview */}
              <canvas
                ref={overlayRef}
                width={800}
                height={500}
                className="absolute inset-0 rounded-lg pointer-events-none"
                style={{ maxWidth: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* ── Mobile-only bottom bar for title/caption/width ── */}
        <div className="sm:hidden flex items-center gap-2 px-3 py-2 border-t shrink-0 flex-wrap">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title"
            className="flex-1 px-2 py-1 border rounded text-sm min-w-0"
          />
          <input
            type="text"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Caption"
            className="flex-1 px-2 py-1 border rounded text-sm min-w-0"
          />
          <div className="flex gap-1">
            {WIDTH_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDisplayWidth(opt.value)}
                className={`px-2 py-1 text-xs rounded border ${
                  displayWidth === opt.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                {opt.label[0]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
