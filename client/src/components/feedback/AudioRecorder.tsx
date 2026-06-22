import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Play, Pause, RotateCcw, AlertCircle } from 'lucide-react';

interface Props {
  onRecordingComplete: (blob: Blob, durationSeconds: number) => void;
  existingBlob?: Blob | null;
}

type RecorderState = 'idle' | 'recording' | 'stopped';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioRecorder({ onRecordingComplete, existingBlob }: Props) {
  const [state, setState] = useState<RecorderState>(existingBlob ? 'stopped' : 'idle');
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const blobRef = useRef<Blob | null>(existingBlob ?? null);

  // Set up audio URL if existingBlob provided
  useEffect(() => {
    if (existingBlob) {
      const url = URL.createObjectURL(existingBlob);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [existingBlob]);

  // Draw waveform
  const drawWaveform = useCallback(() => {
    const canvas = waveformCanvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const barWidth = canvas.width / bufferLength * 2.5;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;
      ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + (dataArray[i] / 255) * 0.6})`;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }

    animFrameRef.current = requestAnimationFrame(drawWaveform);
  }, []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Pick supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        const dur = (Date.now() - startTimeRef.current) / 1000;
        setElapsed(dur);
        onRecordingComplete(blob, dur);
        setState('stopped');
        // Stop waveform
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        analyserRef.current = null;
        // Stop stream tracks
        stream.getTracks().forEach(t => t.stop());
      };

      mr.start(100);
      setState('recording');
      setElapsed(0);

      intervalRef.current = setInterval(() => {
        setElapsed((Date.now() - startTimeRef.current) / 1000);
      }, 500);

      drawWaveform();
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow microphone access and try again.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found on this device.');
      } else {
        setError(err.message || 'Could not start recording.');
      }
    }
  }

  function stopRecording() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    mediaRecorderRef.current?.stop();
  }

  function reset() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    blobRef.current = null;
    setElapsed(0);
    setPlaying(false);
    setState('idle');
    setError(null);
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Waveform canvas (only visible while recording) */}
      {state === 'recording' && (
        <div className="rounded-lg overflow-hidden bg-gray-900 border border-gray-700">
          <canvas
            ref={waveformCanvasRef}
            width={400}
            height={60}
            className="w-full"
          />
        </div>
      )}

      {/* Playback (after recording) */}
      {state === 'stopped' && audioUrl && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-hover border border-surface-hover">
          <button
            onClick={togglePlay}
            className="h-9 w-9 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shrink-0"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-theme">Recording</p>
            <p className="text-xs text-muted">{formatTime(elapsed)}</p>
          </div>
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setPlaying(false)}
            className="hidden"
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        {state === 'idle' && (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
          >
            <Mic className="h-4 w-4" />
            Record audio message
          </button>
        )}

        {state === 'recording' && (
          <>
            <span className="flex items-center gap-1.5 text-sm text-red-500 font-medium">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              Recording — {formatTime(elapsed)}
            </span>
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
            >
              <Square className="h-4 w-4" />
              Stop
            </button>
          </>
        )}

        {state === 'stopped' && (
          <button
            onClick={reset}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-muted hover:text-theme border border-surface-hover hover:bg-surface-hover transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Re-record
          </button>
        )}
      </div>
    </div>
  );
}
