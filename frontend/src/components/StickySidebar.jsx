import React, { useState } from 'react'
import { Sparkles, Trash2, Plus, Brain, FileText, Bookmark, Layers, ChevronRight, ChevronLeft } from 'lucide-react'

export default function StickySidebar({ stickies, onAddSticky, onDeleteSticky, onGenerateAIStickies, currentNoteText }) {
  const [newStickyText, setNewStickyText] = useState('')
  const [selectedColor, setSelectedColor] = useState('#ffe57f') // Yellow default
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [isOpen, setIsOpen] = useState(false)

  const colors = [
    { code: '#ffe57f', name: 'Yellow' },
    { code: '#ff8a80', name: 'Pink' },
    { code: '#ccff90', name: 'Green' },
    { code: '#82b1ff', name: 'Blue' },
    { code: '#ffd180', name: 'Orange' },
  ]

  const handleManualAdd = (e) => {
    e.preventDefault()
    if (!newStickyText.trim()) return
    onAddSticky(newStickyText, selectedColor)
    setNewStickyText('')
  }

  const handleAIGeneration = async (type) => {
    if (!currentNoteText || !currentNoteText.trim()) {
      alert('The current note is empty! Write some text first to generate AI stickies.')
      return
    }
    setIsGenerating(true)
    try {
      await onGenerateAIStickies(currentNoteText, type)
      setActiveTab(type) // Switch to the newly generated type tab
    } catch (err) {
      console.error(err)
    } finally {
      setIsGenerating(false)
    }
  }

  const filteredStickies = stickies.filter(sticky => {
    if (activeTab === 'all') return true
    if (activeTab === 'manual') return !sticky.type || sticky.type === 'manual'
    return sticky.type === activeTab
  })

  return (
    <div 
      style={{
        position: 'fixed',
        top: '70px',
        right: isOpen ? '0' : '-320px',
        width: '320px',
        height: 'calc(100vh - 70px)',
        transition: 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 900,
        boxShadow: isOpen ? '-5px 0 25px rgba(0,0,0,0.1)' : 'none'
      }}
    >
      {/* Toggle Button / Tab */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'absolute',
          left: '-40px',
          top: '24px',
          width: '40px',
          height: '120px',
          background: 'var(--bg-sidebar)',
          border: '2px solid var(--border-color)',
          borderRight: 'none',
          borderRadius: '12px 0 0 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '-4px 4px 0px rgba(0,0,0,0.05)',
          zIndex: 901
        }}
        title={isOpen ? "Close Stickies" : "Open Stickies"}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          {isOpen ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          <span style={{ writingMode: 'vertical-rl', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-dark)' }}>STICKIES</span>
        </div>
      </button>

      <aside className="sticky-sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', borderLeft: '2px solid var(--border-color)' }}>
        <div className="sidebar-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            📌 Sticky Notepad
          </h3>

        {/* AI Action Drawer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            ⚡ AI MEMORY ASSISTANT
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <button 
              className="btn btn-warning shake-hover" 
              style={{ fontSize: '0.75rem', padding: '6px 8px' }}
              onClick={() => handleAIGeneration('summary')}
              disabled={isGenerating || !currentNoteText}
              title="Summarize key points into stickies"
            >
              <FileText size={14} /> Summarize
            </button>
            <button 
              className="btn btn-primary shake-hover" 
              style={{ fontSize: '0.75rem', padding: '6px 8px', backgroundColor: 'var(--color-accent)' }}
              onClick={() => handleAIGeneration('mnemonic')}
              disabled={isGenerating || !currentNoteText}
              title="Create memory mnemonics"
            >
              <Brain size={14} /> Mnemonics
            </button>
          </div>
          <button 
            className="btn btn-success shake-hover" 
            style={{ fontSize: '0.75rem', padding: '6px 12px', width: '100%' }}
            onClick={() => handleAIGeneration('short')}
            disabled={isGenerating || !currentNoteText}
            title="Create quick bullet notes cards"
          >
            <Bookmark size={14} /> Quick Study Cards
          </button>
        </div>

        {/* Manual Addition Form */}
        <form onSubmit={handleManualAdd} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          <textarea
            className="input-field"
            placeholder="Type a quick note..."
            style={{ 
              height: '60px', 
              fontSize: '0.85rem', 
              resize: 'none', 
              fontFamily: 'var(--font-handwritten)' 
            }}
            value={newStickyText}
            onChange={(e) => setNewStickyText(e.target.value)}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Color selectors */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {colors.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  style={{
                    width: '18px',
                    height: '18px',
                    backgroundColor: c.code,
                    border: selectedColor === c.code ? '2px solid var(--border-color)' : '1px solid #ccc',
                    borderRadius: '50%',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedColor(c.code)}
                  title={c.name}
                />
              ))}
            </div>
            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              <Plus size={14} /> Stick it
            </button>
          </div>
        </form>

        {/* Tabs for Filtering */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              padding: '4px 8px', fontSize: '0.7rem', borderRadius: '4px', cursor: 'pointer',
              backgroundColor: activeTab === 'all' ? 'var(--color-primary)' : '#eee',
              color: activeTab === 'all' ? '#fff' : '#333', border: 'none', display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            <Layers size={12} /> All
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            style={{
              padding: '4px 8px', fontSize: '0.7rem', borderRadius: '4px', cursor: 'pointer',
              backgroundColor: activeTab === 'summary' ? 'var(--color-warning)' : '#eee',
              color: '#333', border: 'none', display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            <FileText size={12} /> Summary
          </button>
          <button
            onClick={() => setActiveTab('mnemonic')}
            style={{
              padding: '4px 8px', fontSize: '0.7rem', borderRadius: '4px', cursor: 'pointer',
              backgroundColor: activeTab === 'mnemonic' ? 'var(--color-accent)' : '#eee',
              color: activeTab === 'mnemonic' ? '#fff' : '#333', border: 'none', display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            <Brain size={12} /> Mnemonic
          </button>
          <button
            onClick={() => setActiveTab('short')}
            style={{
              padding: '4px 8px', fontSize: '0.7rem', borderRadius: '4px', cursor: 'pointer',
              backgroundColor: activeTab === 'short' ? 'var(--color-success)' : '#eee',
              color: activeTab === 'short' ? '#fff' : '#333', border: 'none', display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            <Bookmark size={12} /> Quick Study
          </button>
        </div>
      </div>

      {/* Sticky Notes Scroll */}
      <div className="sidebar-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        {isGenerating && (
          <div style={{ 
            textAlign: 'center', 
            padding: '20px', 
            fontFamily: 'var(--font-handwritten)',
            color: 'var(--text-muted)',
            border: '2px dashed #999',
            borderRadius: '6px',
            marginBottom: '10px'
          }}>
            ✍️ AI is writing sticky notes...
          </div>
        )}
        
        {filteredStickies.length === 0 && !isGenerating ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '30px 10px', 
            color: '#666',
            fontFamily: 'var(--font-handwritten)',
            fontSize: '1rem',
            border: '2px dashed #ccc',
            borderRadius: '8px'
          }}>
            No stickies found for this filter.
          </div>
        ) : (
          filteredStickies.map((sticky) => (
            <div 
              key={sticky.id} 
              className="sticky-note" 
              style={{ backgroundColor: sticky.color }}
            >
              <div className="sticky-content">{sticky.content}</div>
              <div className="sticky-footer">
                <button 
                  className="sticky-btn-delete"
                  onClick={() => onDeleteSticky(sticky.id)}
                  title="Remove Sticky"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
    </div>
  )
}
