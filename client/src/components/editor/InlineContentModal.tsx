import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Upload, Link as LinkIcon, Mic, Video, Square, Circle } from 'lucide-react';
import api from '../../lib/api';
import type {
  InlineContent, QuestionData, PollData, NoteData, LinkData, MediaData, HighlightData,
  SelectData, MultiselectData, TextboxData, TextareaData, RadioData, CheckboxData,
  CodeBlockData, ScriptureBlockData
} from '../../types';
import {
  SelectForm, MultiselectForm, TextboxForm, TextareaForm,
  RadioForm, CheckboxForm, CodeBlockForm, ScriptureBlockForm
} from './InteractiveForms';

interface Props {
  type: InlineContent['content_type'];
  selectedText?: string;
  onClose: () => void;
  onCreate: (data: Partial<InlineContent>) => void;
  editingItem?: InlineContent; // For edit mode
  onUpdate?: (id: string, data: Partial<InlineContent>) => void; // For edit mode
}

export default function InlineContentModal({ type, selectedText, onClose, onCreate, editingItem, onUpdate }: Props) {
  const isEditing = !!editingItem;

  const titles: Record<string, string> = {
    question: isEditing ? 'Edit Question' : 'Add Question',
    poll: isEditing ? 'Edit Poll' : 'Add Poll',
    highlight: isEditing ? 'Edit Highlight' : 'Add Highlight',
    note: isEditing ? 'Edit Note' : 'Add Note',
    link: isEditing ? 'Edit Link' : 'Add Link',
    audio: isEditing ? 'Edit Audio' : 'Add Audio',
    video: isEditing ? 'Edit Video' : 'Add Video',
    select: isEditing ? 'Edit Select' : 'Add Select Dropdown',
    multiselect: isEditing ? 'Edit Multi-Select' : 'Add Multi-Select',
    textbox: isEditing ? 'Edit Text Input' : 'Add Text Input',
    textarea: isEditing ? 'Edit Text Area' : 'Add Text Area',
    radio: isEditing ? 'Edit Radio Options' : 'Add Radio Options',
    checkbox: isEditing ? 'Edit Checkboxes' : 'Add Checkboxes',
    code_block: isEditing ? 'Edit Code Block' : 'Add Code Block',
    scripture_block: isEditing ? 'Edit Scripture' : 'Add Scripture Verse',
  };

  const handleSubmit = (data: Partial<InlineContent>) => {
    if (isEditing && onUpdate && editingItem) {
      onUpdate(editingItem.id, data);
    } else {
      onCreate(data);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-modal role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">{titles[type]}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {selectedText && !isEditing && (
          <div className="px-4 pt-4">
            <p className="text-sm text-gray-500">Selected text:</p>
            <p className="text-sm bg-gray-100 p-2 rounded mt-1 italic">"{selectedText}"</p>
          </div>
        )}

        <div className="p-4">
          {type === 'question' && <QuestionForm onSubmit={handleSubmit} onClose={onClose} initialData={editingItem?.content_data as QuestionData} isEditing={isEditing} />}
          {type === 'poll' && <PollForm onSubmit={handleSubmit} onClose={onClose} initialData={editingItem?.content_data as PollData} isEditing={isEditing} />}
          {type === 'highlight' && <HighlightForm onSubmit={handleSubmit} onClose={onClose} initialData={editingItem?.content_data as HighlightData} isEditing={isEditing} />}
          {type === 'note' && <NoteForm onSubmit={handleSubmit} onClose={onClose} initialData={editingItem?.content_data as NoteData} isEditing={isEditing} />}
          {type === 'link' && <LinkForm onSubmit={handleSubmit} onClose={onClose} initialData={editingItem?.content_data as LinkData} isEditing={isEditing} />}
          {type === 'audio' && <MediaForm type="audio" onSubmit={handleSubmit} onClose={onClose} initialData={editingItem?.content_data as MediaData} isEditing={isEditing} />}
          {type === 'video' && <MediaForm type="video" onSubmit={handleSubmit} onClose={onClose} initialData={editingItem?.content_data as MediaData} isEditing={isEditing} />}
          
          {type === 'select' && <SelectForm onSubmit={handleSubmit} onClose={onClose} initialData={editingItem?.content_data as SelectData} isEditing={isEditing} />}
          {type === 'multiselect' && <MultiselectForm onSubmit={handleSubmit} onClose={onClose} initialData={editingItem?.content_data as MultiselectData} isEditing={isEditing} />}
          {type === 'textbox' && <TextboxForm onSubmit={handleSubmit} onClose={onClose} initialData={editingItem?.content_data as TextboxData} isEditing={isEditing} />}
          {type === 'textarea' && <TextareaForm onSubmit={handleSubmit} onClose={onClose} initialData={editingItem?.content_data as TextareaData} isEditing={isEditing} />}
          {type === 'radio' && <RadioForm onSubmit={handleSubmit} onClose={onClose} initialData={editingItem?.content_data as RadioData} isEditing={isEditing} />}
          {type === 'checkbox' && <CheckboxForm onSubmit={handleSubmit} onClose={onClose} initialData={editingItem?.content_data as CheckboxData} isEditing={isEditing} />}
          {type === 'code_block' && <CodeBlockForm onSubmit={handleSubmit} onClose={onClose} initialData={editingItem?.content_data as CodeBlockData} isEditing={isEditing} />}
          {type === 'scripture_block' && <ScriptureBlockForm onSubmit={handleSubmit} onClose={onClose} initialData={editingItem?.content_data as ScriptureBlockData} isEditing={isEditing} />}
        </div>
      </div>
    </div>
  );
}

function QuestionForm({ onSubmit, onClose, initialData, isEditing }: { onSubmit: (data: Partial<InlineContent>) => void; onClose: () => void; initialData?: QuestionData; isEditing?: boolean }) {
  const [question, setQuestion] = useState(initialData?.question || '');
  const [questionType, setQuestionType] = useState<'open' | 'multiple_choice' | 'quiz'>(initialData?.type || 'open');
  const [options, setOptions] = useState<{ id: string; text: string }[]>(initialData?.options || []);
  const [correctAnswer, setCorrectAnswer] = useState<string[]>(Array.isArray(initialData?.correct_answer) ? initialData.correct_answer : initialData?.correct_answer ? [initialData.correct_answer] : []);
  const [explanation, setExplanation] = useState(initialData?.explanation || '');
  const [visibility, setVisibility] = useState<'all_readers' | 'author_only'>('all_readers');

  const addOption = () => {
    setOptions([...options, { id: `opt_${Date.now()}`, text: '' }]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const contentData: QuestionData = {
      question,
      type: questionType,
      options: questionType !== 'open' ? options : undefined,
      correct_answer: questionType === 'quiz' ? correctAnswer : undefined,
      explanation: questionType === 'quiz' ? explanation : undefined,
    };
    onSubmit({ content_data: contentData, visibility });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Question</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          rows={2}
          required
          placeholder="Enter your question..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Type</label>
        <select
          value={questionType}
          onChange={(e) => setQuestionType(e.target.value as any)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
        >
          <option value="open">Open-ended</option>
          <option value="multiple_choice">Multiple Choice</option>
          <option value="quiz">Quiz (with correct answer)</option>
        </select>
      </div>

      {questionType !== 'open' && (
        <div>
          <label className="block text-sm font-medium mb-1">Options</label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={opt.id} className="flex gap-2">
                {questionType === 'quiz' && (
                  <input
                    type="checkbox"
                    checked={correctAnswer.includes(opt.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCorrectAnswer([...correctAnswer, opt.id]);
                      } else {
                        setCorrectAnswer(correctAnswer.filter(id => id !== opt.id));
                      }
                    }}
                    className="mt-2"
                    title="Mark as correct"
                  />
                )}
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => {
                    const newOptions = [...options];
                    newOptions[i].text = e.target.value;
                    setOptions(newOptions);
                  }}
                  className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
                  placeholder={`Option ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addOption}
              className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
            >
              <Plus className="h-4 w-4" /> Add Option
            </button>
          </div>
        </div>
      )}

      {questionType === 'quiz' && (
        <div>
          <label className="block text-sm font-medium mb-1">Explanation (shown after answer)</label>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
            rows={2}
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Visibility</label>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as any)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
        >
          <option value="all_readers">Visible to all readers</option>
          <option value="author_only">Author only (notes)</option>
        </select>
      </div>

      <FormButtons onClose={onClose} submitText={isEditing ? 'Save' : 'Add'} />
    </form>
  );
}

function PollForm({ onSubmit, onClose, initialData, isEditing }: { onSubmit: (data: Partial<InlineContent>) => void; onClose: () => void; initialData?: PollData; isEditing?: boolean }) {
  const [question, setQuestion] = useState(initialData?.question || '');
  const [options, setOptions] = useState<{ id: string; text: string }[]>(
    initialData?.options && initialData.options.length > 0
      ? initialData.options
      : [{ id: 'opt_1', text: '' }, { id: 'opt_2', text: '' }]
  );
  const [allowMultiple, setAllowMultiple] = useState(initialData?.allow_multiple || false);
  const [showResultsBefore, setShowResultsBefore] = useState(initialData?.show_results_before_vote || false);

  const addOption = () => {
    setOptions([...options, { id: `opt_${Date.now()}`, text: '' }]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const contentData: PollData = {
      question,
      options: options.filter(o => o.text.trim()),
      allow_multiple: allowMultiple,
      show_results_before_vote: showResultsBefore,
    };
    onSubmit({ content_data: contentData, visibility: 'all_readers' });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Poll Question</label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          required
          placeholder="What do you think about...?"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Options</label>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={opt.id} className="flex gap-2">
              <input
                type="text"
                value={opt.text}
                onChange={(e) => {
                  const newOptions = [...options];
                  newOptions[i].text = e.target.value;
                  setOptions(newOptions);
                }}
                className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
                placeholder={`Option ${i + 1}`}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
          >
            <Plus className="h-4 w-4" /> Add Option
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={allowMultiple}
            onChange={(e) => setAllowMultiple(e.target.checked)}
          />
          <span className="text-sm">Allow multiple selections</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showResultsBefore}
            onChange={(e) => setShowResultsBefore(e.target.checked)}
          />
          <span className="text-sm">Show results before voting</span>
        </label>
      </div>

      <FormButtons onClose={onClose} submitText={isEditing ? 'Save' : 'Add'} />
    </form>
  );
}

function HighlightForm({ onSubmit, onClose, initialData, isEditing }: { onSubmit: (data: Partial<InlineContent>) => void; onClose: () => void; initialData?: HighlightData; isEditing?: boolean }) {
  const [color, setColor] = useState(initialData?.color || 'yellow');
  const [note, setNote] = useState(initialData?.note || '');

  const colors = [
    { value: 'yellow', label: 'Yellow', class: 'bg-yellow-300' },
    { value: 'green', label: 'Green', class: 'bg-green-300' },
    { value: 'blue', label: 'Blue', class: 'bg-blue-300' },
    { value: 'pink', label: 'Pink', class: 'bg-pink-300' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const contentData: HighlightData = { color, note: note || undefined };
    onSubmit({ content_data: contentData, visibility: 'all_readers' });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Highlight Color</label>
        <div className="flex gap-2">
          {colors.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              className={`w-8 h-8 rounded-full ${c.class} ${color === c.value ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
              title={c.label}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          rows={2}
          placeholder="Add a note about this highlight..."
        />
      </div>

      <FormButtons onClose={onClose} submitText={isEditing ? 'Save' : 'Add'} />
    </form>
  );
}

function NoteForm({ onSubmit, onClose, initialData, isEditing }: { onSubmit: (data: Partial<InlineContent>) => void; onClose: () => void; initialData?: NoteData; isEditing?: boolean }) {
  const [text, setText] = useState(initialData?.text || '');
  const [noteType, setNoteType] = useState<'annotation' | 'definition' | 'reference'>(initialData?.type || 'annotation');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const contentData: NoteData = { text, type: noteType };
    onSubmit({ content_data: contentData, visibility: 'all_readers' });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Note Type</label>
        <select
          value={noteType}
          onChange={(e) => setNoteType(e.target.value as any)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
        >
          <option value="annotation">Annotation</option>
          <option value="definition">Definition</option>
          <option value="reference">Reference</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Note Content</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          rows={4}
          required
          placeholder="Enter your note..."
        />
      </div>

      <FormButtons onClose={onClose} submitText={isEditing ? 'Save' : 'Add'} />
    </form>
  );
}

function LinkForm({ onSubmit, onClose, initialData, isEditing }: { onSubmit: (data: Partial<InlineContent>) => void; onClose: () => void; initialData?: LinkData; isEditing?: boolean }) {
  const [url, setUrl] = useState(initialData?.url || '');
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const contentData: LinkData = { url, title: title || undefined, description: description || undefined };
    onSubmit({ content_data: contentData, visibility: 'all_readers' });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          required
          placeholder="https://..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Title (optional)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          placeholder="Link title"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          rows={2}
          placeholder="Brief description of the link"
        />
      </div>

      <FormButtons onClose={onClose} submitText={isEditing ? 'Save' : 'Add'} />
    </form>
  );
}

function MediaForm({ type, onSubmit, onClose, maxDuration = 60, initialData, isEditing }: { type: 'audio' | 'video'; onSubmit: (data: Partial<InlineContent>) => void; onClose: () => void; maxDuration?: number; initialData?: MediaData; isEditing?: boolean }) {
  const [mode, setMode] = useState<'url' | 'upload' | 'record'>(initialData?.url ? 'url' : 'url');
  const [url, setUrl] = useState(initialData?.url || '');
  const [title, setTitle] = useState(initialData?.title || '');
  const [duration, setDuration] = useState(initialData?.duration?.toString() || '');
  const [startTime, setStartTime] = useState(initialData?.start_time?.toString() || '');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const acceptTypes = type === 'audio'
    ? 'audio/mp3,audio/wav,audio/ogg,audio/m4a,audio/*'
    : 'video/mp4,video/webm,video/ogg,video/*';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [mediaStream, recordedUrl]);

  const startRecording = useCallback(async () => {
    try {
      const constraints = type === 'audio'
        ? { audio: true }
        : { audio: true, video: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setMediaStream(stream);

      // Show preview for video
      if (type === 'video' && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }

      const mimeType = type === 'audio' ? 'audio/webm' : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        stream.getTracks().forEach(track => track.stop());
        setMediaStream(null);
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // Auto-stop at max duration
          if (newTime >= maxDuration) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Failed to access microphone/camera. Please check permissions.');
    }
  }, [type, maxDuration]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  const clearRecording = () => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordingTime(0);
  };


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Get upload URL from BookFlow API (which proxies to FileFlow)
      const { upload_url, storage_path } = await api.getUploadUrl(file.name, file.type);

      // Upload directly to storage
      const uploadResponse = await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      // Register the file
      const registered = await api.registerFile({
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path,
        display_name: file.name,
      });

      setUploadedFile({
        url: registered.file_url || storage_path,
        name: file.name,
      });
      setTitle(file.name.replace(/\.[^/.]+$/, '')); // Set title from filename without extension
      setUploadProgress(100);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload file. Please try again or use a URL instead.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let mediaUrl = url;
    let finalDuration = duration ? parseInt(duration) : undefined;

    if (mode === 'upload' && uploadedFile) {
      mediaUrl = uploadedFile.url;
    } else if (mode === 'record') {
      // If recording exists but not uploaded yet, upload it first
      if (recordedBlob && !uploadedFile) {
        setUploading(true);
        setUploadProgress(0);

        try {
          const fileName = `recording_${Date.now()}.webm`;
          const file = new File([recordedBlob], fileName, { type: recordedBlob.type });

          // Get upload URL
          const { upload_url, storage_path } = await api.getUploadUrl(fileName, file.type);

          // Upload
          const uploadResponse = await fetch(upload_url, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type },
          });

          if (!uploadResponse.ok) throw new Error('Upload failed');

          // Register
          const registered = await api.registerFile({
            file_name: fileName,
            file_type: file.type,
            file_size: file.size,
            storage_path,
            display_name: title || `Recording ${new Date().toLocaleDateString()}`,
          });

          mediaUrl = registered.file_url || storage_path;
          finalDuration = recordingTime;
          setUploadProgress(100);
        } catch (err) {
          console.error('Upload failed:', err);
          alert('Failed to upload recording.');
          setUploading(false);
          return;
        } finally {
          setUploading(false);
        }
      } else if (uploadedFile) {
        mediaUrl = uploadedFile.url;
        finalDuration = recordingTime;
      }
    }

    if (!mediaUrl) {
      alert('Please provide a URL, upload a file, or record media');
      return;
    }

    const contentData: MediaData = {
      type,
      url: mediaUrl,
      title: title || undefined,
      duration: finalDuration || (mode === 'record' ? recordingTime : undefined),
      start_time: startTime ? parseInt(startTime) : undefined,
    };
    onSubmit({ content_data: contentData, visibility: 'all_readers' });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex rounded-lg border overflow-hidden">
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
            mode === 'url' ? 'bg-primary-600 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
          }`}
        >
          <LinkIcon className="h-4 w-4" />
          URL
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
            mode === 'upload' ? 'bg-primary-600 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Upload className="h-4 w-4" />
          Upload
        </button>
        <button
          type="button"
          onClick={() => setMode('record')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
            mode === 'record' ? 'bg-primary-600 text-white' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
          }`}
        >
          {type === 'audio' ? <Mic className="h-4 w-4" /> : <Video className="h-4 w-4" />}
          Record
        </button>
      </div>

      {mode === 'url' ? (
        <div>
          <label className="block text-sm font-medium mb-1">{type === 'audio' ? 'Audio' : 'Video'} URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
            required={mode === 'url'}
            placeholder="https://..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Supports YouTube, Vimeo, direct links, etc.
          </p>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium mb-1">Upload {type === 'audio' ? 'Audio' : 'Video'}</label>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptTypes}
            onChange={handleFileSelect}
            className="hidden"
          />

          {uploadedFile ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">{uploadedFile.name}</p>
                <p className="text-xs text-green-600">Uploaded successfully</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUploadedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-green-600 hover:text-green-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : uploading ? (
            <div className="p-4 border-2 border-dashed rounded-lg">
              <div className="text-center">
                <div className="animate-spin h-8 w-8 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Uploading... {uploadProgress}%</p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-6 border-2 border-dashed rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors"
            >
              <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">Click to select {type} file</p>
              <p className="text-xs text-gray-400 mt-1">
                {type === 'audio' ? 'MP3, WAV, OGG, M4A' : 'MP4, WebM, OGG'}
              </p>
            </button>
          )}
        </div>
      )}

      {mode === 'record' && (
        <div>
          <label className="block text-sm font-medium mb-1">Record {type === 'audio' ? 'Audio' : 'Video'}</label>

          {/* Video preview for video recording */}
          {type === 'video' && (isRecording || recordedUrl) && (
            <div className="mb-4 rounded-lg overflow-hidden bg-black">
              {isRecording && !recordedUrl && (
                <video
                  ref={videoPreviewRef}
                  className="w-full h-48 object-cover"
                  muted
                  playsInline
                />
              )}
              {recordedUrl && (
                <video
                  src={recordedUrl}
                  className="w-full h-48 object-cover"
                  controls
                />
              )}
            </div>
          )}

          {/* Audio preview */}
          {type === 'audio' && recordedUrl && (
            <div className="mb-4">
              <audio src={recordedUrl} controls className="w-full" />
            </div>
          )}

          {/* Recording controls */}
          {!recordedUrl ? (
            <div className="text-center p-6 border-2 border-dashed rounded-lg">
              {isRecording ? (
                <>
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Circle className="h-3 w-3 text-red-500 animate-pulse fill-red-500" />
                    <span className="text-lg font-mono">{formatTime(recordingTime)} / {formatTime(maxDuration)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                    <div
                      className="bg-red-500 h-2 rounded-full transition-all"
                      style={{ width: `${(recordingTime / maxDuration) * 100}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 flex items-center gap-2 mx-auto"
                  >
                    <Square className="h-4 w-4 fill-white" />
                    Stop Recording
                  </button>
                </>
              ) : (
                <>
                  {type === 'audio' ? (
                    <Mic className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                  ) : (
                    <Video className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                  )}
                  <button
                    type="button"
                    onClick={startRecording}
                    className="px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 flex items-center gap-2 mx-auto"
                  >
                    <Circle className="h-4 w-4" />
                    Start Recording
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    Max duration: {formatTime(maxDuration)}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-green-800">Recording ready</p>
                  <p className="text-xs text-green-600">Duration: {formatTime(recordingTime)}</p>
                </div>
                <button
                  type="button"
                  onClick={clearRecording}
                  className="text-green-600 hover:text-green-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {!uploadedFile && (
                <p className="text-xs text-gray-500 text-center">
                  Click "Add" below to upload and add this recording
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Title (optional)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
          placeholder="Media title"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Duration (seconds)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
            placeholder="120"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Start Time (seconds)</label>
          <input
            type="number"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-primary-500"
            placeholder="0"
          />
        </div>
      </div>

      <FormButtons
        onClose={onClose}
        disabled={uploading || isRecording}
        loading={uploading}
        loadingText={`Uploading... ${uploadProgress}%`}
        submitText={isEditing ? 'Save' : 'Add'}
      />
    </form>
  );
}

function FormButtons({
  onClose,
  disabled = false,
  loading = false,
  loadingText = 'Processing...',
  submitText = 'Add'
}: {
  onClose: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  submitText?: string;
}) {
  return (
    <div className="flex gap-3 pt-4 border-t">
      <button
        type="button"
        onClick={onClose}
        disabled={disabled}
        className="flex-1 px-4 py-2 border rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={disabled}
        className="flex-1 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            {loadingText}
          </>
        ) : (
          submitText
        )}
      </button>
    </div>
  );
}
