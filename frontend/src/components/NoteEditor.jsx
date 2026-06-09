import React, { useState, useRef, useEffect } from 'react'
import { Edit2, BookOpen, Sparkles, MessageSquare, Trash2, X, Play, HelpCircle, CheckCircle, XCircle, RefreshCw, Award } from 'lucide-react'
import FocusTimer from './FocusTimer'
import DigitalClock from './DigitalClock'

// Convert JSON object/array to Markdown string if needed
const tryConvertJsonToMarkdown = (text) => {
  if (!text) return '';
  const trimmed = text.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(item => `- ${item}`).join('\n');
      } else if (typeof parsed === 'object' && parsed !== null) {
        let md = '';
        for (const [key, value] of Object.entries(parsed)) {
          md += `### ${key}\n`;
          if (Array.isArray(value)) {
            md += value.map(v => `- ${v}`).join('\n') + '\n\n';
          } else if (typeof value === 'object' && value !== null) {
            md += Object.entries(value).map(([k, v]) => `- **${k}**: ${v}`).join('\n') + '\n\n';
          } else {
            md += `${value}\n\n`;
          }
        }
        return md.trim();
      }
    } catch (e) {
      // Keep as is
    }
  }
  return text;
};

export default function NoteEditor({ note, pages, onSelectPage, onShowCover, onUpdateNote, onAddHighlight, onDeleteHighlight, onAddSideNote, onDeleteSideNote, onExplainText }) {
  const [mode, setMode] = useState('study') // 'study', 'draft', or 'quiz'
  const [title, setTitle] = useState(note.title)
  const [chapter, setChapter] = useState(note.chapter || 'Uncategorized')
  const [content, setContent] = useState(note.content)
  const [selectionData, setSelectionData] = useState(null)
  const [sideNoteText, setSideNoteText] = useState('')
  const [activeSideNoteHlId, setActiveSideNoteHlId] = useState(null)
  const [explanation, setExplanation] = useState('')
  const [explaining, setExplaining] = useState(false)
  const [showExplanationModal, setShowExplanationModal] = useState(false)
  const [showAddSideNoteInput, setShowAddSideNoteInput] = useState(false)
  const [selectedTool, setSelectedTool] = useState(null)
  const [activeColor, setActiveColor] = useState('#121212')
  const [drawMode, setDrawMode] = useState('custom')
  const [drawingPaths, setDrawingPaths] = useState([])
  const [undonePaths, setUndonePaths] = useState([])
  
  const editorRef = useRef(null)
  const canvasRef = useRef(null)
  const isDrawing = useRef(false)
  const currentPath = useRef(null)

  // Quiz State
  const [quiz, setQuiz] = useState(null)
  const [loadingQuiz, setLoadingQuiz] = useState(false)
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [selectedOptionIdx, setSelectedOptionIdx] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [quizFinished, setQuizFinished] = useState(false)

  useEffect(() => {
    setTitle(note.title)
    setChapter(note.chapter || 'Uncategorized')
    setContent(tryConvertJsonToMarkdown(note.content))
    
    if (note.drawing_data) {
      try {
        setDrawingPaths(JSON.parse(note.drawing_data))
      } catch(e) { setDrawingPaths([]) }
    } else {
      setDrawingPaths([])
    }
    setUndonePaths([])
    // Reset quiz
    setQuiz(null)
    setQuizFinished(false)
    setCurrentQuestionIdx(0)
    setSelectedOptionIdx(null)
    setSubmitted(false)
    setScore(0)
    if (mode === 'quiz') {
      fetchNoteQuiz()
    }
  }, [note])

  useEffect(() => {
    if (mode === 'quiz' && !quiz) {
      fetchNoteQuiz()
    }
  }, [mode])

  const fetchNoteQuiz = async () => {
    setLoadingQuiz(true)
    try {
      const response = await fetch(`/api/notes/${note.id}/quiz`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('notes_token')}` }
      })
      const data = await response.json()
      setQuiz(data)
    } catch (err) {
      console.error('Failed to fetch quiz:', err)
    } finally {
      setLoadingQuiz(false)
    }
  }

  const generateNoteQuiz = async () => {
    setLoadingQuiz(true)
    try {
      const response = await fetch(`/api/notes/${note.id}/quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('notes_token')}`
        }
      })
      const data = await response.json()
      setQuiz(data)
      setQuizFinished(false)
      setCurrentQuestionIdx(0)
      setSelectedOptionIdx(null)
      setSubmitted(false)
      setScore(0)
    } catch (err) {
      console.error('Failed to generate quiz:', err)
    } finally {
      setLoadingQuiz(false)
    }
  }

  const handleSave = () => {
    onUpdateNote(note.id, title, content, chapter, note.page_marker_color, JSON.stringify(drawingPaths))
    setMode('study')
  }

  // --- DRAWING LOGIC ---
  const renderCanvas = () => {
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      if (canvas.width !== canvas.offsetWidth || canvas.height !== canvas.offsetHeight) {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
      }
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const pathsToDraw = Array.isArray(drawingPaths) ? [...drawingPaths] : [];
      if (currentPath.current) pathsToDraw.push(currentPath.current);
      
      pathsToDraw.forEach(path => {
        if (!path || !path.points) return;
        ctx.beginPath();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = path.color || '#000';
        
        switch(path.tool) {
          case 'gel': ctx.lineWidth = 2; break;
          case 'wood': ctx.lineWidth = 3; ctx.globalAlpha = 0.8; break;
          case 'copic': ctx.lineWidth = 20; ctx.lineCap = 'square'; ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.4; break;
          case 'brush': ctx.lineWidth = 8; break;
          case 'mono': ctx.lineWidth = 30; ctx.globalCompositeOperation = 'destination-out'; break;
          case 'ruler': ctx.lineWidth = 2; break;
          default: ctx.lineWidth = 2; break;
        }
        
        const pts = path.points;
        const mode = path.mode || 'custom';
        
        if (pts && pts.length > 0) {
          if (mode === 'line') {
            ctx.moveTo(pts[0].x || 0, pts[0].y || 0);
            if (pts.length > 1) ctx.lineTo(pts[pts.length - 1].x || 0, pts[pts.length - 1].y || 0);
          } else if (mode === 'circle') {
            if (pts.length > 1) {
              const dx = pts[1].x - pts[0].x;
              const dy = pts[1].y - pts[0].y;
              const radius = Math.sqrt(dx * dx + dy * dy);
              ctx.arc(pts[0].x, pts[0].y, radius, 0, 2 * Math.PI);
            }
          } else if (mode === 'rect') {
            if (pts.length > 1) {
              const width = pts[1].x - pts[0].x;
              const height = pts[1].y - pts[0].y;
              ctx.rect(pts[0].x, pts[0].y, width, height);
            }
          } else if (mode === 'triangle') {
            if (pts.length > 1) {
              const topX = pts[0].x;
              const topY = pts[0].y;
              const bottomX = pts[1].x;
              const bottomY = pts[1].y;
              const dx = bottomX - topX;
              ctx.moveTo(topX, topY);
              ctx.lineTo(topX - dx, bottomY);
              ctx.lineTo(topX + dx, bottomY);
              ctx.closePath();
            }
          } else {
            ctx.moveTo(pts[0].x || 0, pts[0].y || 0);
            for (let i = 1; i < pts.length; i++) {
              ctx.lineTo(pts[i].x || 0, pts[i].y || 0);
            }
          }
        }
        ctx.stroke();
      });
    } catch (err) {
      console.error("Canvas render error:", err);
    }
  };

  useEffect(() => {
    renderCanvas();
    window.addEventListener('resize', renderCanvas);
    return () => window.removeEventListener('resize', renderCanvas);
  }, [drawingPaths]);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: (e.clientX || 0) - rect.left,
      y: (e.clientY || 0) - rect.top
    };
  };

  const startDrawing = (e) => {
    if (!selectedTool) return;
    const coords = getCoordinates(e);
    if (!coords) return;
    
    isDrawing.current = true;
    currentPath.current = { tool: selectedTool, color: activeColor, mode: drawMode, points: [coords] };
  };

  const draw = (e) => {
    if (!isDrawing.current || !selectedTool) return;
    const coords = getCoordinates(e);
    if (!coords) return;
    
    if (['line', 'circle', 'rect', 'triangle'].includes(drawMode)) {
      if (currentPath.current.points.length === 1) {
        currentPath.current.points.push(coords);
      } else {
        currentPath.current.points[1] = coords;
      }
    } else {
      currentPath.current.points.push(coords);
    }
    renderCanvas();
  };

  const stopDrawing = (e) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    
    if (currentPath.current && currentPath.current.points.length > 0) {
      const finishedPath = currentPath.current;
      const newPaths = Array.isArray(drawingPaths) ? [...drawingPaths, finishedPath] : [finishedPath];
      
      setDrawingPaths(newPaths);
      setUndonePaths([]);
      onUpdateNote(note.id, title, content, chapter, note.page_marker_color, JSON.stringify(newPaths));
    }
    currentPath.current = null;
  };

  const handleUndo = () => {
    if (!Array.isArray(drawingPaths) || drawingPaths.length === 0) return;
    const paths = [...drawingPaths];
    const last = paths.pop();
    setDrawingPaths(paths);
    setUndonePaths(prev => Array.isArray(prev) ? [...prev, last] : [last]);
    onUpdateNote(note.id, title, content, chapter, note.page_marker_color, JSON.stringify(paths));
  };
  
  const handleRedo = () => {
    if (!Array.isArray(undonePaths) || undonePaths.length === 0) return;
    const paths = [...undonePaths];
    const first = paths.pop();
    setUndonePaths(paths);
    
    const newPaths = Array.isArray(drawingPaths) ? [...drawingPaths, first] : [first];
    setDrawingPaths(newPaths);
    onUpdateNote(note.id, title, content, chapter, note.page_marker_color, JSON.stringify(newPaths));
  };
  // --- END DRAWING LOGIC ---

  const getSelectionOffsets = (selection, editorElement) => {
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);

    const findLineElement = (node) => {
      let curr = node;
      while (curr && curr !== editorElement) {
        if (curr.nodeType === Node.ELEMENT_NODE && curr.hasAttribute('data-line-idx')) {
          return curr;
        }
        curr = curr.parentNode;
      }
      return null;
    };

    const startLineEl = findLineElement(range.startContainer);
    const endLineEl = findLineElement(range.endContainer);

    if (!startLineEl || !endLineEl) return null;

    const startLineIdx = parseInt(startLineEl.getAttribute('data-line-idx'), 10);
    const endLineIdx = parseInt(endLineEl.getAttribute('data-line-idx'), 10);

    const getLineOffset = (lineEl, container, offset) => {
      const preRange = document.createRange();
      preRange.selectNodeContents(lineEl);
      preRange.setEnd(container, offset);
      return preRange.toString().length;
    };

    const startOffsetInLine = getLineOffset(startLineEl, range.startContainer, range.startOffset);
    const endOffsetInLine = getLineOffset(endLineEl, range.endContainer, range.endOffset);

    const lines = content.split('\n');

    let startAbs = 0;
    for (let i = 0; i < startLineIdx; i++) {
      startAbs += lines[i].length + 1;
    }
    startAbs += startOffsetInLine;

    let endAbs = 0;
    for (let i = 0; i < endLineIdx; i++) {
      endAbs += lines[i].length + 1;
    }
    endAbs += endOffsetInLine;

    return {
      start_index: startAbs,
      end_index: endAbs,
      text: selection.toString()
    };
  };

  const handleMouseUp = () => {
    if (mode !== 'study') return

    const selection = window.getSelection()
    const text = selection.toString().trim()

    if (!text || text.length < 2) {
      setSelectionData(null)
      return
    }

    try {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()

      const offsets = getSelectionOffsets(selection, editorRef.current);
      if (!offsets) return;

      const newSelectionData = {
        text: offsets.text,
        start_index: offsets.start_index,
        end_index: offsets.end_index,
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY - 60
      }

      if (selectedTool) {
        onAddHighlight(
          note.id,
          newSelectionData.start_index,
          newSelectionData.end_index,
          note.page_marker_color || 'yellow',
          newSelectionData.text
        )
        window.getSelection()?.removeAllRanges()
        setSelectionData(null)
      } else {
        setSelectionData(newSelectionData)
      }
    } catch (err) {
      console.error('Error calculating selection range:', err)
    }
  }

  const clearSelection = () => {
    setSelectionData(null)
    window.getSelection()?.removeAllRanges()
  }

  const applyHighlight = async (color) => {
    if (!selectionData) return
    await onAddHighlight(
      note.id,
      selectionData.start_index,
      selectionData.end_index,
      color,
      selectionData.text
    )
    clearSelection()
  }

  const removeHighlightsInRange = async () => {
    if (!selectionData) return;

    // Find all highlights overlapping the selection
    const overlappingHls = (note.highlights || []).filter(
      h => !(h.start_index >= selectionData.end_index || h.end_index <= selectionData.start_index)
    );

    for (const hl of overlappingHls) {
      await onDeleteHighlight(note.id, hl.id);
    }

    clearSelection();
  }

  const handleTriggerSideNote = () => {
    // If text is selected, we can prompt for a side note
    setShowAddSideNoteInput(true)
  }

  const saveSideNote = async () => {
    if (!sideNoteText.trim()) return

    // First, auto-create highlight in yellow if not already highlighted
    let hlId = null
    if (selectionData) {
      const hl = await onAddHighlight(
        note.id,
        selectionData.start_index,
        selectionData.end_index,
        'yellow',
        selectionData.text
      )
      hlId = hl.id
    }

    // Save side note
    const roundedY = selectionData ? Math.round(selectionData.y - 150) : 100
    await onAddSideNote(note.id, hlId, sideNoteText, roundedY)

    setSideNoteText('')
    setShowAddSideNoteInput(false)
    clearSelection()
  }

  const triggerAIExplain = async () => {
    if (!selectionData) return
    setExplaining(true)
    setShowExplanationModal(true)
    setExplanation('')
    try {
      const result = await onExplainText(selectionData.text, note.content)
      setExplanation(result)
    } catch (err) {
      setExplanation('AI failed to analyze selected text. Please ensure Gemini API Key is set.')
    } finally {
      setExplaining(false)
    }
  }

  const handleHighlightClick = (hl) => {
    const linkedSideNote = note.sideNotes?.find(sn => sn.highlight_id === hl.id)
    if (linkedSideNote) {
      if (confirm(`Remove highlight: "${hl.text}" and its comment?`)) {
        onDeleteHighlight(note.id, hl.id)
      }
    } else {
      if (confirm(`Remove highlight: "${hl.text}"?`)) {
        onDeleteHighlight(note.id, hl.id)
      }
    }
  }

  // Format bold (**bold**) and italic (*italic*) while preserving length
  const formatInlineStyles = (text, keyPrefix) => {
    if (!text) return [];

    const regex = /(\*\*.*?\*\*|\*.*?\*)/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
      const key = `${keyPrefix}-${index}`;
      if (part.startsWith('**') && part.endsWith('**')) {
        const innerText = part.slice(2, -2);
        return (
          <strong key={key} style={{ fontWeight: 'bold' }}>
            <span style={{ display: 'none' }}>**</span>
            {innerText}
            <span style={{ display: 'none' }}>**</span>
          </strong>
        );
      } else if (part.startsWith('*') && part.endsWith('*')) {
        const innerText = part.slice(1, -1);
        return (
          <em key={key} style={{ fontStyle: 'italic' }}>
            <span style={{ display: 'none' }}>*</span>
            {innerText}
            <span style={{ display: 'none' }}>*</span>
          </em>
        );
      }
      return part;
    });
  };

  // Helper to format line segments and hide markdown line elements (headings/bullets) while preserving offsets
  const formatLineTextSegment = (segment, keyPrefix, isFirst, isHeading, isBullet) => {
    if (!segment) return [];

    if (isFirst) {
      if (isHeading) {
        const headingMatch = segment.match(/^(\s*#{1,6}\s+)/);
        if (headingMatch) {
          const hashes = headingMatch[1];
          const rest = segment.substring(hashes.length);
          return [
            <span key="hashes" style={{ display: 'none' }}>{hashes}</span>,
            ...formatInlineStyles(rest, keyPrefix)
          ];
        }
      } else if (isBullet) {
        const bulletMatch = segment.match(/^(\s*[-*]\s+)/);
        if (bulletMatch) {
          const marker = bulletMatch[1];
          const rest = segment.substring(marker.length);
          return [
            <span key="bullet-marker" style={{ display: 'none' }}>{marker}</span>,
            ...formatInlineStyles(rest, keyPrefix)
          ];
        }
      }
    }

    return formatInlineStyles(segment, keyPrefix);
  };

  // Convert markdown inside AI explanation modal cleanly
  const renderExplanationMarkdown = (text) => {
    if (!text) return '';
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let style = { marginBottom: '8px' };
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        return (
          <h4 key={idx} style={{ marginTop: '16px', marginBottom: '8px', fontSize: level === 1 ? '1.4rem' : '1.15rem' }}>
            {line.replace(/^#{1,6}\s+/, '')}
          </h4>
        );
      }
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return (
          <li key={idx} style={{ marginLeft: '20px', marginBottom: '4px' }}>
            {line.replace(/^[-*]\s+/, '')}
          </li>
        );
      }
      // Handle inline bold/italic
      const regex = /(\*\*.*?\*\*|\*.*?\*)/g;
      const parts = line.split(regex);
      const lineContent = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={pIdx}>{part.slice(1, -1)}</em>;
        }
        return part;
      });
      return <p key={idx} style={style}>{lineContent}</p>;
    });
  };

  // Renders note content in study mode with active highlighted spans & markdown block formatting
  const renderHighlightedContent = () => {
    if (!content) return ''

    const lines = content.split('\n');
    let currentOffset = 0;
    const lineElements = [];

    lines.forEach((lineText, lineIdx) => {
      const lineStart = currentOffset;
      const lineEnd = lineStart + lineText.length;

      let blockStyle = { minHeight: '28px', marginBottom: '4px' };
      let isHeading = false;
      let isBullet = false;
      let headingLevel = 0;

      const headingMatch = lineText.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        isHeading = true;
        headingLevel = headingMatch[1].length;
        blockStyle = {
          fontFamily: 'var(--font-title)',
          fontSize: headingLevel === 1 ? '1.8rem' : headingLevel === 2 ? '1.4rem' : '1.15rem',
          fontWeight: '800',
          marginTop: '16px',
          marginBottom: '8px',
          color: 'var(--text-dark)',
          lineHeight: '1.3'
        };
      } else if (lineText.trim().startsWith('- ') || lineText.trim().startsWith('* ')) {
        isBullet = true;
        const leadingSpacesMatch = lineText.match(/^(\s*)/);
        const leadingSpacesCount = leadingSpacesMatch ? leadingSpacesMatch[0].length : 0;
        blockStyle = {
          paddingLeft: `${20 + leadingSpacesCount * 12}px`,
          position: 'relative',
          marginBottom: '6px'
        };
      }

      // Find highlights inside this line
      const lineHighlights = (note.highlights || [])
        .filter(hl => hl.start_index < lineEnd && hl.end_index > lineStart)
        .map(hl => ({
          ...hl,
          localStart: Math.max(0, hl.start_index - lineStart),
          localEnd: Math.min(lineText.length, hl.end_index - lineStart)
        }))
        .sort((a, b) => a.localStart - b.localStart);

      const lineChildren = [];
      let lastLocalIndex = 0;

      lineHighlights.forEach((hl) => {
        if (hl.localStart > lastLocalIndex) {
          const segment = lineText.substring(lastLocalIndex, hl.localStart);
          lineChildren.push(...formatLineTextSegment(segment, `${lineIdx}-${lastLocalIndex}`, lastLocalIndex === 0, isHeading, isBullet));
        }

        const hlSegment = lineText.substring(hl.localStart, hl.localEnd);
        const linkedSideNote = note.sideNotes?.find(sn => sn.highlight_id === hl.id);

        const markClassName = linkedSideNote ? 'comment-underline' : `hl-${hl.color}-text`;
        const markStyle = linkedSideNote
          ? { cursor: 'pointer' }
          : { cursor: 'pointer', borderRadius: '2px', padding: '0 2px' };

        const markContent = (
          <mark
            key={hl.id}
            className={markClassName}
            style={markStyle}
            onClick={() => handleHighlightClick(hl)}
            title={linkedSideNote ? '' : "Click to manage highlight"}
          >
            {formatLineTextSegment(hlSegment, hl.id, hl.localStart === 0, isHeading, isBullet)}
          </mark>
        );

        if (linkedSideNote) {
          lineChildren.push(
            <span key={`${hl.id}-container`} className="highlight-container">
              {markContent}
              <div className="highlight-tooltip">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ flex: 1, wordBreak: 'break-word' }}>{linkedSideNote.content}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteHighlight(note.id, hl.id); }}
                    style={{ background: '#ff1744', color: '#fff', border: '2px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                    title="Delete Comment"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </span>
          );
        } else {
          lineChildren.push(markContent);
        }

        lastLocalIndex = hl.localEnd;
      });

      if (lastLocalIndex < lineText.length) {
        const segment = lineText.substring(lastLocalIndex);
        lineChildren.push(...formatLineTextSegment(segment, `${lineIdx}-${lastLocalIndex}`, lastLocalIndex === 0, isHeading, isBullet));
      }

      if (isBullet) {
        const leadingSpacesMatch = lineText.match(/^(\s*)/);
        const leadingSpacesCount = leadingSpacesMatch ? leadingSpacesMatch[0].length : 0;
        lineElements.push(
          <div key={lineIdx} data-line-idx={lineIdx} style={blockStyle}>
            <span style={{ position: 'absolute', left: `${4 + leadingSpacesCount * 12}px`, top: '10px', width: '5px', height: '5px', borderRadius: '50%', background: 'currentColor', opacity: 0.6 }} />
            {lineChildren}
          </div>
        );
      } else if (isHeading) {
        lineElements.push(
          <div key={lineIdx} data-line-idx={lineIdx} style={blockStyle}>
            {lineChildren}
          </div>
        );
      } else {
        lineElements.push(
          <p key={lineIdx} data-line-idx={lineIdx} style={blockStyle}>
            {lineChildren}
          </p>
        );
      }

      currentOffset = lineEnd + 1;
    });

    return lineElements;
  }

  return (
    <div className="editor-layout">
      {/* Paper Notebook Sheet */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Control Bar Box above the page */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          background: '#faf9f5',
          border: '1px solid #e8e6e1',
          padding: '16px 24px',
          borderRadius: '8px',
          marginBottom: '24px',
          width: '100%',
          boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-start' }}>
            {/* Top Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <button
                className={`mode-btn-3d shake-hover ${mode === 'study' ? 'active' : ''}`}
                onClick={() => setMode('study')}
              >
                <BookOpen size={14} /> Study Mode
              </button>
              <button
                className={`mode-btn-3d shake-hover ${mode === 'draft' ? 'active' : ''}`}
                onClick={() => setMode('draft')}
              >
                <Edit2 size={14} /> Drafting Mode
              </button>
              <FocusTimer />
            </div>

            {/* Bottom Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <button
                className={`mode-btn-3d shake-hover ${mode === 'quiz' ? 'active' : ''}`}
                onClick={() => setMode('quiz')}
              >
                <HelpCircle size={14} /> Quiz Mode
              </button>

              {/* Page Marker Color Selector */}
              <div className="page-tab-3d">
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#121212', textTransform: 'uppercase' }}>🔖 PAGE TAB:</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['#f4d03f', '#ff6b81', '#2ed573', '#7bed9f', '#ff9f43'].map((c, idx) => {
                    const colors = ['yellow', 'pink', 'green', 'blue', 'orange'];
                    const colorName = colors[idx];
                    return (
                      <button
                        key={colorName}
                        type="button"
                        className={`tab-${colorName}`}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          border: note.page_marker_color === colorName ? '2px solid #121212' : '1px solid rgba(0,0,0,0.1)',
                          cursor: 'pointer',
                          transform: note.page_marker_color === colorName ? 'scale(1.1)' : 'none',
                          transition: 'all 0.2s',
                          padding: 0
                        }}
                        onClick={() => onUpdateNote(note.id, title, content, chapter, colorName)}
                        title={`Mark page ${colorName}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Japanese Stationery Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div className="stationery-toolbar" style={{ position: 'relative' }}>
              
              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="stationery-action-btn" title="Undo" onClick={handleUndo} disabled={drawingPaths.length === 0}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" /></svg></button>
                <button className="stationery-action-btn" title="Redo" onClick={handleRedo} disabled={undonePaths.length === 0}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" /></svg></button>
              </div>

              {/* Pens Wrapper (for proper clipping) */}
              <div className="stationery-pens-wrapper">
                <div className="stationery-pens">
                  {/* Muji Gel Pen */}
                  <div className={`stationery-pen ${selectedTool === 'gel' ? 'active' : ''}`} onClick={() => setSelectedTool(selectedTool === 'gel' ? null : 'gel')}>
                    <div className="pen-tooltip">Gel Pen</div>
                    <div className="pen-tip gel"><div className="pen-ink-tip"></div></div>
                    <div className="pen-body gel"></div>
                  </div>
                  {/* Wooden Pencil */}
                  <div className={`stationery-pen ${selectedTool === 'wood' ? 'active' : ''}`} onClick={() => setSelectedTool(selectedTool === 'wood' ? null : 'wood')}>
                    <div className="pen-tooltip">Pencil</div>
                    <div className="pen-tip wood"><div className="pen-ink-tip"></div></div>
                    <div className="pen-body wood"></div>
                  </div>
                  {/* Copic Marker */}
                  <div className={`stationery-pen ${selectedTool === 'copic' ? 'active' : ''}`} onClick={() => setSelectedTool(selectedTool === 'copic' ? null : 'copic')}>
                    <div className="pen-tooltip">Marker</div>
                    <div className="pen-tip copic"><div className="pen-ink-tip"></div></div>
                    <div className="pen-body copic"></div>
                  </div>
                  {/* Tombow Brush Pen */}
                  <div className={`stationery-pen ${selectedTool === 'brush' ? 'active' : ''}`} onClick={() => setSelectedTool(selectedTool === 'brush' ? null : 'brush')}>
                    <div className="pen-tooltip">Brush</div>
                    <div className="pen-tip brush"></div>
                    <div className="pen-body brush"></div>
                  </div>
                  {/* Mono Eraser */}
                  <div className={`stationery-pen ${selectedTool === 'mono' ? 'active' : ''}`} onClick={() => setSelectedTool(selectedTool === 'mono' ? null : 'mono')}>
                    <div className="pen-tooltip">Eraser</div>
                    <div className="pen-tip mono"></div>
                    <div className="pen-body mono"></div>
                  </div>
                </div>
              </div>

              {/* Colors */}
              <div className="stationery-colors">
                <div className={`stationery-color ${activeColor === '#121212' ? 'active' : ''}`} style={{background: '#121212'}} onClick={() => setActiveColor('#121212')}></div>
                <div className={`stationery-color ${activeColor === '#3b82f6' ? 'active' : ''}`} style={{background: '#3b82f6'}} onClick={() => setActiveColor('#3b82f6')}></div>
                <div className={`stationery-color ${activeColor === '#22c55e' ? 'active' : ''}`} style={{background: '#22c55e'}} onClick={() => setActiveColor('#22c55e')}></div>
                <div className={`stationery-color ${activeColor === '#facc15' ? 'active' : ''}`} style={{background: '#facc15'}} onClick={() => setActiveColor('#facc15')}></div>
                <div className={`stationery-color ${activeColor === '#ef4444' ? 'active' : ''}`} style={{background: '#ef4444'}} onClick={() => setActiveColor('#ef4444')}></div>
              </div>

              {/* Shape Selector Dialog */}
              {selectedTool && selectedTool !== 'mono' && (
                <div className="shape-selector-dialog">
                  <button className={`shape-btn ${drawMode === 'custom' ? 'active' : ''}`} onClick={() => setDrawMode('custom')} title="Freehand">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12c-2 0-2-4-6-4-3 0-3 8-6 8-4 0-4-4-6-4"/></svg>
                  </button>
                  <button className={`shape-btn ${drawMode === 'line' ? 'active' : ''}`} onClick={() => setDrawMode('line')} title="Straight Line">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="20" x2="20" y2="4"/></svg>
                  </button>
                  <button className={`shape-btn ${drawMode === 'circle' ? 'active' : ''}`} onClick={() => setDrawMode('circle')} title="Circle">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/></svg>
                  </button>
                  <button className={`shape-btn ${drawMode === 'rect' ? 'active' : ''}`} onClick={() => setDrawMode('rect')} title="Rectangle">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/></svg>
                  </button>
                  <button className={`shape-btn ${drawMode === 'triangle' ? 'active' : ''}`} onClick={() => setDrawMode('triangle')} title="Triangle">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4L4 20h16L12 4z"/></svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {mode === 'draft' ? (
          <div className="card" style={{ padding: '32px', background: '#fff', position: 'relative' }}>
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: selectedTool ? 'auto' : 'none',
                zIndex: 10,
                borderRadius: '12px'
              }}
            />
            <input
              type="text"
              className="input-field"
              style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '10px', boxShadow: 'none' }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note Title"
            />
            <input
              type="text"
              className="input-field"
              style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '20px', color: 'var(--text-muted)', boxShadow: 'none', borderBottom: '1px dashed var(--border-color)' }}
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="Chapter / Topic Name (e.g. Biology, React Router)"
            />
            <textarea
              className="input-field"
              style={{ minHeight: '450px', fontSize: '1.05rem', lineHeight: '1.6', fontFamily: 'var(--font-sans)', boxShadow: 'none', resize: 'vertical' }}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your study notes here..."
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-success" onClick={handleSave}>
                Save and Lock Page
              </button>
            </div>
          </div>
        ) : mode === 'quiz' ? (
          <div className="paper-sheet" style={{ background: '#ffffff', minHeight: '700px', display: 'flex', flexDirection: 'column' }}>
            <h1 className="note-title-input">🧠 AI Study Challenger: {title}</h1>

            {loadingQuiz ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
                <div className="loader-book" style={{ margin: '0 auto 16px auto' }}>
                  <div className="loader-page"></div>
                </div>
                <p style={{ fontFamily: 'var(--font-handwritten)', fontSize: '1.25rem' }}>Gemini is drafting an active recall quiz...</p>
              </div>
            ) : !quiz || !quiz.questions || quiz.questions.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', textAlign: 'center', padding: '24px' }}>
                <HelpCircle size={64} style={{ color: 'var(--color-primary)', marginBottom: '16px', opacity: 0.8 }} />
                <h2>Ready to test your knowledge?</h2>
                <p style={{ color: 'var(--text-muted)', maxWidth: '400px', marginBottom: '24px' }}>
                  Generate an active recall multiple-choice quiz using Gemini based on your notes above.
                </p>
                <button className="btn btn-primary shake-hover" onClick={generateNoteQuiz}>
                  <Sparkles size={16} /> Generate Quiz with AI
                </button>
              </div>
            ) : quizFinished ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px' }}>
                <div className="card" style={{ background: '#f5f2eb', textAlign: 'center', padding: '32px', position: 'relative', overflow: 'hidden' }}>
                  <Award size={48} style={{ color: 'var(--color-warning)', margin: '0 auto 12px auto' }} />
                  <h2>Quiz Finished!</h2>
                  <div style={{ fontSize: '2.5rem', fontWeight: 800, margin: '16px 0', color: 'var(--color-primary)' }}>
                    {score} / {quiz.questions.length}
                  </div>

                  {/* Grade Stamp */}
                  <div style={{
                    position: 'absolute',
                    top: '20px',
                    right: '30px',
                    border: '4px double var(--color-danger)',
                    borderRadius: '8px',
                    color: 'var(--color-danger)',
                    padding: '8px 16px',
                    fontSize: '1.4rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    transform: 'rotate(12deg)',
                    fontFamily: 'var(--font-title)',
                    opacity: 0.85
                  }}>
                    {score === quiz.questions.length ? 'A+ Perfect' : score >= quiz.questions.length * 0.75 ? 'A Great Job' : score >= quiz.questions.length * 0.5 ? 'Passed' : 'Try Again'}
                  </div>

                  <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                    Review your answers below to reinforce your memory.
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '20px' }}>
                    <button className="btn btn-primary" onClick={() => {
                      setQuizFinished(false);
                      setCurrentQuestionIdx(0);
                      setSelectedOptionIdx(null);
                      setSubmitted(false);
                      setScore(0);
                    }}>
                      <RefreshCw size={14} /> Retake Quiz
                    </button>
                    <button className="btn btn-success" onClick={generateNoteQuiz}>
                      <Sparkles size={14} /> New Quiz Questions
                    </button>
                  </div>
                </div>

                {/* Question Review List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                  {quiz.questions.map((q, qIdx) => (
                    <div key={qIdx} className="card" style={{ padding: '20px', borderLeft: `6px solid var(--color-primary)` }}>
                      <h4 style={{ marginBottom: '10px' }}>Q{qIdx + 1}: {q.question}</h4>
                      <p style={{ fontSize: '0.9rem', marginBottom: '8px' }}>
                        <strong>Correct Answer:</strong> <span style={{ color: 'green', fontWeight: 'bold' }}>{q.options[q.answerIndex]}</span>
                      </p>
                      <div className="sidenote-bubble" style={{ margin: '8px 0 0 0', transform: 'none', background: '#e9e4d9', fontSize: '0.9rem' }}>
                        <strong>Explanation:</strong> {q.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Progress bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    Question {currentQuestionIdx + 1} of {quiz.questions.length}
                  </span>
                  <div style={{ width: '150px', height: '10px', background: '#ccc', borderRadius: '5px', overflow: 'hidden', border: '2px solid var(--border-color)' }}>
                    <div style={{ width: `${((currentQuestionIdx + 1) / quiz.questions.length) * 100}%`, height: '100%', background: 'var(--color-primary)' }} />
                  </div>
                </div>

                {/* Question Card */}
                <div className="card" style={{ padding: '24px', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '1.25rem', lineHeight: '1.4' }}>
                    {quiz.questions[currentQuestionIdx].question}
                  </h3>

                  {/* Options List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                    {quiz.questions[currentQuestionIdx].options.map((option, idx) => {
                      const isSelected = selectedOptionIdx === idx;
                      const isCorrect = idx === quiz.questions[currentQuestionIdx].answerIndex;

                      let optionStyle = {
                        width: '100%',
                        padding: '14px 20px',
                        borderRadius: '8px',
                        border: '3px solid var(--border-color)',
                        textAlign: 'left',
                        fontSize: '1rem',
                        fontWeight: 700,
                        cursor: submitted ? 'default' : 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: 'var(--shadow-flat)',
                        background: '#ffffff'
                      };

                      if (submitted) {
                        if (isCorrect) {
                          optionStyle.background = '#d4edda';
                          optionStyle.borderColor = 'green';
                          optionStyle.color = 'green';
                        } else if (isSelected) {
                          optionStyle.background = '#f8d7da';
                          optionStyle.borderColor = 'red';
                          optionStyle.color = 'red';
                        } else {
                          optionStyle.opacity = 0.6;
                        }
                      } else if (isSelected) {
                        optionStyle.background = 'var(--color-warning)';
                        optionStyle.transform = 'translate(1px, 1px)';
                        optionStyle.boxShadow = '1px 1px 0px var(--border-color)';
                      }

                      return (
                        <button
                          key={idx}
                          style={optionStyle}
                          onClick={() => {
                            if (!submitted) setSelectedOptionIdx(idx);
                          }}
                          disabled={submitted}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              border: '2px solid currentColor',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.8rem',
                              fontWeight: 900
                            }}>
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span style={{ flex: 1 }}>{option}</span>
                            {submitted && isCorrect && <CheckCircle size={18} style={{ color: 'green' }} />}
                            {submitted && isSelected && !isCorrect && <XCircle size={18} style={{ color: 'red' }} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Feedback Explanation */}
                  {submitted && (
                    <div className="sidenote-bubble" style={{ transform: 'none', background: '#ffe57f', marginTop: '16px' }}>
                      <div style={{ fontWeight: 800, marginBottom: '6px', fontSize: '0.9rem' }}>
                        {selectedOptionIdx === quiz.questions[currentQuestionIdx].answerIndex ? '🎉 Correct!' : '❌ Incorrect'}
                      </div>
                      <p style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
                        {quiz.questions[currentQuestionIdx].explanation}
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    {!submitted ? (
                      <button
                        className="btn btn-primary"
                        disabled={selectedOptionIdx === null}
                        onClick={() => {
                          setSubmitted(true);
                          if (selectedOptionIdx === quiz.questions[currentQuestionIdx].answerIndex) {
                            setScore(prev => prev + 1);
                          }
                        }}
                      >
                        Submit Answer
                      </button>
                    ) : (
                      <button
                        className="btn btn-success"
                        onClick={() => {
                          if (currentQuestionIdx < quiz.questions.length - 1) {
                            setCurrentQuestionIdx(prev => prev + 1);
                            setSelectedOptionIdx(null);
                            setSubmitted(false);
                          } else {
                            setQuizFinished(true);
                          }
                        }}
                      >
                        {currentQuestionIdx < quiz.questions.length - 1 ? 'Next Question' : 'View Results'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            key={note.id}
            className="paper-sheet page-flip-anim"
            ref={editorRef}
            onMouseUp={handleMouseUp}
            style={{ position: 'relative' }}
          >
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: selectedTool ? 'auto' : 'none',
                zIndex: 10,
                borderRadius: 'inherit'
              }}
            />
            {/* Physical tabs sticking out of the right edge of the paper sheet */}
            {pages && (
              <div className="pagemarkers-tabs-container">
                <button
                  type="button"
                  className="pagemarker-tab tab-cover"
                  onClick={onShowCover}
                  title="Notebook Cover"
                >
                  Cover
                </button>
                {pages.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`pagemarker-tab tab-${p.page_marker_color || 'yellow'} ${note.id === p.id ? 'active' : ''}`}
                    onClick={() => onSelectPage(p.id)}
                    title={`Page ${i + 1}: ${p.title}`}
                  >
                    P{i + 1}
                  </button>
                ))}
              </div>
            )}

            <div className="date-stamp">
              {new Date(note.created_at || Date.now()).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
            <h1 className="note-title-input">{title || 'Untitled Note'}</h1>
            <div style={{ fontSize: '1.05rem', whiteSpace: 'pre-wrap', color: 'var(--text-dark)' }}>
              {renderHighlightedContent()}
            </div>
          </div>
        )}
      </div>



      {/* Selection Floating Toolbar */}
      {selectionData && (
        <div
          className="highlight-toolbar"
          style={{
            left: `${selectionData.x}px`,
            top: `${selectionData.y}px`
          }}
        >
          {/* Highlight Color Choices */}
          <button
            className="hl-btn"
            style={{ backgroundColor: 'var(--sticky-yellow)' }}
            onClick={() => applyHighlight('yellow')}
            title="Highlight Yellow"
          />
          <button
            className="hl-btn"
            style={{ backgroundColor: 'var(--sticky-green)' }}
            onClick={() => applyHighlight('green')}
            title="Highlight Green"
          />
          <button
            className="hl-btn"
            style={{ backgroundColor: 'var(--sticky-pink)' }}
            onClick={() => applyHighlight('pink')}
            title="Highlight Pink"
          />
          <button
            className="hl-btn"
            style={{ backgroundColor: 'var(--sticky-blue)' }}
            onClick={() => applyHighlight('blue')}
            title="Highlight Blue"
          />
          <button
            className="hl-btn"
            style={{ backgroundColor: 'var(--sticky-orange)' }}
            onClick={() => applyHighlight('orange')}
            title="Highlight Orange"
          />

          <button
            className="hl-btn"
            style={{ backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={removeHighlightsInRange}
            title="Remove Highlight"
          >
            <Trash2 size={13} color="var(--text-muted)" />
          </button>

          <div style={{ width: '1px', background: '#ccc', margin: '0 4px' }} />

          {/* AI Explain */}
          <button
            className="btn btn-icon shake-hover"
            style={{ width: '28px', height: '28px', border: '2px solid var(--border-color)', borderRadius: '4px', background: '#ffffff' }}
            onClick={triggerAIExplain}
            title="Explain selection with AI"
          >
            <Sparkles size={13} style={{ color: 'var(--color-primary)' }} />
          </button>

          {/* Side Comment */}
          <button
            className="btn btn-icon shake-hover"
            style={{ width: '28px', height: '28px', border: '2px solid var(--border-color)', borderRadius: '4px', background: '#ffffff' }}
            onClick={handleTriggerSideNote}
            title="Add comment in margins"
          >
            <MessageSquare size={13} />
          </button>

          <button
            className="btn btn-icon"
            style={{ width: '28px', height: '28px', border: '2px solid var(--border-color)', borderRadius: '4px', background: '#f5f5f5' }}
            onClick={clearSelection}
            title="Cancel"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Write Margin Note Panel overlay */}
      {showAddSideNoteInput && (
        <div className="ai-modal-overlay">
          <div className="ai-modal-card">
            <div className="ai-modal-header">
              <h3>📝 Add Comment in Margin</h3>
              <button className="sticky-btn-delete" onClick={() => setShowAddSideNoteInput(false)}>
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontStyle: 'italic', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Annotating selection: "{selectionData?.text}"
              </p>
              <textarea
                className="input-field"
                placeholder="Write your marginal notes here..."
                style={{ height: '120px', fontFamily: 'var(--font-handwritten)', fontSize: '1.1rem' }}
                value={sideNoteText}
                onChange={(e) => setSideNoteText(e.target.value)}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button className="btn" onClick={() => setShowAddSideNoteInput(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={saveSideNote}>Add Note</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Explanation Modal */}
      {showExplanationModal && (
        <div className="ai-modal-overlay">
          <div className="ai-modal-card">
            <div className="ai-modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} style={{ color: 'var(--color-primary)' }} /> AI Concept Analyzer
              </h3>
              <button className="sticky-btn-delete" onClick={() => setShowExplanationModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="ai-modal-body">
              {explaining ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div className="loader-book" style={{ margin: '0 auto 10px auto', scale: '0.8' }}>
                    <div className="loader-page"></div>
                  </div>
                  <p style={{ fontFamily: 'var(--font-handwritten)' }}>AI is examining terms...</p>
                </div>
              ) : (
                <div>{renderExplanationMarkdown(explanation)}</div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-primary" onClick={() => setShowExplanationModal(false)}>
                Close Analysis
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
