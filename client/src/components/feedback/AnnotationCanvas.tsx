import { useRef, useEffect, useState, useCallback } from 'react';
import { Pen, Circle, Highlighter, Undo2, Redo2 } from 'lucide-react';
import type { AnnotationCommand } from '../../types';

type Tool = 'freehand' | 'circle' | 'highlight';

interface Props {
  imageUrl: string;
  annotations: AnnotationCommand[];
  onChange: (annotations: AnnotationCommand[]) => void;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

function drawAnnotations(ctx: CanvasRenderingContext2D, annotations: AnnotationCommand[], scaleX: number, scaleY: number) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const cmd of annotations) {
    ctx.strokeStyle = cmd.color;
    ctx.lineWidth = (cmd.lineWidth ?? 3) * Math.min(scaleX, scaleY);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (cmd.tool === 'freehand' && cmd.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(cmd.points[0].x * scaleX, cmd.points[0].y * scaleY);
      for (let i = 1; i < cmd.points.length; i++) {
        ctx.lineTo(cmd.points[i].x * scaleX, cmd.points[i].y * scaleY);
      }
      ctx.stroke();
    } else if (cmd.tool === 'circle' && cmd.points.length >= 2) {
      const p0 = cmd.points[0];
      const p1 = cmd.points[cmd.points.length - 1];
      const cx = ((p0.x + p1.x) / 2) * scaleX;
      const cy = ((p0.y + p1.y) / 2) * scaleY;
      const rx = (Math.abs(p1.x - p0.x) / 2) * scaleX;
      const ry = (Math.abs(p1.y - p0.y) / 2) * scaleY;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (cmd.tool === 'highlight' && cmd.points.length >= 2) {
      const p0 = cmd.points[0];
      const p1 = cmd.points[cmd.points.length - 1];
      const hexColor = cmd.color;
      ctx.fillStyle = hexColor + '55'; // 33% opacity
      ctx.strokeStyle = hexColor + '88';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(
        Math.min(p0.x, p1.x) * scaleX,
        Math.min(p0.y, p1.y) * scaleY,
        Math.abs(p1.x - p0.x) * scaleX,
        Math.abs(p1.y - p0.y) * scaleY
      );
      ctx.fill();
      ctx.stroke();
    }
  }
}

export default function AnnotationCanvas({ imageUrl, annotations, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [tool, setTool] = useState<Tool>('freehand');
  const [color, setColor] = useState('#ef4444');
  const [naturalW, setNaturalW] = useState(0);
  const [naturalH, setNaturalH] = useState(0);
  const [redoStack, setRedoStack] = useState<AnnotationCommand[]>([]);
  const drawing = useRef(false);
  const currentCmd = useRef<AnnotationCommand | null>(null);

  // Redraw whenever annotations or canvas size changes
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !naturalW || !naturalH) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scaleX = canvas.width / naturalW;
    const scaleY = canvas.height / naturalH;
    drawAnnotations(ctx, annotations, scaleX, scaleY);
  }, [annotations, naturalW, naturalH]);

  useEffect(() => { redraw(); }, [redraw]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); handleUndo(); }
      if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); handleRedo(); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations, redoStack]);

  function getPos(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = naturalW / canvas.width;
    const scaleY = naturalH / canvas.height;
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: ((clientX - rect.left) * (canvas.width / rect.width)) * scaleX,
      y: ((clientY - rect.top) * (canvas.height / rect.height)) * scaleY,
    };
  }

  function onPointerDown(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const pos = getPos(e);
    currentCmd.current = { tool, color, points: [pos], lineWidth: tool === 'highlight' ? 8 : 3 };
  }

  function onPointerMove(e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) {
    if (!drawing.current || !currentCmd.current) return;
    const pos = getPos(e);
    currentCmd.current.points.push(pos);

    // Live preview
    const canvas = canvasRef.current;
    if (!canvas || !naturalW) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const scaleX = canvas.width / naturalW;
    const scaleY = canvas.height / naturalH;
    drawAnnotations(ctx, [...annotations, currentCmd.current], scaleX, scaleY);
  }

  function onPointerUp() {
    if (!drawing.current || !currentCmd.current) return;
    drawing.current = false;
    if (currentCmd.current.points.length >= 2) {
      onChange([...annotations, currentCmd.current]);
      setRedoStack([]); // new stroke clears redo history
    }
    currentCmd.current = null;
  }

  function handleUndo() {
    if (annotations.length === 0) return;
    const last = annotations[annotations.length - 1];
    setRedoStack(prev => [last, ...prev]);
    onChange(annotations.slice(0, -1));
  }

  function handleRedo() {
    if (redoStack.length === 0) return;
    const [next, ...rest] = redoStack;
    setRedoStack(rest);
    onChange([...annotations, next]);
  }

  function onImageLoad() {
    const img = imgRef.current!;
    setNaturalW(img.naturalWidth);
    setNaturalH(img.naturalHeight);
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Tool buttons */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {([
            { t: 'freehand' as Tool, Icon: Pen, label: 'Draw' },
            { t: 'circle' as Tool, Icon: Circle, label: 'Circle' },
            { t: 'highlight' as Tool, Icon: Highlighter, label: 'Highlight' },
          ]).map(({ t, Icon, label }) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              title={label}
              className={`p-1.5 rounded-md transition-colors ${tool === t ? 'bg-white dark:bg-gray-700 shadow text-theme' : 'text-muted hover:text-theme'}`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        {/* Color swatches */}
        <div className="flex items-center gap-1">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              title={c}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${color === c ? 'border-gray-800 dark:border-white scale-125' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* Undo / Redo */}
        <div className="ml-auto flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={handleUndo}
            disabled={annotations.length === 0}
            title="Undo (Ctrl+Z)"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium text-muted hover:text-theme hover:bg-white dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <Undo2 className="h-3.5 w-3.5" />
            <span className="text-xs">Undo</span>
          </button>
          <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-0.5" />
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Redo (Ctrl+Y)"
            className="flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium text-muted hover:text-theme hover:bg-white dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <span className="text-xs">Redo</span>
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Canvas over image */}
      <div ref={containerRef} className="relative w-full overflow-hidden rounded-lg border border-surface-hover bg-gray-100 dark:bg-gray-900">
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Screenshot"
          onLoad={onImageLoad}
          className="w-full h-auto block"
          draggable={false}
          style={{ userSelect: 'none' }}
        />
        <canvas
          ref={canvasRef}
          width={naturalW || 800}
          height={naturalH || 600}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            cursor: tool === 'highlight' ? 'crosshair' : 'crosshair',
            touchAction: 'none',
          }}
        />
      </div>
      <p className="text-xs text-muted text-center">
        {tool === 'freehand' ? 'Draw freely on the screenshot' : tool === 'circle' ? 'Drag to draw a circle' : 'Drag to highlight an area'}
      </p>
    </div>
  );
}
