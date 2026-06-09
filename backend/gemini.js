const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');
require('dotenv').config();

// Initialize the Gemini API client
const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
let genAI = null;

if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
} else {
  console.warn('WARNING: GEMINI_API_KEY is not defined in the environment. AI features will fallback to dummy responses.');
}

// Helper to get active model
const getModel = (options = {}) => {
  if (!genAI) return null;
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: 'you are a helpful assistant',
    ...options,
  });
};

const safeJsonParse = (text) => {
  if (!text) return null;

  let cleaned = text.trim();

  // Remove markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (initialError) {
    // If it fails, try to aggressively clean up control characters
    let heavilyCleaned = cleaned.replace(/"([^"\\]|\\.)*"/g, (match) => {
      return match
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    });

    // Remove trailing commas
    heavilyCleaned = heavilyCleaned.replace(/,\s*([\]}])/g, '$1');

    try {
      return JSON.parse(heavilyCleaned);
    } catch (error) {
      console.error('Failed to parse JSON response. Original text:', cleaned);
      throw error;
    }
  }
};

/**
 * Converts a parsed JSON object/array to a clean markdown string
 */
const convertJsonToMarkdown = (parsed) => {
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
  return String(parsed);
};

/**
 * Checks if a string looks like JSON, and if so, parses it and converts it to clean markdown.
 */
const tryConvertJsonToMarkdown = (text) => {
  if (!text) return '';
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  cleaned = cleaned.trim();

  if ((cleaned.startsWith('{') && cleaned.endsWith('}')) || (cleaned.startsWith('[') && cleaned.endsWith(']'))) {
    try {
      const parsed = JSON.parse(cleaned);
      return convertJsonToMarkdown(parsed);
    } catch (e) {
      // Not valid JSON, keep as is
    }
  }
  return text;
};

/**
 * Generate a complete note (title + content) from a user prompt
 */
const generateNoteFromPrompt = async (prompt) => {
  const model = getModel({
    systemInstruction: "You are a helpful study assistant. Create a detailed, comprehensive note based on the user's prompt. Format the output as a JSON object with keys \"title\" and \"content\". The \"content\" field should be a single, flat string formatted nicely using markdown (bullet points, clear sections, etc.) and MUST NOT contain any raw JSON structures or objects. Ensure all string values in the JSON are properly escaped.",
    generationConfig: { 
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          content: { type: SchemaType.STRING }
        },
        required: ["title", "content"]
      }
    }
  });

  if (!model) {
    return {
      title: `Note about "${prompt.substring(0, 30)}..."`,
      content: `[AI Fallback Mode] Here is a basic note outline about "${prompt}".\n\n1. Overview: This is a placeholder note.\n2. Key details: Please add your GEMINI_API_KEY in the backend .env file to enable realistic AI-generated notes with beautiful formatting.`
    };
  }

  const systemPrompt = `You are a helpful study assistant. Create a detailed, comprehensive note based on the user's prompt. 
  Format the output as a JSON object with keys "title" and "content". 
  
  CRITICAL: The "content" value itself MUST be a pure, natural markdown string representing the note (using headings like ###, ####, bullet points with - or *, bold text with **, and italic text with *). Do NOT output JSON format or JSON structures inside the "content" string. Write it as standard, readable study notes.
  
  Ensure that the output is valid JSON, and that any line breaks, tabs, or quotes inside the JSON string values (like "content") are properly escaped (e.g., use \\n for newlines, \\t for tabs, and escape double quotes as \").`;

  try {
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: `Create a note for: ${prompt}` }
    ]);
    const responseText = result.response.text();
    const parsed = safeJsonParse(responseText);

    if (parsed && parsed.content) {
      if (typeof parsed.content === 'object') {
        parsed.content = convertJsonToMarkdown(parsed.content);
      } else {
        parsed.content = tryConvertJsonToMarkdown(parsed.content);
      }
    }
    return parsed;
  } catch (error) {
    console.error('Error generating note with Gemini:', error);
    throw error;
  }
};

/**
 * Summarize, or generate mnemonics or short notes for a stickies panel
 */
const generateMnemonicsOrShortNotes = async (text, type = 'mnemonic') => {
  const model = getModel({
    generationConfig: { 
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          items: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                content: { type: SchemaType.STRING },
                color: { type: SchemaType.STRING }
              },
              required: ["content", "color"]
            }
          }
        },
        required: ["items"]
      }
    }
  });

  if (!model) {
    return {
      items: [
        {
          content: `[AI Fallback] Remember details about: ${text.substring(0, 40)}...`,
          color: '#fef08a' // yellow
        }
      ]
    };
  }

  const systemPrompt = `You are a learning and study specialist. Take the provided text and generate a list of ${type === 'mnemonic'
    ? 'creative, memorable mnemonics (like acronyms or catchy associations) to help remember the key concepts'
    : type === 'summary'
      ? 'short, punchy summary bullet points (one sentence each)'
      : 'bite-sized short notes/quick cards'
    }. 
  Return the output as a JSON object with an array "items". Each item in the array must be an object with:
  - "content": the text of the mnemonic or short note (make it feel punchy, ready to go on a Post-it sticky note, maximum 150 characters)
  - "color": a suitable hex color code for a sticky note (choose warm bold post-it colors like Yellow: #FFE57F, Pink: #FF8A80, Green: #CCFF90, Blue: #82B1FF, Orange: #FFD180).
  Ensure that the output is valid JSON, and that any line breaks, tabs, or quotes inside the content strings are properly escaped.`;

  try {
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: `Text to analyze:\n${text}` }
    ]);
    const responseText = result.response.text();
    return safeJsonParse(responseText);
  } catch (error) {
    console.error('Error generating mnemonics:', error);
    throw error;
  }
};

/**
 * Explain or analyze selected text in the note context
 */
const explainOrAnalyzeText = async (selectedText, contextText) => {
  const model = getModel({
    systemInstruction: "You are a helpful study guide. Explain the selected text within the context of the surrounding notes. Output your response as plain, natural human-readable paragraphs, lists, and headings in markdown. Do NOT output JSON format, JSON structures, or code blocks like ```json. Make the explanation normal readable text."
  });

  if (!model) {
    return `[AI Fallback Mode] Here is an analysis of "${selectedText}":
    To enable real AI analyses, insert your GEMINI_API_KEY into the backend .env.
    In the context of the note, "${selectedText}" is a highlighted concept that represents a key learning topic.`;
  }

  const prompt = `You are a learning guide. The user is reading a note and selected a specific text fragment. 
  Provide a brief, clear, and engaging explanation of the selected text, using the surrounding note context to make the explanation relevant.
  Keep it under 3 paragraphs, using bullet points for clarity if needed.

  CRITICAL: Output ONLY standard markdown paragraphs and lists. Do NOT format your response as a JSON string, JSON object, or wrap it in JSON code fences.

  Surrounding Note Context:
  """
  ${contextText}
  """

  Selected Text to explain:
  "${selectedText}"`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    return tryConvertJsonToMarkdown(responseText);
  } catch (error) {
    console.error('Error explaining text:', error);
    throw error;
  }
};

/**
 * Generate a comic panel script based on note contents
 */
const generateComicStrip = async (noteTitle, noteContent) => {
  const model = getModel({
    generationConfig: { 
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          panels: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                panelNumber: { type: SchemaType.INTEGER },
                narration: { type: SchemaType.STRING },
                visualDescription: { type: SchemaType.STRING },
                dialogue: { type: SchemaType.STRING },
                characterEmoji: { type: SchemaType.STRING }
              },
              required: ["panelNumber", "narration", "visualDescription", "dialogue", "characterEmoji"]
            }
          }
        },
        required: ["panels"]
      }
    }
  });

  if (!model) {
    return {
      panels: [
        {
          panelNumber: 1,
          narration: "Shouta-kun sits at his desk, staring intensely at the textbook. Determination burns in his eyes!",
          visualDescription: "Close-up of Shouta-kun. Sweat drops on his forehead, speed lines shooting out from behind him in a classic Shonen manga style.",
          dialogue: "Yosh! Let's master " + noteTitle + "! *GULP!*",
          characterEmoji: "🧑‍🎓"
        },
        {
          panelNumber: 2,
          narration: "Sensei appears in a burst of chalk dust, pointing dramatically to the blackboard!",
          visualDescription: "Sensei wearing a lab coat and glasses, pointing a finger upward. Flashy screen burst effect behind him.",
          dialogue: "Listen closely! The key to this concept lies in how the pieces connect! *BAM!*",
          characterEmoji: "👨‍🏫"
        },
        {
          panelNumber: 3,
          narration: "A sudden wave of realization washes over Shouta-kun! The dark clouds of confusion part.",
          visualDescription: "Wide shot of Shouta-kun standing on a mountain peak, looking at a beautiful sunrise of pure knowledge. Wind blowing his hair.",
          dialogue: "Sugoi! Now I finally understand everything! *SHWING!*",
          characterEmoji: "⚡"
        }
      ]
    };
  }

  const systemPrompt = `You are a creative Japanese Manga artist (Mangaka) and educator. Convert the provided educational note into a story-based Japanese Manga comic strip storyboard (3 to 5 panels). 
  Create an engaging storyline or narrative with characters inspired by anime and manga (e.g., a passionate Shonen student, a wise Sensei, an inquisitive chibi mascot, or a futuristic android helper) who explain the concept in a highly dramatic and fun way.
  
  Return the output as a JSON object with a "panels" array. Each panel object must contain:
  - "panelNumber": integer index starting from 1.
  - "narration": A brief narration setting the scene or offering reflection (Manga-style narrative block).
  - "visualDescription": Detailed storyboard prompt describing the Manga illustration. Specify black-and-white comic elements, character expressions (e.g. sweat drops, sparkling determination eyes, shock lines), dramatic camera angles, and classic manga backgrounds (e.g. action speed lines, screentones, emotional burst lines).
  - "dialogue": Speech bubble or inner thoughts dialogue, with classic Manga-style onomatopoeias (like *GASP!*, *WHOOSH!*, *DOKI-DOKI!*, or *SHWING!*).
  - "characterEmoji": An anime-style emoji representing the speaking character or scene vibe (e.g. 🧑‍🎓, 👨‍🏫, 🤖, 🦊, 💢, ⚡).
  Ensure that the output is valid JSON. Properly escape any newlines or quotes in the string fields.`;

  const userPrompt = `Note Title: ${noteTitle}\nNote Content:\n${noteContent}`;

  try {
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: userPrompt }
    ]);
    const responseText = result.response.text();
    return safeJsonParse(responseText);
  } catch (error) {
    console.error('Error generating comic script:', error);
    throw error;
  }
};

/**
 * Generate a study quiz based on note title and content
 */
const generateQuiz = async (noteTitle, noteContent) => {
  const model = getModel({
    generationConfig: { 
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          questions: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                question: { type: SchemaType.STRING },
                options: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING }
                },
                answerIndex: { type: SchemaType.INTEGER },
                explanation: { type: SchemaType.STRING }
              },
              required: ["question", "options", "answerIndex", "explanation"]
            }
          }
        },
        required: ["questions"]
      }
    }
  });

  if (!model) {
    return {
      questions: [
        {
          question: `Sample Question about ${noteTitle}`,
          options: [
            "Option A (Correct Answer)",
            "Option B (Incorrect)",
            "Option C (Incorrect)",
            "Option D (Incorrect)"
          ],
          answerIndex: 0,
          explanation: "This is a fallback placeholder explanation. Add your GEMINI_API_KEY to generate interactive quizzes."
        }
      ]
    };
  }

  const systemPrompt = `You are an educational assessment expert. Create a multiple-choice quiz (3 to 5 questions) based on the note title and content provided by the user to test key concepts and active recall.
  
  Return the output as a JSON object with a "questions" array. Each question object must contain:
  - "question": string text of the question.
  - "options": array of exactly 4 strings representing the choices.
  - "answerIndex": integer (0 to 3) representing the index of the correct option in the options array.
  - "explanation": string explaining why the correct answer is right and the others are wrong.
  
  Ensure that the output is valid JSON, and that any line breaks, tabs, or quotes inside the JSON strings are properly escaped.`;

  const userPrompt = `Note Title: ${noteTitle}\nNote Content:\n${noteContent}`;

  try {
    const result = await model.generateContent([
      { text: systemPrompt },
      { text: userPrompt }
    ]);
    const responseText = result.response.text();
    return safeJsonParse(responseText);
  } catch (error) {
    console.error('Error generating quiz:', error);
    throw error;
  }
};

/**
 * Splits a document's full text into chapters or chunks dynamically.
 */
const splitDocumentIntoChapters = (text) => {
  if (!text) return [];

  const trimmed = text.trim();

  // 1. Try to find chapters using common heading patterns
  const regexPatterns = [
    /(?:^|\n)(?:\s*)(?:##?\s+)?(?:CHAPTER|Chapter|Section|SECTION)\s+([0-9a-zA-Z\-_]+)/g,
    /(?:^|\n)(?:\s*)(?:##?\s+)(Chapter\s+[0-9a-zA-Z\-_]+|CHAPTER\s+[IVXLCDM\d]+|Section\s+\d+|[0-9]+\.\s+[A-Z][a-zA-Z\s]+)/g
  ];

  let bestChapters = [];

  for (const regex of regexPatterns) {
    const chapters = [];
    let match;
    regex.lastIndex = 0;

    while ((match = regex.exec(trimmed)) !== null) {
      chapters.push({
        title: match[1] || match[0].trim().replace(/^##?\s+/, ''),
        index: match.index
      });
    }

    if (chapters.length >= 2 && chapters.length <= 50) {
      bestChapters = chapters;
      break;
    }
  }

  // If headers matched, split content by indices
  if (bestChapters.length >= 2) {
    const results = [];
    for (let i = 0; i < bestChapters.length; i++) {
      const start = bestChapters[i].index;
      const end = (i + 1 < bestChapters.length) ? bestChapters[i + 1].index : trimmed.length;
      results.push({
        title: bestChapters[i].title,
        content: trimmed.substring(start, end).trim()
      });
    }
    return results;
  }

  // Fallback: chunk size split atsentence/paragraph boundary
  const maxChunkSize = 10000;
  const results = [];
  let currentStart = 0;
  let chunkIdx = 1;

  while (currentStart < trimmed.length) {
    let currentEnd = currentStart + maxChunkSize;
    if (currentEnd >= trimmed.length) {
      currentEnd = trimmed.length;
    } else {
      const slice = trimmed.substring(currentStart, currentEnd);
      const lastParagraph = slice.lastIndexOf('\n\n');
      const lastNewline = slice.lastIndexOf('\n');
      const lastPeriod = slice.lastIndexOf('. ');

      let splitAt = -1;
      if (lastParagraph > maxChunkSize * 0.7) {
        splitAt = lastParagraph + 2;
      } else if (lastPeriod > maxChunkSize * 0.8) {
        splitAt = lastPeriod + 2;
      } else if (lastNewline > maxChunkSize * 0.8) {
        splitAt = lastNewline + 1;
      }

      if (splitAt !== -1) {
        currentEnd = currentStart + splitAt;
      }
    }

    const chunkText = trimmed.substring(currentStart, currentEnd).trim();
    if (chunkText.length > 0) {
      results.push({
        title: `Chapter ${chunkIdx}`,
        content: chunkText
      });
      chunkIdx++;
    }
    currentStart = currentEnd;
  }

  return results;
};

/**
 * Generate a study note for a parsed chapter chunk
 */
const generateNotesFromBookText = async (chapterText, titleHint = '') => {
  const model = getModel({
    systemInstruction: `You are a professional academic assistant. Write a detailed, complete, and beautiful set of study notes based on the provided chapter text.
    You MUST output a JSON object with exactly two keys:
    1. "title": A suitable title for this chapter's notes (use the titleHint if appropriate, or generate a better one).
    2. "content": The body of the note, which MUST be a single, flat string of study notes formatted in standard markdown.
    
    CRITICAL INSTRUCTIONS FOR "content":
    - Make the study notes comprehensive, capturing all key concepts, formulas, timelines, and facts from the chapter.
    - Write it as a clean textbook chapter or class note.
    - Use clear headings (### and ####) to separate sections.
    - Use bold text (**bold**) for key terms.
    - Use lists (- or *) with indentation to show details and relationships.
    - Do NOT format the "content" value as a JSON object/array. Output only standard markdown text.
    - Properly escape all double quotes and newlines so that the outer JSON parses correctly.`,
    generationConfig: { 
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          content: { type: SchemaType.STRING }
        },
        required: ["title", "content"]
      }
    }
  });

  if (!model) {
    return {
      title: titleHint || 'Chapter Notes',
      content: `[AI Fallback] Notes for chapter:\n\n${chapterText.substring(0, 500)}...`
    };
  }

  const systemPrompt = `Analyze the provided chapter text and generate a comprehensive set of study notes in the required JSON format.
  
  Chapter Title Hint: "${titleHint}"
  
  Text to summarize and turn into study notes:
  """
  ${chapterText}
  """`;

  try {
    const result = await model.generateContent(systemPrompt);
    const responseText = result.response.text();
    const parsed = safeJsonParse(responseText);

    if (parsed && parsed.content) {
      if (typeof parsed.content === 'object') {
        parsed.content = convertJsonToMarkdown(parsed.content);
      } else {
        parsed.content = tryConvertJsonToMarkdown(parsed.content);
      }
    }
    return parsed;
  } catch (error) {
    console.error('Error generating notes from book text:', error);
    throw error;
  }
};

/**
 * Extract text from an image or PDF using Gemini's vision/document capabilities
 */
const extractTextFromDocument = async (mimeType, buffer) => {
  const model = getModel({
    systemInstruction: "You are an OCR and text extraction assistant. Your task is to transcribe any readable text in the provided document accurately. Preserve formatting, paragraphs, and lists. Do not describe the document, just output the text you see."
  });

  if (!model) {
    return "[AI Fallback] Extracted text from document. Please add your GEMINI_API_KEY.";
  }

  const prompt = "Extract all readable text from this document.";

  const documentPart = {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType: mimeType
    }
  };

  try {
    const result = await model.generateContent([prompt, documentPart]);
    const responseText = result.response.text();
    return responseText.trim();
  } catch (error) {
    console.error('Error extracting text from document:', error);
    throw error;
  }
};

module.exports = {
  generateNoteFromPrompt,
  generateMnemonicsOrShortNotes,
  explainOrAnalyzeText,
  generateComicStrip,
  generateQuiz,
  splitDocumentIntoChapters,
  generateNotesFromBookText,
  extractTextFromDocument,
};
