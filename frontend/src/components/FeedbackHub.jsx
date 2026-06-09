import React, { useState, useEffect } from 'react';
import { X, Send, MessageSquare, Star, Bug, Zap } from 'lucide-react';

export default function FeedbackHub({ onClose, token, currentUser }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [content, setContent] = useState('');
  const [type, setType] = useState('General');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const types = [
    { label: 'General', value: 'General', icon: <MessageSquare size={16} /> },
    { label: 'Bug Report', value: 'Bug', icon: <Bug size={16} /> },
    { label: 'Feature Request', value: 'Feature', icon: <Zap size={16} /> }
  ];

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  const fetchFeedbacks = async () => {
    try {
      const response = await fetch('/api/feedbacks', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch feedbacks');
      const data = await response.json();
      setFeedbacks(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/feedbacks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content, type })
      });

      if (!response.ok) throw new Error('Failed to submit feedback');
      const newFeedback = await response.json();
      
      // Add current user's username for immediate display
      const feedbackWithUser = {
        ...newFeedback,
        username: currentUser.username
      };

      setFeedbacks([feedbackWithUser, ...feedbacks]);
      setContent('');
      setType('General');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeColor = (t) => {
    switch (t) {
      case 'Bug': return '#ff1744';
      case 'Feature': return '#00e676';
      default: return '#3d5afe';
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-content" style={{ maxWidth: '800px', width: '90%', height: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Star size={24} color="#ff9100" />
            Feedback Hub
          </h2>
          <button className="btn btn-icon shake-hover" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', gap: '24px', backgroundColor: '#f9f9fb' }}>
          
          {/* Form Section */}
          <div style={{ flex: '1', minWidth: '250px' }}>
            <div className="card" style={{ position: 'sticky', top: 0 }}>
              <h3 style={{ marginBottom: '16px', fontSize: '1.1rem' }}>Share Your Thoughts</h3>
              {error && (
                <div style={{ color: 'red', marginBottom: '10px', fontSize: '0.85rem' }}>{error}</div>
              )}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="form-label">Feedback Type</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {types.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setType(t.value)}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '6px',
                          border: `1px solid ${type === t.value ? getTypeColor(t.value) : 'var(--border-color)'}`,
                          backgroundColor: type === t.value ? `${getTypeColor(t.value)}15` : '#fff',
                          color: type === t.value ? getTypeColor(t.value) : 'var(--text-color)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          fontSize: '0.85rem',
                          fontWeight: type === t.value ? 600 : 400
                        }}
                      >
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="form-label">Details</label>
                  <textarea
                    className="input-field"
                    style={{ minHeight: '120px', resize: 'vertical' }}
                    placeholder="Tell us what you think..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={submitting || !content.trim()}
                  style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}
                >
                  <Send size={16} />
                  {submitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </form>
            </div>
          </div>

          {/* List Section */}
          <div style={{ flex: '2', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Community Feedback</h3>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>Loading feedbacks...</div>
            ) : feedbacks.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <MessageSquare size={32} style={{ marginBottom: '16px', opacity: 0.5 }} />
                <p>No feedback submitted yet. Be the first!</p>
              </div>
            ) : (
              feedbacks.map((fb) => (
                <div key={fb.id} className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%', 
                        backgroundColor: 'var(--color-primary)', color: '#fff', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold', fontSize: '14px'
                      }}>
                        {fb.username ? fb.username.charAt(0).toUpperCase() : '?'}
                      </div>
                      <span style={{ fontWeight: 600 }}>{fb.username || 'Anonymous User'}</span>
                    </div>
                    <span style={{ 
                      padding: '4px 10px', 
                      borderRadius: '12px', 
                      fontSize: '0.75rem', 
                      fontWeight: 600,
                      backgroundColor: `${getTypeColor(fb.type)}15`,
                      color: getTypeColor(fb.type)
                    }}>
                      {fb.type}
                    </span>
                  </div>
                  
                  <p style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{fb.content}</p>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>{new Date(fb.created_at).toLocaleDateString()} {new Date(fb.created_at).toLocaleTimeString()}</span>
                    <span>Status: <strong style={{ color: fb.status === 'Pending' ? '#ff9100' : '#00e676' }}>{fb.status}</strong></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
