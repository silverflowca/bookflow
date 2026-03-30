import { useState, useRef, useCallback } from 'react'
import { api } from '../../lib/api'

interface Props {
  clubId: string
  chatAudioFolderId: string | null
  onSend: (data: { audio_fileflow_file_id: string; audio_mime_type: string; audio_duration_seconds: number }) => void
  onCancel: () => void
}

export default function ChatAudioRecorder({ clubId, chatAudioFolderId, onSend, onCancel }: Props) {
  const [recording, setRecording] = useState(false)
  const [recorded, setRecorded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mimeTypeRef = useRef<string>('audio/webm')
  const startTimeRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null)
  const blobRef = useRef<Blob | null>(null)

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm'
      mimeTypeRef.current = mimeType
      chunksRef.current = []

      const mr = new MediaRecorder(stream, { mimeType })
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current })
        blobRef.current = blob
        if (audioPreviewRef.current) {
          audioPreviewRef.current.src = URL.createObjectURL(blob)
        }
        const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000)
        setDuration(elapsed)
        setRecorded(true)
      }

      mediaRecorderRef.current = mr
      mr.start(250)
      startTimeRef.current = Date.now()
      setRecording(true)

      timerRef.current = setInterval(() => {
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000))
      }, 500)
    } catch (err: any) {
      setError('Microphone access denied: ' + err.message)
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }, [])

  const handleSend = useCallback(async () => {
    if (!blobRef.current) return
    setUploading(true)
    setError(null)
    try {
      // Ensure folder exists
      let folderId = chatAudioFolderId
      if (!folderId) {
        const { folder_id } = await api.ensureClubChatFolder(clubId)
        folderId = folder_id
      }

      const mime = mimeTypeRef.current
      const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'
      const filename = `chat_${Date.now()}.${ext}`

      // Get upload URL from FileFlow via bookflow's file upload endpoint
      setUploadProgress(10)
      const uploadData = await api.getUploadUrl(filename, mime)
      const uploadUrl = uploadData.upload_url
      const fileId = uploadData.storage_path

      // Upload blob
      setUploadProgress(30)
      const xhr = new XMLHttpRequest()
      await new Promise<void>((resolve, reject) => {
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) setUploadProgress(30 + Math.round((e.loaded / e.total) * 60))
        }
        xhr.onload = () => xhr.status < 400 ? resolve() : reject(new Error('Upload failed: ' + xhr.status))
        xhr.onerror = () => reject(new Error('Upload error'))
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', mime)
        xhr.send(blobRef.current)
      })

      setUploadProgress(100)
      onSend({
        audio_fileflow_file_id: fileId,
        audio_mime_type: mime,
        audio_duration_seconds: duration,
      })
    } catch (err: any) {
      setError('Upload failed: ' + err.message)
      setUploadProgress(0)
    } finally {
      setUploading(false)
    }
  }, [chatAudioFolderId, clubId, duration, onSend])

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div style={{ padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '10px', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      {error && <div style={{ color: '#ef4444', fontSize: '0.8125rem' }}>{error}</div>}

      {!recording && !recorded && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={startRecording} style={recBtnStyle('#ef4444')}>
            🎙 Start Recording
          </button>
          <button onClick={onCancel} style={recBtnStyle('#6b7280')}>Cancel</button>
        </div>
      )}

      {recording && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444', animation: 'pulse 1s infinite' }} />
          <span style={{ fontSize: '0.875rem', color: '#ef4444', fontWeight: 600 }}>Recording {formatTime(duration)}</span>
          <button onClick={stopRecording} style={recBtnStyle('#1e293b')}>⏹ Stop</button>
        </div>
      )}

      {recorded && !uploading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <audio ref={audioPreviewRef} controls style={{ maxWidth: '260px', height: '36px' }} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleSend} style={recBtnStyle('#6366f1')}>Send ({formatTime(duration)})</button>
            <button onClick={() => { setRecorded(false); blobRef.current = null }} style={recBtnStyle('#6b7280')}>Re-record</button>
            <button onClick={onCancel} style={recBtnStyle('#94a3b8')}>Cancel</button>
          </div>
        </div>
      )}

      {uploading && (
        <div>
          <div style={{ fontSize: '0.875rem', color: '#6366f1', marginBottom: '0.375rem' }}>Uploading… {uploadProgress}%</div>
          <div style={{ height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px' }}>
            <div style={{ height: '100%', width: `${uploadProgress}%`, backgroundColor: '#6366f1', borderRadius: '2px', transition: 'width 0.2s' }} />
          </div>
        </div>
      )}
    </div>
  )
}

function recBtnStyle(bg: string) {
  return {
    padding: '0.375rem 0.75rem',
    backgroundColor: bg,
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.8125rem',
    fontWeight: 500,
  } as React.CSSProperties
}
