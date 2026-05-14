import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, Edit2, Check, Trash2 } from 'lucide-react';
import { Recording } from '../types';

interface RecordingLibraryProps {
  recordings: Recording[];
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
}

export const RecordingLibrary: React.FC<RecordingLibraryProps> = ({ recordings, onRename, onDelete }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  // Track currently playing audio
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>({});
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});

  const togglePlay = (id: string) => {
    const audio = audioRefs.current[id];
    if (!audio) return;

    if (playingId === id) {
      audio.pause();
      setPlayingId(null);
    } else {
      // Pause current playing
      if (playingId && audioRefs.current[playingId]) {
        audioRefs.current[playingId].pause();
      }
      audio.play();
      setPlayingId(id);
    }
  };

  const handleTimeUpdate = (id: string) => {
    const audio = audioRefs.current[id];
    if (audio) {
      setAudioProgress(prev => ({
        ...prev,
        [id]: audio.currentTime / (audio.duration || 1)
      }));
    }
  };

  const handleEnded = (id: string) => {
    if (playingId === id) {
      setPlayingId(null);
    }
    setAudioProgress(prev => ({ ...prev, [id]: 0 }));
  };

  const handleSeek = (id: string, value: number) => {
    const audio = audioRefs.current[id];
    if (audio) {
      audio.currentTime = value * (audio.duration || 1);
      setAudioProgress(prev => ({ ...prev, [id]: value }));
    }
  };

  const startEditing = (recording: Recording) => {
    setEditingId(recording.id);
    setEditName(recording.name);
  };

  const saveEdit = (id: string) => {
    if (editName.trim()) {
      onRename(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      saveEdit(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
      {recordings.length === 0 ? (
        <div className="text-white/50 text-sm text-center py-4 italic">No recordings yet.</div>
      ) : (
        recordings.map((recording) => (
          <div key={recording.id} className="bg-black/40 border border-white/10 rounded-lg p-3 flex flex-col gap-2 backdrop-blur-md">
            <audio
              ref={(el) => { if (el) audioRefs.current[recording.id] = el; }}
              src={recording.url}
              onTimeUpdate={() => handleTimeUpdate(recording.id)}
              onEnded={() => handleEnded(recording.id)}
            />
            
            <div className="flex items-center justify-between">
              {editingId === recording.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, recording.id)}
                    className="flex-1 bg-black/60 border border-white/20 text-white px-2 py-1 text-sm rounded outline-none focus:border-cyan-500"
                    autoFocus
                    onBlur={() => saveEdit(recording.id)}
                  />
                  <button onClick={() => saveEdit(recording.id)} className="text-green-400 hover:text-green-300">
                    <Check size={16} />
                  </button>
                </div>
              ) : (
                <div 
                  className="text-white text-sm font-medium truncate flex-1 cursor-text hover:text-cyan-300 transition-colors"
                  onDoubleClick={() => startEditing(recording)}
                  title="Double-click to rename"
                >
                  {recording.name}
                  <span className="text-white/30 text-xs ml-2">
                    {Math.round(recording.duration)}s
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 ml-4">
                <a 
                  href={recording.url} 
                  download={`${recording.name}.wav`}
                  className="text-white/60 hover:text-cyan-400 transition-colors"
                  title="Download WAV"
                >
                  <Download size={16} />
                </a>
                <button 
                  onClick={() => onDelete(recording.id)}
                  className="text-white/60 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => togglePlay(recording.id)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors flex-shrink-0"
              >
                {playingId === recording.id ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
              </button>
              
              <div className="flex-1 relative h-2 bg-white/10 rounded-full cursor-pointer group">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.001"
                  value={audioProgress[recording.id] || 0}
                  onChange={(e) => handleSeek(recording.id, parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-cyan-500 rounded-full group-hover:bg-cyan-400 transition-colors pointer-events-none"
                  style={{ width: `${(audioProgress[recording.id] || 0) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
