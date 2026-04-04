// api/parse-file.js — Vercel Serverless Function
// Accepts base64-encoded file content + mime type, returns extracted plain text
// Supports: PDF (via pdf-parse), DOCX (via mammoth), plain text/TXT, DOC fallback

const MAX_BYTES = 5 * 1024 * 1024; // 5MB limit

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { data, mimeType, fileName } = req.body || {};

  if (!data || typeof data !== 'string') {
    return res.status(400).json({ error: 'Missing file data' });
  }

  // Decode base64
  let buffer;
  try {
    buffer = Buffer.from(data, 'base64');
  } catch {
    return res.status(400).json({ error: 'Invalid base64 data' });
  }

  if (buffer.length > MAX_BYTES) {
    return res.status(413).json({ error: 'File is too large (max 5MB). Please paste your resume text instead.' });
  }

  const ext = (fileName || '').split('.').pop().toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  try {
    // ── PDF ──
    if (mime === 'application/pdf' || ext === 'pdf') {
      const pdfParse = require('pdf-parse');
      const result = await pdfParse(buffer);
      let text = result.text || '';
      text = text.replace(/\s{3,}/g, '\n').trim();
      if (text.length < 50) {
        return res.status(422).json({ error: 'Could not extract text from this PDF. It may be image-based (scanned). Please paste your resume text instead.' });
      }
      return res.status(200).json({ text: text.substring(0, 8000) });
    }

    // ── DOCX ──
    if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === 'docx'
    ) {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      let text = (result.value || '').trim();
      if (text.length < 50) {
        return res.status(422).json({ error: 'Could not extract text from this Word document. Please paste your resume text instead.' });
      }
      return res.status(200).json({ text: text.substring(0, 8000) });
    }

    // ── DOC (old Word) — best-effort text extraction ──
    if (mime === 'application/msword' || ext === 'doc') {
      // Try mammoth first — it handles some .doc files
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        if (result.value && result.value.length > 50) {
          return res.status(200).json({ text: result.value.substring(0, 8000) });
        }
      } catch {}
      // Fallback: raw string extraction (strips binary, keeps ASCII text)
      let text = buffer.toString('latin1').replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s{3,}/g, '\n').trim();
      if (text.length < 50) {
        return res.status(422).json({ error: 'Old .doc format could not be read. Please save as .docx or paste your resume text.' });
      }
      return res.status(200).json({ text: text.substring(0, 8000) });
    }

    // ── Plain text / TXT / RTF fallback ──
    let text = buffer.toString('utf-8');
    // Remove RTF control words if it looks like RTF
    if (text.startsWith('{\\rtf')) {
      text = text
        .replace(/\\[a-z]+\d*\s?/g, ' ')
        .replace(/[{}\\]/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }
    if (text.length < 20) {
      return res.status(422).json({ error: 'Could not read this file format. Please paste your resume text instead.' });
    }
    return res.status(200).json({ text: text.substring(0, 8000) });

  } catch (err) {
    console.error('parse-file error:', err);
    return res.status(500).json({ error: 'Could not parse this file. Please paste your resume text instead.' });
  }
};
