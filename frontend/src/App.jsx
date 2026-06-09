import React, { useState, useEffect } from 'react'
import { LogOut, Plus, Sparkles, Trash2, FileText, ChevronRight, Folder, Book, ArrowLeft, Paintbrush, Edit3, X, Calendar, Star } from 'lucide-react'
import Login from './components/Login'
import Loader from './components/Loader'
import NoteEditor from './components/NoteEditor'
import StickySidebar from './components/StickySidebar'
import DigitalClock from './components/DigitalClock'
import ComicView from './components/ComicView'

import DailyTasks from './components/DailyTasks'
import FeedbackHub from './components/FeedbackHub'

export default function App() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [showDailyTasks, setShowDailyTasks] = useState(false)
  const [showFeedbackHub, setShowFeedbackHub] = useState(false)

  // Notebooks and Pages States
  const [notebooks, setNotebooks] = useState([])
  const [selectedNotebook, setSelectedNotebook] = useState(null)
  const [notes, setNotes] = useState([]) // Pages in current notebook
  const [selectedNote, setSelectedNote] = useState(null) // Active page; null means showing cover page
  const [stickies, setStickies] = useState([])
  const [collapsedChapters, setCollapsedChapters] = useState({})

  // Form/Input States
  const [newNotebookSubject, setNewNotebookSubject] = useState('')
  const [newNotebookColor, setNewNotebookColor] = useState('#3d5afe')
  const [newNotePrompt, setNewNotePrompt] = useState('')
  const [creatingNotebook, setCreatingNotebook] = useState(false)
  const [creatingNote, setCreatingNote] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')

  const coverColorOptions = [
    { name: 'Navy Blue', code: '#3d5afe' },
    { name: 'Crimson', code: '#ff1744' },
    { name: 'Emerald', code: '#00e676' },
    { name: 'Amber', code: '#ff9100' },
    { name: 'Purple', code: '#d500f9' },
    { name: 'Charcoal', code: '#212121' }
  ]

  // Auth setup check
  useEffect(() => {
    const savedToken = localStorage.getItem('notes_token')
    const savedUser = localStorage.getItem('notes_user')
    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
  }, [])

  // Load Notebooks
  useEffect(() => {
    if (token) {
      fetchNotebooks()
    }
  }, [token])

  // Load pages when notebook changes
  useEffect(() => {
    if (token && selectedNotebook) {
      fetchNotes(selectedNotebook.id)
      setSelectedNote(null) // Reset to Cover view when opening a notebook
    }
  }, [selectedNotebook, token])

  const handleAuthSuccess = (userData, userToken) => {
    setUser(userData)
    setToken(userToken)
  }

  const handleLogout = () => {
    localStorage.removeItem('notes_token')
    localStorage.removeItem('notes_user')
    setUser(null)
    setToken('')
    setNotebooks([])
    setSelectedNotebook(null)
    setNotes([])
    setSelectedNote(null)
    setStickies([])
  }

  // ==========================================
  // NOTEBOOK OPERATIONS
  // ==========================================

  const fetchNotebooks = async () => {
    try {
      const response = await fetch('/api/notebooks', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      setNotebooks(data)
    } catch (err) {
      console.error('Failed to fetch notebooks:', err)
    }
  }

  const handleCreateNotebook = async (e) => {
    if (e) e.preventDefault()
    if (!newNotebookSubject.trim()) return
    setCreatingNotebook(true)

    try {
      const response = await fetch('/api/notebooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          subject: newNotebookSubject,
          cover_color: newNotebookColor
        })
      })
      const newBook = await response.json()
      setNotebooks([newBook, ...notebooks])
      setSelectedNotebook(newBook)
      setNewNotebookSubject('')
    } catch (err) {
      console.error('Failed to create notebook:', err)
    } finally {
      setCreatingNotebook(false)
    }
  }

  const handleUpdateNotebook = async (id, subject, color) => {
    try {
      const response = await fetch(`/api/notebooks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ subject, cover_color: color })
      })
      const updated = await response.json()
      setNotebooks(notebooks.map(b => b.id === id ? updated : b))
      setSelectedNotebook(updated)
    } catch (err) {
      console.error('Failed to update notebook cover:', err)
    }
  }

  const handleDeleteNotebook = async (id, e) => {
    if (e) e.stopPropagation()
    if (!confirm('Are you sure you want to delete this subject notebook? All pages will be permanently deleted.')) return
    try {
      await fetch(`/api/notebooks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setNotebooks(notebooks.filter(b => b.id !== id))
      if (selectedNotebook && selectedNotebook.id === id) {
        setSelectedNotebook(null)
        setNotes([])
        setSelectedNote(null)
      }
    } catch (err) {
      console.error('Failed to delete notebook:', err)
    }
  }

  const handleRenameChapter = async (oldChapterName) => {
    if (!selectedNotebook) return;
    const newChapterName = prompt(`Enter new name for chapter "${oldChapterName}":`, oldChapterName);
    if (!newChapterName || newChapterName.trim() === '' || newChapterName === oldChapterName) return;

    try {
      const response = await fetch(`/api/notebooks/${selectedNotebook.id}/chapters`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ oldChapterName, newChapterName: newChapterName.trim() })
      });
      
      if (!response.ok) throw new Error('Failed to rename chapter');
      
      // Update local state
      setNotes(prevNotes => prevNotes.map(n => {
        const currentChapter = n.chapter || 'Uncategorized';
        if (currentChapter === oldChapterName) {
          return { ...n, chapter: newChapterName.trim() };
        }
        return n;
      }));

      setSelectedNote(prevNote => {
        if (prevNote && (prevNote.chapter || 'Uncategorized') === oldChapterName) {
          return { ...prevNote, chapter: newChapterName.trim() };
        }
        return prevNote;
      });
      
      // Also update collapsedChapters state if it was collapsed
      setCollapsedChapters(prev => {
        const next = { ...prev };
        if (next[oldChapterName] !== undefined) {
          next[newChapterName.trim()] = next[oldChapterName];
          delete next[oldChapterName];
        }
        return next;
      });
      
    } catch (err) {
      console.error('Failed to rename chapter:', err);
    }
  }

  // ==========================================
  // PAGE (NOTE) OPERATIONS
  // ==========================================

  const fetchNotes = async (notebookId) => {
    try {
      const response = await fetch(`/api/notes?notebook_id=${notebookId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      setNotes(data)
    } catch (err) {
      console.error('Failed to fetch pages:', err)
    }
  }

  const fetchNoteDetail = async (id) => {
    try {
      const response = await fetch(`/api/notes/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      setSelectedNote(data)
      fetchStickies(id)
    } catch (err) {
      console.error('Failed to fetch page details:', err)
    }
  }

  const fetchStickies = async (noteId) => {
    if (!noteId) {
      setStickies([])
      return
    }
    try {
      const response = await fetch(`/api/stickies?note_id=${noteId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await response.json()
      setStickies(data)
    } catch (err) {
      console.error('Failed to fetch stickies:', err)
    }
  }

  const handleCreateNote = async (promptText = '', chapterName = 'Uncategorized') => {
    if (!selectedNotebook) return
    setCreatingNote(true)
    try {
      const body = promptText
        ? { notebook_id: selectedNotebook.id, prompt: promptText, chapter: chapterName }
        : { notebook_id: selectedNotebook.id, title: 'Untitled Page', content: 'Draft your study topic here...', page_marker_color: 'yellow', chapter: chapterName }

      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })
      const newPage = await response.json()

      const pageWithArrays = {
        ...newPage,
        highlights: [],
        sideNotes: []
      }

      setNotes(prevNotes => [...prevNotes, pageWithArrays])
      setSelectedNote(pageWithArrays)
      setStickies([])
      setNewNotePrompt('')
    } catch (err) {
      console.error('Failed to create page:', err)
    } finally {
      setCreatingNote(false)
    }
  }

  const handleUpdateNote = async (id, title, content, chapter, page_marker_color, drawing_data) => {
    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, content, chapter, page_marker_color, drawing_data })
      })
      const updated = await response.json()

      // Update list
      setNotes(prevNotes => prevNotes.map(n => n.id === id ? { ...n, title, content, chapter, page_marker_color, drawing_data: drawing_data !== undefined ? drawing_data : n.drawing_data } : n))
      setSelectedNote(prevNote => {
        if (!prevNote || prevNote.id !== id) return prevNote;
        return {
          ...prevNote,
          title,
          content,
          chapter,
          page_marker_color,
          drawing_data: drawing_data !== undefined ? drawing_data : prevNote.drawing_data
        }
      })
    } catch (err) {
      console.error('Failed to update page:', err)
    }
  }

  const handleDeleteNote = async (id, e) => {
    if (e) e.stopPropagation()
    if (!confirm('Are you sure you want to tear this page out?')) return
    try {
      await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const remaining = notes.filter(n => n.id !== id)
      setNotes(remaining)
      if (selectedNote && selectedNote.id === id) {
        setSelectedNote(null) // Return to Cover
      }
    } catch (err) {
      console.error('Failed to delete page:', err)
    }
  }

  // ==========================================
  // HIGHLIGHT OPERATIONS
  // ==========================================

  const handleAddHighlight = async (noteId, start, end, color, text) => {
    try {
      const response = await fetch(`/api/notes/${noteId}/highlights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ start_index: start, end_index: end, color, text })
      })
      const newHl = await response.json()

      setSelectedNote(prevNote => {
        if (!prevNote || prevNote.id !== noteId) return prevNote;
        const filteredHighlights = (prevNote.highlights || []).filter(
          h => !(h.start_index < end && h.end_index > start)
        );
        return {
          ...prevNote,
          highlights: [...filteredHighlights, newHl]
        }
      })
      return newHl
    } catch (err) {
      console.error('Failed to save highlight:', err)
    }
  }

  const handleDeleteHighlight = async (noteId, highlightId) => {
    try {
      await fetch(`/api/notes/${noteId}/highlights/${highlightId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setSelectedNote(prevNote => {
        if (!prevNote || prevNote.id !== noteId) return prevNote;
        return {
          ...prevNote,
          highlights: (prevNote.highlights || []).filter(h => h.id !== highlightId),
          sideNotes: (prevNote.sideNotes || []).filter(sn => sn.highlight_id !== highlightId)
        }
      })
    } catch (err) {
      console.error('Failed to delete highlight:', err)
    }
  }

  // ==========================================
  // SIDE NOTE OPERATIONS
  // ==========================================

  const handleAddSideNote = async (noteId, highlightId, content, posY) => {
    try {
      const response = await fetch(`/api/notes/${noteId}/sidenotes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ highlight_id: highlightId, content, position_y: posY })
      })
      const newSideNote = await response.json()

      setSelectedNote(prevNote => {
        if (!prevNote || prevNote.id !== noteId) return prevNote;
        return {
          ...prevNote,
          sideNotes: [...(prevNote.sideNotes || []), newSideNote]
        }
      })
    } catch (err) {
      console.error('Failed to add side note:', err)
    }
  }

  const handleDeleteSideNote = async (noteId, sideNoteId) => {
    try {
      await fetch(`/api/notes/${noteId}/sidenotes/${sideNoteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setSelectedNote(prevNote => {
        if (!prevNote || prevNote.id !== noteId) return prevNote;
        return {
          ...prevNote,
          sideNotes: (prevNote.sideNotes || []).filter(sn => sn.id !== sideNoteId)
        }
      })
    } catch (err) {
      console.error('Failed to delete side note:', err)
    }
  }

  // ==========================================
  // STICKY NOTES OPERATIONS
  // ==========================================

  const handleAddSticky = async (content, color) => {
    if (!selectedNote) return
    try {
      const response = await fetch('/api/stickies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content, color, note_id: selectedNote.id })
      })
      const newSticky = await response.json()
      setStickies(prev => [newSticky, ...prev])
    } catch (err) {
      console.error('Failed to save sticky note:', err)
    }
  }

  const handleGenerateAIStickies = async (text, type) => {
    if (!selectedNote) return
    try {
      const response = await fetch('/api/stickies/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text, type, note_id: selectedNote.id })
      })
      const newStickies = await response.json()
      setStickies(prev => [...newStickies, ...prev])
    } catch (err) {
      console.error('Failed to generate AI stickies:', err)
      throw err
    }
  }

  const handleDeleteSticky = async (id) => {
    try {
      await fetch(`/api/stickies/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setStickies(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      console.error('Failed to delete sticky:', err)
    }
  }

  // ==========================================
  // AI TEXT ANALYZER API CALL
  // ==========================================

  const handleExplainText = async (selectedText, contextText) => {
    const response = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ selectedText, contextText })
    })
    console.log(response);
    const data = await response.json()
    // console.log(data)
    return data.explanation
  }

  const handleImportDoc = async (file) => {
    if (!file || !selectedNotebook) return;
    setUploadingDoc(true);
    setUploadProgress("Reading and uploading document...");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("notebook_id", selectedNotebook.id);

    try {
      setUploadProgress("AI is parsing text content and examining chapter structure...");
      const response = await fetch("/api/notes/import-doc", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process document");
      }

      setUploadProgress("Success! Formatting chapter notes inside notebook...");

      // Update the local list of notes pages
      setNotes(prev => [...prev, ...data.notes]);

      // Select the first generated chapter notes page
      if (data.notes && data.notes.length > 0) {
        fetchNoteDetail(data.notes[0].id);
      }

      alert(`Success! Imported "${file.name}" and generated notes for ${data.notes.length} chapters.`);
      setShowUploadModal(false);
    } catch (err) {
      alert(`Error importing document: ${err.message}`);
    } finally {
      setUploadingDoc(false);
      setUploadProgress("");
    }
  };

  if (loading) {
    return <Loader text="Opening Notebook Vault..." />
  }

  if (!user) {
    return <Login onAuthSuccess={handleAuthSuccess} />
  }

  return (
    <div className="app-container">

      {/* Sidebar (Only shown if a notebook is active) */}
      {selectedNotebook && (
        <div
          style={{
            width: '280px',
            borderRight: 'var(--border-width) solid var(--border-color)',
            background: 'var(--bg-sidebar)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div>
            <div style={{ padding: '24px 20px', borderBottom: '2px solid var(--border-color)', background: '#ffffff' }}>
              <button
                className="btn btn-warning"
                style={{ width: '100%', fontSize: '0.85rem' }}
                onClick={() => setSelectedNotebook(null)}
              >
                <ArrowLeft size={14} /> Back to Shelf
              </button>
            </div>

            <div style={{ padding: '20px 20px 10px 20px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                📖 ACTIVE BOOK
              </div>
              <h3 style={{ textTransform: 'uppercase', fontSize: '1.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedNotebook.subject}
              </h3>
            </div>

            <div style={{ padding: '10px 20px 8px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, display: 'flex', justifyContent: 'center', fontSize: '0.85rem', padding: '8px' }}
                  onClick={() => handleCreateNote()}
                  title="Create new page in Uncategorized"
                >
                  <Plus size={14} /> New Page
                </button>
                <button
                  className="btn btn-success"
                  style={{ flex: 1, display: 'flex', justifyContent: 'center', fontSize: '0.85rem', padding: '8px' }}
                  onClick={() => {
                    const chap = prompt('Enter new Chapter name:');
                    if (chap) handleCreateNote('', chap);
                  }}
                  title="Create a new Chapter with an empty page"
                >
                  <Plus size={14} /> New Chapter
                </button>
              </div>
              <button
                className="btn"
                style={{ width: '100%', display: 'flex', justifyContent: 'center', fontSize: '0.85rem', gap: '6px' }}
                onClick={() => setShowUploadModal(true)}
              >
                <FileText size={14} /> Import Book / Doc
              </button>
            </div>

            {/* Sidebar Notebook Pages List */}
            <div className="notes-tabs-list" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 280px)' }}>

              {/* Cover Page Tab Link */}
              <div
                className={`note-tab-item ${selectedNote === null ? 'active' : ''}`}
                onClick={() => setSelectedNote(null)}
                style={{ borderStyle: 'dashed' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Book size={15} />
                  <span className="note-tab-title">📔 Subject Cover</span>
                </div>
              </div>

              {notes.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#666', fontStyle: 'italic', fontSize: '0.8rem', marginTop: '20px', fontFamily: 'var(--font-handwritten)' }}>
                  Notebook is empty.
                </p>
              ) : (
                Object.entries(notes.reduce((acc, note) => {
                  const chap = note.chapter || 'Uncategorized';
                  if (!acc[chap]) acc[chap] = [];
                  acc[chap].push(note);
                  return acc;
                }, {})).map(([chapterName, chapterNotes]) => (
                  <div key={chapterName} className="chapter-container">
                    <div 
                      className="chapter-header"
                      onClick={() => setCollapsedChapters(prev => ({ ...prev, [chapterName]: !prev[chapterName] }))}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Folder size={15} />
                        <span>{chapterName}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          className="btn btn-icon shake-hover"
                          style={{ width: '22px', height: '22px', border: '1px solid var(--border-color)', padding: 0, borderRadius: '4px', backgroundColor: '#fff' }}
                          title="Rename Chapter"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameChapter(chapterName);
                          }}
                        >
                          <Edit3 size={12} color="var(--text-muted)" />
                        </button>
                        <button
                          className="btn btn-icon shake-hover"
                          style={{ width: '22px', height: '22px', border: '1px solid var(--border-color)', padding: 0, borderRadius: '4px', backgroundColor: '#fff' }}
                          title="Generate Note with AI"
                          onClick={(e) => {
                            e.stopPropagation();
                            const topic = prompt(`What topic should AI write about in ${chapterName}?`);
                            if (topic) handleCreateNote(topic, chapterName);
                          }}
                        >
                          <Sparkles size={12} color="var(--color-accent)" />
                        </button>
                        <span style={{ fontSize: '0.8rem' }}>{collapsedChapters[chapterName] ? '▼' : '▲'}</span>
                      </div>
                    </div>
                    <div className={`chapter-pages ${collapsedChapters[chapterName] ? 'collapsed' : ''}`}>
                      {chapterNotes.map((n, idx) => (
                        <div
                          key={n.id}
                          className={`page-box ${selectedNote?.id === n.id ? 'active' : ''}`}
                          onClick={() => fetchNoteDetail(n.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '2px',
                                border: '1px solid #000'
                              }}
                              className={`tab-${n.page_marker_color || 'yellow'}`}
                            />
                            <span className="page-box-title" title={n.title}>P{n.page_number || idx + 1}. {n.title}</span>
                          </div>
                          <button
                            className="page-delete-btn"
                            onClick={(e) => handleDeleteNote(n.id, e)}
                            title="Delete Page"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ padding: '16px 20px', borderTop: '2px solid var(--border-color)', background: '#ffffff' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800 }}>👤 {user.username}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Workspace active</div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="main-content" style={{ position: 'relative' }}>
        {showDailyTasks && <DailyTasks onClose={() => setShowDailyTasks(false)} />}
        {showFeedbackHub && <FeedbackHub onClose={() => setShowFeedbackHub(false)} token={token} currentUser={user} />}

        {/* Header */}
        <header className="app-header">
          <div className="logo" style={{ cursor: 'pointer' }} onClick={() => setSelectedNotebook(null)}>
            📝 <span>RetroNotes</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="btn btn-icon shake-hover" onClick={() => setShowFeedbackHub(true)} title="Feedback Hub" style={{ width: '36px', height: '36px', border: '2px solid var(--border-color)', borderRadius: '50%', color: '#ff9100' }}>
              <Star size={16} />
            </button>
            <button className="btn btn-icon shake-hover" onClick={() => setShowDailyTasks(true)} title="Daily Tasks" style={{ width: '36px', height: '36px', border: '2px solid var(--border-color)', borderRadius: '50%' }}>
              <Calendar size={16} />
            </button>
            <div style={{ fontSize: '0.9rem', fontWeight: 800 }}>
              👤 {user.username}
            </div>
            <button
              className="btn btn-icon shake-hover"
              style={{ width: '36px', height: '36px', border: '2px solid var(--border-color)', borderRadius: '50%' }}
              onClick={handleLogout}
              title="Log Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Workspace Display Grid */}
        {!selectedNotebook ? (
          /* ==========================================
             SHELF VIEW: STANDALONE LIBRARY DESK
             ========================================== */
          <div className="bookshelf-container">

            {/* Shelf Creator Card */}
            <div className="card" style={{ marginBottom: '40px', background: '#ffffff' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                🎨 Craft a Subject Notebook
              </h3>

              <form onSubmit={handleCreateNotebook} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <label className="form-label">Subject Name</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. ORGANIC CHEMISTRY, WORLD WAR II..."
                    value={newNotebookSubject}
                    onChange={(e) => setNewNotebookSubject(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Notebook Cover Color</label>
                  <div style={{ display: 'flex', gap: '8px', padding: '6px' }}>
                    {coverColorOptions.map(option => (
                      <button
                        key={option.code}
                        type="button"
                        className={`notebook-color-swatch-btn ${newNotebookColor === option.code ? 'active' : ''}`}
                        style={{ backgroundColor: option.code }}
                        onClick={() => setNewNotebookColor(option.code)}
                        title={option.name}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creatingNotebook || !newNotebookSubject.trim()}
                  style={{ height: '48px' }}
                >
                  <Plus size={16} /> Craft Book
                </button>
              </form>
            </div>

            {/* Bookshelf Visual Grid */}
            <div className="bookshelf-title">
              <span>📚 Your Subject Notebook Shelf</span>
              <span style={{ fontSize: '0.9rem', color: '#555', fontFamily: 'var(--font-handwritten)' }}>
                {notebooks.length} books in library
              </span>
            </div>

            {notebooks.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                border: '3px dashed var(--border-color)',
                borderRadius: '12px',
                background: '#faf6ee',
                fontFamily: 'var(--font-handwritten)',
                fontSize: '1.25rem'
              }}>
                📖 Your shelf is bare. Craft a subject notebook above to begin!
              </div>
            ) : (
              <div className="bookshelf-grid">
                {notebooks.map((book) => (
                  <div
                    key={book.id}
                    className="notebook-shelf-item"
                    onClick={() => setSelectedNotebook(book)}
                  >
                    <div className="notebook-cover-3d" style={{ backgroundColor: book.cover_color }}>
                      <div className="cover-label-paper">
                        {book.subject}
                      </div>
                      <div className="notebook-cover-footer">
                        蔵書
                      </div>
                    </div>
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: '50%', padding: '4px' }}
                        onClick={(e) => handleDeleteNotebook(book.id, e)}
                        title="Burn Notebook"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ==========================================
             OPENED SUBJECT NOTEBOOK VIEW
             ========================================== */
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>

            {/* Control Panel inside active notebook */}
            <section className="notebook-control-panel">
              {/* AI Creator Bar */}
              <div className="ai-creator-bar">
                <Sparkles size={24} style={{ color: 'var(--color-primary)', alignSelf: 'center' }} />
                <input
                  type="text"
                  className="input-field"
                  placeholder={`Draft a page about anything inside "${selectedNotebook.subject}"...`}
                  value={newNotePrompt}
                  onChange={(e) => setNewNotePrompt(e.target.value)}
                  disabled={creatingNote}
                  style={{ flex: 1 }}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateNote(newNotePrompt)}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => handleCreateNote(newNotePrompt)}
                  disabled={creatingNote || !newNotePrompt.trim()}
                >
                  {creatingNote ? 'Drafting...' : 'Draft with Gemini'}
                </button>
              </div>
            </section>

            {creatingNote && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '12px',
                margin: '20px auto 0 auto',
                padding: '12px 24px',
                border: '2px solid var(--border-color)',
                background: '#ffffff',
                borderRadius: '6px',
                boxShadow: 'var(--shadow-flat)',
                fontFamily: 'var(--font-handwritten)',
                fontWeight: 600
              }}>
                ✍️ Gemini is drafting and formatting a topic page inside {selectedNotebook.subject}...
              </div>
            )}

            {/* Notebook Covers & Pages Rendering Container */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

              {selectedNote === null ? (
                /* ==========================================
                   RELIABLE WIDE REAL NOTEBOOK COVER PAGE
                   ========================================== */
                <div style={{ maxWidth: '1150px', margin: '32px auto', padding: '0 32px', width: '100%', position: 'relative' }}>

                  {/* Physical Tabs sticking out of Cover */}
                  <div className="pagemarkers-tabs-container">
                    <button
                      type="button"
                      className="pagemarker-tab tab-cover active"
                      onClick={() => setSelectedNote(null)}
                      title="Notebook Cover"
                    >
                      Cover
                    </button>
                    {notes.map((n, i) => (
                      <button
                        key={n.id}
                        type="button"
                        className={`pagemarker-tab tab-${n.page_marker_color || 'yellow'}`}
                        onClick={() => fetchNoteDetail(n.id)}
                        title={`Page ${i + 1}: ${n.title}`}
                      >
                        P{i + 1}
                      </button>
                    ))}
                  </div>

                  <div
                    className="notebook-cover-sheet"
                    style={{
                      borderColor: 'var(--border-color)',
                      backgroundColor: selectedNotebook.cover_color,
                      color: '#ffffff',
                      boxShadow: 'var(--shadow-medium)'
                    }}
                  >
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                      {/* Leather style Cover Color switch swatches */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 1, margin: '30px 0' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f0f0f0', letterSpacing: '0.05em' }}>
                          CHOOSE LEATHER COVER STYLE
                        </span>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                          {coverColorOptions.map(option => (
                            <button
                              key={option.code}
                              type="button"
                              className={`notebook-color-swatch-btn ${selectedNotebook.cover_color === option.code ? 'active' : ''}`}
                              style={{ backgroundColor: option.code }}
                              onClick={() => handleUpdateNotebook(selectedNotebook.id, selectedNotebook.subject, option.code)}
                            />
                          ))}
                        </div>
                      </div>

                      <div style={{ fontFamily: 'var(--font-handwritten)', fontSize: '1.1rem', color: '#f0f0f0' }}>
                        💡 Click the page tab markers on the right edge to flip pages
                      </div>
                    </div>

                    <div className="notebook-cover-plate">
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        SUBJECT NOTEBOOK
                      </div>

                      <input
                        type="text"
                        value={selectedNotebook.subject}
                        onChange={(e) => handleUpdateNotebook(selectedNotebook.id, e.target.value, selectedNotebook.cover_color)}
                        style={{
                          fontFamily: 'var(--font-title)',
                          fontWeight: 800,
                          fontSize: '2.5rem',
                          border: 'none',
                          background: 'transparent',
                          textAlign: 'center',
                          width: '100%',
                          outline: 'none',
                          borderBottom: '2px solid var(--border-color)',
                          color: 'var(--text-dark)'
                        }}
                        placeholder="Notebook Subject"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* ==========================================
                   ACTIVE NOTES PAGE (WIDE FULL WIDTH EDITOR & COMIC)
                   ========================================== */
                selectedNote && (
                  <div style={{ display: 'flex', flexDirection: 'column', width: '100%', paddingBottom: '120px' }}>

                    {/* Note Editor takes standard wide layout */}
                    <NoteEditor
                      note={selectedNote}
                      pages={notes}
                      onSelectPage={fetchNoteDetail}
                      onShowCover={() => setSelectedNote(null)}
                      onUpdateNote={handleUpdateNote}
                      onAddHighlight={handleAddHighlight}
                      onDeleteHighlight={handleDeleteHighlight}
                      onAddSideNote={handleAddSideNote}
                      onDeleteSideNote={handleDeleteSideNote}
                      onExplainText={handleExplainText}
                    />

                    {/* Manga section restored to wide layout beneath sheet */}
                    <ComicView
                      noteId={selectedNote.id}
                      noteTitle={selectedNote.title}
                      noteContent={selectedNote.content}
                    />
                  </div>
                )
              )}

            </div>
          </div>
        )}

      </main>

      {/* Sticky Notepad Sidebar (only show if note is active) */}
      {selectedNotebook && selectedNote && (
        <StickySidebar
          stickies={stickies}
          onAddSticky={handleAddSticky}
          onDeleteSticky={handleDeleteSticky}
          onGenerateAIStickies={handleGenerateAIStickies}
          currentNoteText={selectedNote ? selectedNote.content : ''}
        />
      )}

      {/* Book/Document Importer Modal Overlay */}
      {showUploadModal && (
        <div className="ai-modal-overlay">
          <div className="ai-modal-card" style={{ maxWidth: '480px' }}>
            <div className="ai-modal-header">
              <h3>📁 Import Book / Study Doc</h3>
              <button className="sticky-btn-delete" onClick={() => !uploadingDoc && setShowUploadModal(false)} disabled={uploadingDoc}>
                <X size={20} />
              </button>
            </div>

            {uploadingDoc ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <div className="loader-book" style={{ margin: '0 auto 20px auto' }}>
                  <div className="loader-page"></div>
                </div>
                <h4 style={{ marginBottom: '10px', color: 'var(--color-primary)' }}>🤖 AI Chapter Architect</h4>
                <p style={{ fontFamily: 'var(--font-handwritten)', fontSize: '1.1rem', color: 'var(--text-muted)' }}>
                  {uploadProgress}
                </p>
                <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '15px' }}>
                  (For larger textbooks, this can take a minute as Gemini parses chapters sequentially...)
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Upload any educational textbook, document, or outline. Our AI will automatically partition the book into chapters and generate rich study notes pages for each chapter.
                </p>

                <div style={{
                  border: '3px dashed var(--border-color)',
                  borderRadius: '8px',
                  padding: '30px 20px',
                  textAlign: 'center',
                  backgroundColor: '#faf6ee',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                  onClick={() => document.getElementById('book-file-input').click()}
                >
                  <FileText size={48} style={{ margin: '0 auto 12px auto', opacity: 0.6 }} />
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Click to Choose File</div>
                  <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Supports DOCX, TXT, MD, PNG, JPG, WEBP up to 10MB</div>
                  <input
                    id="book-file-input"
                    type="file"
                    accept=".docx,.doc,.txt,.md,.png,.jpg,.jpeg,.webp"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleImportDoc(e.target.files[0]);
                      }
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button className="btn" onClick={() => setShowUploadModal(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Always visible Fixed Clock */}
      <DigitalClock />

    </div>
  )
}
