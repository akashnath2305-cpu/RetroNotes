import React, { useState, useEffect } from 'react';
import { RotateCcw, Hourglass, Play, Pause, Settings, Coffee } from 'lucide-react';

export default function FocusTimer() {
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBreakReminder, setShowBreakReminder] = useState(false);

  const playMelody = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(startTime);
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(523.25, now, 0.4); // C5
    playTone(659.25, now + 0.2, 0.4); // E5
    playTone(783.99, now + 0.4, 0.6); // G5
    playTone(1046.50, now + 0.6, 1.0); // C6
  };

  useEffect(() => {
    let interval = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            setShowBreakReminder(true);
            playMelody();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  const toggleTimer = () => {
    if (showSettings) setShowSettings(false);
    setIsRunning(!isRunning);
  };
  
  const resetTimer = (e) => {
    e.stopPropagation();
    setIsRunning(false);
    setTimeLeft(selectedMinutes * 60);
  };

  const toggleSettings = (e) => {
    e.stopPropagation();
    setShowSettings(!showSettings);
  };

  const changeDuration = (e, mins) => {
    e.stopPropagation();
    setSelectedMinutes(mins);
    setTimeLeft(mins * 60);
    setIsRunning(false);
    setShowSettings(false);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const PRESETS = [5, 15, 25, 45, 60, 90];

  return (
    <>
      <div className="focus-timer-3d" onClick={toggleTimer} title={isRunning ? "Pause Timer" : "Start Focus Timer"} style={{ position: 'relative', zIndex: showSettings ? 1000 : 1 }}>
        <div className={`timer-icon-container ${isRunning ? 'running' : ''}`}>
          {isRunning ? (
            <Pause size={14} className="timer-pulse-icon" />
          ) : (
            <Play size={14} className="timer-pulse-icon" />
          )}
          <Hourglass size={14} className="timer-sand-icon" style={{ marginLeft: '6px' }} />
        </div>
        <div className="timer-display">
          {timeString}
        </div>
        
        <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
          <button className="timer-btn-action" onClick={resetTimer} title="Reset Timer">
            <RotateCcw size={12} />
          </button>
          <button className="timer-btn-action" onClick={toggleSettings} title="Timer Settings">
            <Settings size={12} />
          </button>
        </div>

        {showSettings && (
          <div className="timer-settings-popup" onClick={(e) => e.stopPropagation()}>
            <div className="timer-settings-title">Focus Time</div>
            <div className="timer-settings-grid">
              {PRESETS.map(m => (
                <button 
                  key={m} 
                  className={`timer-preset-btn ${selectedMinutes === m ? 'active' : ''}`}
                  onClick={(e) => changeDuration(e, m)}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {showBreakReminder && (
        <div className="break-reminder-overlay" onClick={() => setShowBreakReminder(false)}>
          <div className="break-reminder-modal" onClick={(e) => e.stopPropagation()}>
            <Coffee size={64} className="break-icon-glow" />
            <h2 style={{ color: '#fff', marginTop: '16px', marginBottom: '8px', fontSize: '1.8rem', textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>Focus Complete!</h2>
            <p style={{ color: '#ccc', marginBottom: '24px', fontSize: '1.1rem' }}>Great job. Take a well-deserved break.</p>
            <button className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '1.1rem' }} onClick={() => setShowBreakReminder(false)}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </>
  );
}
