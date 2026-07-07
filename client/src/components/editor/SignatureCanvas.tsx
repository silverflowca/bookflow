import { useRef, useEffect, useState, useCallback } from 'react';
import { Trash2 } from 'lucide-react';

interface Props {
  readOnly?: boolean;
  defaultValue?: string; // data URL to pre-fill
  onSave?: (dataUrl: string) => void;
  height?: number;
}

export default function SignatureCanvas({ readOnly = false, defaultValue, onSave, height = 120 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Pre-fill from defaultValue
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !defaultValue) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setHasStrokes(true);
    };
    img.src = defaultValue;
  }, [defaultValue]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || readOnly) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e, canvas);
    if (lastPos.current) {
      ctx.beginPath();
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--color-text') || '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    lastPos.current = pos;
    setHasStrokes(true);
  };

  const endDraw = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (canvas && onSave) {
      onSave(canvas.toDataURL('image/png'));
    }
  }, [isDrawing, onSave]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
    if (onSave) onSave('');
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={600}
        height={height * 5}
        className="w-full rounded-lg border border-theme bg-white touch-none"
        style={{ height, cursor: readOnly ? 'default' : 'crosshair' }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      {!readOnly && hasStrokes && (
        <button
          type="button"
          onClick={clear}
          className="absolute top-2 right-2 p-1 rounded bg-white/80 border border-theme text-muted hover:text-red-500 hover:border-red-300 transition-colors"
          title="Clear signature"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      {!readOnly && !hasStrokes && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted opacity-50 select-none">
          Draw your signature here
        </span>
      )}
    </div>
  );
}
