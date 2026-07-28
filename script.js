const GEMMA_API_KEY = 'PASTE_YOUR_API_KEY_HERE';
const GEMMA_MODEL = 'gemma-4-26b-a4b-it';

const form = document.getElementById('discoveryForm');
const topicInput = document.getElementById('topicInput');
const levelSelect = document.getElementById('levelSelect');
const skillSelect = document.getElementById('skillSelect');
const submitBtn = document.getElementById('submitBtn');
const responseArea = document.getElementById('responseArea');
const loadingState = document.getElementById('loadingState');
const resultContent = document.getElementById('resultContent');
const followupButtons = document.getElementById('followupButtons');

let currentTopic = '';
let currentLevel = '';
let currentSkill = '';

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const topic = topicInput.value.trim();
  const level = levelSelect.value;
  const skill = skillSelect.value;
  if (!topic) return;

  currentTopic = topic;
  currentLevel = level;
  currentSkill = skill;

  followupButtons.classList.add('hidden');
  await runGemmaRequest(buildMainPrompt(topic, level, skill), parseMainResponse, true);
});

followupButtons.addEventListener('click', async (e) => {
  const btn = e.target.closest('.followup-btn');
  if (!btn) return;

  const mode = btn.dataset.mode;
  document.querySelectorAll('.followup-btn').forEach(b => b.disabled = true);

  const prompt = buildFollowupPrompt(mode, currentTopic, currentLevel, currentSkill);
  await runGemmaRequest(prompt, (raw) => parseFollowupResponse(raw, mode), false);

  document.querySelectorAll('.followup-btn').forEach(b => b.disabled = false);
});

async function runGemmaRequest(prompt, parserFn, showButtonsAfter) {
  responseArea.classList.remove('hidden');
  loadingState.classList.remove('hidden');
  resultContent.innerHTML = '';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Thinking...';

  try {
    const rawText = await callGemma(prompt);
    const html = parserFn(rawText);
    resultContent.innerHTML = html;
    if (showButtonsAfter) followupButtons.classList.remove('hidden');
  } catch (err) {
    resultContent.innerHTML = `<p style="color:#dc2626;">Something went wrong: ${err.message}</p>`;
    console.error(err);
  } finally {
    loadingState.classList.add('hidden');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Discover';
  }
}

function buildMainPrompt(topic, level, skill) {
  return `A ${level} university student, with ${skill} experience in this specific area, entered: "${topic}"

This input might be either:
(a) A general subject/skill they want to learn (e.g. "Web Development", "Entrepreneurship"), OR
(b) A specific university course code or title (e.g. "LIS 201", "Introduction to Cataloguing")

If it looks like a course code or course title, treat it as (b) and provide course-focused guidance (key concepts, likely exam areas, study approach). Otherwise treat it as (a) and provide general learning guidance.

Tailor the depth and complexity of your response to their ${skill} experience level with this specific topic, not just their academic year.

Return ONLY valid HTML using exactly this structure, with real, specific, filled-in content in every list item (never use placeholder text or ellipses):

<h3>Learning Roadmap</h3>
<ul><li>first specific step</li><li>second specific step</li><li>third specific step</li></ul>

<h3>Recommended Resources</h3>
<ul><li>first specific resource</li><li>second specific resource</li></ul>

<h3>Related Subjects</h3>
<ul><li>first specific related subject</li><li>second specific related subject</li></ul>

<h3>Estimated Study Time</h3>
<ul><li>a specific realistic time estimate and weekly commitment</li></ul>

Do not explain your reasoning. Do not repeat these instructions. Do not use "..." anywhere. Start immediately with <h3>.`;
}

function buildFollowupPrompt(mode, topic, level, skill) {
  if (mode === 'studyplan') {
    return `A ${level} student with ${skill} experience is learning "${topic}". Create a practical 7-day study plan appropriate for their experience level.

Return ONLY valid HTML with real, specific content for each day (no placeholders):
<h3>7-Day Study Plan</h3>
<ul><li>Day 1: specific task</li><li>Day 2: specific task</li><li>Day 3: specific task</li><li>Day 4: specific task</li><li>Day 5: specific task</li><li>Day 6: specific task</li><li>Day 7: specific task</li></ul>

Keep each day concise and actionable. Do not explain, do not add commentary, do not use "...". Start immediately with <h3>.`;
  }

  if (mode === 'resources') {
    return `A ${level} student with ${skill} experience is learning "${topic}". Provide 5-7 additional specific learning resources appropriate for their experience level (books, websites, courses, communities).

Return ONLY valid HTML with real, specific resources (no placeholders):
<h3>More Resources</h3>
<ul><li>specific resource with a short description</li></ul>

Do not explain, do not add commentary, do not use "...". Start immediately with <h3>.`;
  }

  if (mode === 'quiz') {
    return `A ${level} student with ${skill} experience is learning "${topic}". Create 5 practice questions appropriate for their experience level.

Return ONLY valid HTML with real, specific questions (no placeholders):
<h3>Practice Questions</h3>
<ul><li>specific question 1</li></ul>

Do not include answers. Do not explain, do not add commentary, do not use "...". Start immediately with <h3>.`;
  }
}

async function callGemma(prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent?key=${GEMMA_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2048
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  console.log("RAW RESPONSE:");
  console.log(text);

  if (!text) {
    throw new Error('No content returned from Gemma');
  }

  text = text.replace(/`+/g, '').trim();
  return text;
}

function parseMainResponse(rawText) {
  const sectionTitles = ['Learning Roadmap', 'Recommended Resources', 'Related Subjects', 'Estimated Study Time'];
  const icons = {
    'Learning Roadmap': '🗺️',
    'Recommended Resources': '📚',
    'Related Subjects': '🔗',
    'Estimated Study Time': '⏱️'
  };
  return buildSections(rawText, sectionTitles, icons);
}

function parseFollowupResponse(rawText, mode) {
  const titleMap = {
    studyplan: '7-Day Study Plan',
    resources: 'More Resources',
    quiz: 'Practice Questions'
  };
  const iconMap = {
    studyplan: '📅',
    resources: '🔍',
    quiz: '❓'
  };
  const title = titleMap[mode];
  const icons = { [title]: iconMap[mode] };
  return buildSections(rawText, [title], icons);
}

// Robust section builder:
// Anchors backward from the LAST title in the list, ensuring all sections
// come from the SAME final draft rather than mixing fragments from earlier attempts
function buildSections(rawText, sectionTitles, icons) {
  let cleanText = rawText.replace(/<\/?(h3|ul|li)>/gi, '\n');

  // Walk titles in REVERSE, anchoring each search before the previous match
  // This guarantees a consistent, non-overlapping final block
  let positions = [];
  let searchEnd = cleanText.length;

  for (let i = sectionTitles.length - 1; i >= 0; i--) {
    const title = sectionTitles[i];
    const idx = cleanText.lastIndexOf(title, searchEnd - 1);
    if (idx === -1) continue;
    positions.unshift({ title, idx });
    searchEnd = idx; // next (earlier) title must be found before this point
  }

  // If the first section title appears AGAIN after our last matched position,
  // that signals a second draft/attempt follows — cut everything from there onward
  if (positions.length > 0) {
    const lastPos = positions[positions.length - 1];
    const firstTitle = sectionTitles[0];
    const searchFrom = lastPos.idx + lastPos.title.length;
    const secondDraftIdx = cleanText.indexOf(firstTitle, searchFrom);
    if (secondDraftIdx !== -1) {
      cleanText = cleanText.substring(0, secondDraftIdx);
    }
  }

  let html = '';

  positions.forEach((p, i) => {
    const start = p.idx + p.title.length;
    const end = i + 1 < positions.length ? positions[i + 1].idx : cleanText.length;
    let sectionText = cleanText.substring(start, end);

    const items = sectionText
      .split('\n')
      .map(line => line.replace(/^\*+\s*/, '').replace(/\*/g, '').replace(/^-+\s*/, '').replace(/^\d+\.\s*/, '').trim())
      .filter(line => line.length > 0)
      .filter(line => !/^(self-correction|wait|decision|check|refin|one more thought|final|constraint)/i.test(line))
      .filter(line => line !== '...' && line !== '.' && line.length > 2)
      .filter(line => !/\?\s*(yes|no)\.?$/i.test(line))
      // Broader self-check catch: any line containing "?" AND the word "yes"/"no" anywhere
      .filter(line => !(/\?/.test(line) && /\b(yes|no)\b/i.test(line)))
      .filter(line => !/^(valid|exact|real|specific|no reasoning|no explanation|no placeholder)/i.test(line))
      // Filter out mini-headers like "Roadmap:", "Resources:", "Time:" that sometimes leak from an earlier draft
      .filter(line => !/^[a-z\s]+:$/i.test(line))
      // Filter out trailing fragments like "Starts with" or "Start with"
      .filter(line => !/^starts?\s+with\.?$/i.test(line));

    if (items.length === 0) return;

    html += `<h3>${icons[p.title] || '📌'} ${p.title}</h3><ul>`;
    items.forEach(item => {
      html += `<li>${item}</li>`;
    });
    html += `</ul>`;
  });

  if (!html) {
    const fallback = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return `<h3>📄 Result</h3><ul><li>${fallback.substring(0, 500)}</li></ul>`;
  }

  return html;
}