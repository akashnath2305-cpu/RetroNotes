import React, { useState, useEffect } from 'react'
import { Sparkles, RefreshCw, BookOpen, Layers, ArrowLeft } from 'lucide-react'

export default function ComicView({ noteId, noteTitle, noteContent }) {
  const [comic, setComic] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isMangaMode, setIsMangaMode] = useState(true) // Traditional Japanese Manga mode by default

  const getCharacterAvatar = (emoji) => {
    if (!emoji) return '/shouta_student.png';
    const char = emoji.trim();
    
    // Student characters
    if (char === '🧑‍🎓' || char === '🎓' || char === '👦' || char === '👧' || char.includes('stud') || char.includes('boy')) {
      return '/shouta_student.png';
    }
    
    // Teacher / Sensei characters
    if (char === '👨‍🏫' || char === '👨' || char === '👩‍🏫' || char === '👩' || char.includes('teach') || char.includes('sensei')) {
      return '/sensei_teacher.png';
    }
    
    // Helper robots
    if (char === '🤖' || char.includes('bot') || char.includes('robot') || char.includes('helper')) {
      return '/android_helper.png';
    }
    
    // Mascot characters
    if (char === '🦊' || char === '🦊' || char === '🐶' || char === '🐱' || char === '🐹' || char === '🐰' || char.includes('animal') || char.includes('mascot') || char === '⚡') {
      return '/chibi_mascot.png';
    }
    
    return '/shouta_student.png'; // default fallback
  };

  const fetchComic = async () => {
    if (!noteId) return
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('notes_token')
      const response = await fetch(`/api/notes/${noteId}/comic`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      setComic(data)
    } catch (err) {
      console.error('Error fetching comic:', err)
      setError('Failed to load comic layout')
    } finally {
      setLoading(false)
    }
  }

  const generateComic = async () => {
    if (!noteId) return
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('notes_token')
      const response = await fetch(`/api/notes/${noteId}/comic`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate comic')
      }
      setComic(data)
    } catch (err) {
      console.error('Error generating comic:', err)
      setError(err.message || 'Failed to generate comic')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setComic(null)
    fetchComic()
  }, [noteId])

  if (!noteId) return null

  // If in Manga mode, Japanese comics are read Right-to-Left, so reverse display array order
  const displayedPanels = isMangaMode && comic?.panels 
    ? [...comic.panels].reverse() 
    : (comic?.panels || [])

  return (
    <div className="comic-strip-container">
      <div className="comic-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            🇯🇵 Visual Manga Storyboard
          </h2>
          {comic && (
            <span style={{ 
              fontSize: '0.75rem', 
              fontWeight: 800, 
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {isMangaMode ? '📖 Read Right-to-Left (Flow: 3 ⇦ 2 ⇦ 1)' : '📖 Read Left-to-Right (Flow: 1 ⇨ 2 ⇨ 3)'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Manga Mode Toggle */}
          {comic && (
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              border: '2px solid var(--border-color)', 
              padding: '4px 8px', 
              borderRadius: '6px', 
              background: '#ffffff',
              boxShadow: '2px 2px 0px #000'
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800 }}>Manga Filter</span>
              <input
                type="checkbox"
                checked={isMangaMode}
                onChange={(e) => setIsMangaMode(e.target.checked)}
                style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--color-primary)' }}
                title="Toggle Japanese Manga Mode (B&W/RTL)"
              />
            </div>
          )}

          {comic && (
            <button 
              className="btn btn-warning shake-hover" 
              style={{ fontSize: '0.85rem', padding: '6px 12px' }}
              onClick={generateComic}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Regenerate Manga
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="loader-book" style={{ margin: '0 auto 20px auto' }}>
            <div className="loader-page"></div>
          </div>
          <p style={{ fontFamily: 'var(--font-handwritten)', fontSize: '1.2rem', fontWeight: 600 }}>
            🧙‍♂️ Sensei is sketching Manga panels in ink...
          </p>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '40px', border: '2px solid var(--color-danger)', borderRadius: '8px' }}>
          <p style={{ color: 'var(--color-danger)', fontWeight: 600 }}>⚠️ {error}</p>
          <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={fetchComic}>
            Retry Loading
          </button>
        </div>
      ) : !comic ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 40px', 
          border: '3px dashed var(--border-color)', 
          borderRadius: '8px',
          background: '#faf9f6'
        }}>
          <BookOpen size={48} style={{ color: 'var(--color-primary)', marginBottom: '16px' }} />
          <h3 style={{ marginBottom: '8px' }}>Visualize Note as an Anime Manga Strip</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', maxWidth: '500px', margin: '0 auto 24px auto' }}>
            Transform your study text into a classic Japanese Manga layout! Generates characters, anime dialogue, storyboard sketches with onomatopoeia sound effects, and comic ink filters.
          </p>
          <button className="btn btn-primary shake-hover" onClick={generateComic}>
            <Sparkles size={16} /> Draw Manga Layout
          </button>
        </div>
      ) : (
        <div className="comic-grid">
          {displayedPanels.map((panel, idx) => {
            // If in Manga mode, we apply monochrome halftone styles
            const panelStyle = isMangaMode ? {
              border: '4px solid #121212',
              boxShadow: '4px 4px 0px #121212',
              background: '#ffffff',
              transition: 'transform 0.2s ease'
            } : {};

            const illustrationStyle = isMangaMode ? {
              // Classic screentone halftone dot background
              backgroundImage: 'radial-gradient(rgba(0, 0, 0, 0.15) 15%, transparent 16%), radial-gradient(rgba(0, 0, 0, 0.15) 15%, transparent 16%)',
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 4px 4px',
              backgroundColor: '#ffffff',
              border: '2px solid #121212'
            } : {
              backgroundColor: idx % 3 === 0 ? '#E8F5E9' : idx % 3 === 1 ? '#ECEFF1' : '#FFF3E0'
            };

            const speechBubbleStyle = isMangaMode ? {
              border: '3px solid #121212',
              fontWeight: 800,
              fontFamily: 'var(--font-sans)',
              boxShadow: '2px 2px 0px rgba(0,0,0,1)'
            } : {};

            const narrationStyle = isMangaMode ? {
              background: '#e0e0e0',
              border: '2px solid #121212',
              fontFamily: 'var(--font-title)',
              fontWeight: 800,
              boxShadow: '2px 2px 0px #000'
            } : {};

            return (
              <div key={panel.panelNumber} className="comic-panel" style={panelStyle}>
                <div className="panel-header" style={{ borderColor: isMangaMode ? '#121212' : undefined }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isMangaMode && <ArrowLeft size={12} style={{ opacity: 0.5 }} />}
                    PANEL {panel.panelNumber}
                  </span>
                  <span className="panel-emoji" style={{ filter: isMangaMode ? 'grayscale(1)' : 'none' }}>
                    {panel.characterEmoji || '💡'}
                  </span>
                </div>
                
                {/* Illustration storyboard representation */}
                <div className="panel-illustration" style={illustrationStyle}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', width: '100%', marginBottom: '10px' }}>
                    <img 
                      src={getCharacterAvatar(panel.characterEmoji)} 
                      alt="speaker" 
                      style={{ 
                        width: '64px', 
                        height: '64px', 
                        borderRadius: '8px', 
                        border: '3px solid #121212',
                        background: '#ffffff',
                        boxShadow: '2px 2px 0px #121212',
                        filter: isMangaMode ? 'grayscale(1) contrast(1.2)' : 'none',
                        flexShrink: 0
                      }} 
                    />
                    <div className="speech-bubble-left" style={{ ...speechBubbleStyle, flex: 1, margin: 0 }}>
                      {panel.dialogue}
                    </div>
                  </div>
                  
                  <div className="panel-visual-desc" style={{ color: isMangaMode ? '#121212' : undefined, fontWeight: isMangaMode ? 700 : undefined }}>
                    🖌️ Manga Ink: {panel.visualDescription}
                  </div>
                </div>
                
                <div className="panel-narration" style={narrationStyle}>
                  📝 {panel.narration}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
