import React, { useState } from 'react';
import { CheckCircle, Circle, Plus, Trash2, Calendar, Cloud, X } from 'lucide-react';

export default function DailyTasks({ onClose }) {
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Review morning notes', completed: false },
    { id: 2, text: 'Draft project proposal', completed: true },
    { id: 3, text: 'Team sync at 2 PM', completed: false }
  ]);
  const [newTask, setNewTask] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const addTask = (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    setTasks([...tasks, { id: Date.now(), text: newTask.trim(), completed: false }]);
    setNewTask('');
  };

  const toggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  const syncGoogleCalendar = () => {
    // Mock sync for now
    setIsSyncing(true);
    setTimeout(() => {
      alert("Note: To fully sync with Google Calendar, you will need to provide a Google Client ID in the app settings, as detailed in the implementation plan.");
      setIsSyncing(false);
    }, 1500);
  };

  return (
    <div className="daily-tasks-panel">
      <div className="tasks-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={20} className="text-primary" />
          <h2 style={{ margin: 0 }}>Daily Routine</h2>
        </div>
        <button className="btn btn-icon" onClick={onClose} title="Close Tasks">
          <X size={18} />
        </button>
      </div>

      <div className="tasks-sync-banner">
        <button className={`btn ${isSyncing ? 'btn-secondary' : 'btn-primary'}`} style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }} onClick={syncGoogleCalendar} disabled={isSyncing}>
          <Cloud size={16} /> {isSyncing ? 'Syncing...' : 'Sync with Google Calendar'}
        </button>
      </div>

      <div className="tasks-list">
        {tasks.length === 0 ? (
          <div className="tasks-empty">No tasks for today. Enjoy!</div>
        ) : (
          tasks.map(task => (
            <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
              <button className="task-toggle-btn" onClick={() => toggleTask(task.id)}>
                {task.completed ? <CheckCircle size={18} className="text-success" /> : <Circle size={18} color="#888" />}
              </button>
              <span className="task-text">{task.text}</span>
              <button className="task-delete-btn" onClick={() => deleteTask(task.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      <form className="task-input-form" onSubmit={addTask}>
        <div style={{ 
          display: 'flex', 
          width: '100%', 
          alignItems: 'center', 
          background: '#fff', 
          border: '2px solid var(--border-color)', 
          borderRadius: '24px', 
          padding: '4px 4px 4px 16px', 
          boxShadow: 'var(--shadow-flat)' 
        }}>
          <input 
            type="text" 
            placeholder="Add a new task..." 
            value={newTask} 
            onChange={(e) => setNewTask(e.target.value)} 
            style={{ 
              flex: 1, 
              border: 'none', 
              outline: 'none', 
              background: 'transparent', 
              fontSize: '0.95rem',
              fontWeight: 500
            }}
          />
          <button 
            type="submit" 
            disabled={!newTask.trim()} 
            style={{ 
              background: newTask.trim() ? 'var(--color-primary)' : '#ccc', 
              color: '#fff', 
              border: '2px solid var(--border-color)', 
              borderRadius: '50%', 
              width: '32px', 
              height: '32px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: newTask.trim() ? 'pointer' : 'not-allowed', 
              transition: 'all 0.2s',
              transform: newTask.trim() ? 'scale(1)' : 'scale(0.95)'
            }}
            title="Add Task"
          >
            <Plus size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
