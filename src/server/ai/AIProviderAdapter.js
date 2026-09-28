/**
 * @file AIProviderAdapter.js
 * Pluggable AI Vision Provider Adapter for Backend Image/File Analysis
 * 
 * Supports:
 * - Google Gemini Vision API (gemini-1.5-flash, gemini-2.0-flash, etc.)
 * - OpenAI Vision API (gpt-4o, gpt-4o-mini)
 * - Custom / Mock registered provider for testing and extensible deployments
 * 
 * Security:
 * - API keys are read from server environment variables (AI_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY).
 * - Never sent to or exposed in the frontend.
 */

import { GRAPH_VISION_SYSTEM_PROMPT } from './graphVisionPrompt.js';

let activeCustomProvider = null;

/**
 * Sets a custom backend AI provider function (useful for tests or custom server models).
 * @param {Function|null} provider - async (file, options) => Object (raw GraphSpecification)
 */
export function setBackendAIProvider(provider) {
  activeCustomProvider = typeof provider === 'function' ? provider : null;
}

/**
 * Gets the currently registered custom backend AI provider.
 * @returns {Function|null}
 */
export function getBackendAIProvider() {
  return activeCustomProvider;
}

/**
 * Checks whether any AI Vision credentials or custom providers are configured.
 * @returns {boolean}
 */
export function isAIConfigured() {
  if (activeCustomProvider) return true;
  return Boolean(
    process.env.AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENAI_API_KEY
  );
}

/**
 * Strips markdown code block wrappers (e.g. ```json ... ```) from model response.
 * @param {string} text
 * @returns {string}
 */
export function cleanJsonResponseText(text) {
  if (!text) return '';
  let clean = text.trim();
  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return clean.trim();
}

let cachedBackendWorkingModel = null;

export const BACKEND_FALLBACK_GEMINI_MODELS = [
  // 1. Latest 2026 Multimodal Models
  { name: 'gemini-3.8-flash', apiVersion: 'v1beta' },
  { name: 'gemini-3.7-flash', apiVersion: 'v1beta' },
  { name: 'gemini-3.6-flash', apiVersion: 'v1beta' },
  { name: 'gemini-3.5-flash', apiVersion: 'v1beta' },
  { name: 'gemini-flash-latest', apiVersion: 'v1beta' },
  { name: 'gemini-flash-latest', apiVersion: 'v1' },
  { name: 'gemini-pro-latest', apiVersion: 'v1beta' },
  { name: 'gemini-flash-lite-latest', apiVersion: 'v1beta' },

  // 2. Gemini 2.0 Flash
  { name: 'gemini-2.0-flash', apiVersion: 'v1beta' },
  { name: 'gemini-2.0-flash', apiVersion: 'v1' },
  { name: 'gemini-2.0-flash-exp', apiVersion: 'v1beta' },
  { name: 'gemini-2.0-flash-lite', apiVersion: 'v1beta' },
  { name: 'gemini-2.0-flash-lite-preview-02-05', apiVersion: 'v1beta' },

  // 2. Gemini 1.5 Flash
  { name: 'gemini-1.5-flash', apiVersion: 'v1' },
  { name: 'gemini-1.5-flash', apiVersion: 'v1beta' },
  { name: 'gemini-1.5-flash-002', apiVersion: 'v1beta' },
  { name: 'gemini-1.5-flash-001', apiVersion: 'v1beta' },
  { name: 'gemini-1.5-flash-latest', apiVersion: 'v1beta' },

  // 3. Gemini 1.5 Pro
  { name: 'gemini-1.5-pro', apiVersion: 'v1' },
  { name: 'gemini-1.5-pro', apiVersion: 'v1beta' },
  { name: 'gemini-1.5-pro-002', apiVersion: 'v1beta' },
  { name: 'gemini-1.5-pro-001', apiVersion: 'v1beta' },
  { name: 'gemini-1.5-pro-latest', apiVersion: 'v1beta' },
];

async function fetchBackendAvailableModels(apiKey) {
  if (!apiKey) return [];
  const results = [];
  const seen = new Set();
  const versions = ['v1beta', 'v1'];

  for (const ver of versions) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/${ver}/models?key=${encodeURIComponent(apiKey)}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data.models)) {
        for (const m of data.models) {
          const methods = m.supportedGenerationMethods || [];
          if (methods.includes('generateContent')) {
            const cleanName = (m.name || '').replace(/^models\//, '');
            const lowerName = cleanName.toLowerCase();

            // Filter out non-vision/audio/embedding models that cannot accept images
            if (
              lowerName.includes('-tts') ||
              lowerName.includes('-audio') ||
              lowerName.includes('embed') ||
              lowerName.includes('moderation') ||
              lowerName.includes('imagen')
            ) {
              continue;
            }

            const key = `${ver}:${cleanName}`;
            if (cleanName && !seen.has(key)) {
              seen.add(key);
              results.push({ name: cleanName, apiVersion: ver });
            }
          }
        }
      }
    } catch {}
  }

  results.sort((a, b) => {
    const score = (item) => {
      const n = (item.name || '').toLowerCase();
      if (n === 'gemini-3.8-flash') return 100;
      if (n.startsWith('gemini-3.8-flash')) return 98;
      if (n === 'gemini-3.7-flash') return 95;
      if (n === 'gemini-3.6-flash') return 92;
      if (n === 'gemini-3.5-flash') return 90;
      if (n === 'gemini-flash-latest') return 88;
      if (n.includes('3.8-flash')) return 85;
      if (n.includes('3.7-flash')) return 80;
      if (n.includes('3.5-flash')) return 75;
      if (n.includes('flash-latest')) return 70;
      if (n.includes('flash')) return 60;
      if (n.includes('pro')) return 50;
      return 10;
    };
    return score(b) - score(a);
  });

  return results;
}

/**
 * Calls Google Gemini Vision API.
 * Features automatic model discovery and fallback with dual v1/v1beta support.
 * @param {Object} file - { filename, type, data: Buffer, size }
 * @param {Object} options
 * @returns {Promise<Object>} Raw GraphSpecification object
 */
async function callGeminiVision(file, options = {}) {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error('Thiếu API Key cho Google Gemini Vision.');
  }

  const parts = [{ text: GRAPH_VISION_SYSTEM_PROMPT }];
  if (file.isText || file.text || (file.type && file.type.startsWith('text/'))) {
    const textContent = file.text || (file.data ? file.data.toString('utf8') : '');
    parts.push({
      text: `Dưới đây là văn bản mô tả đồ thị từ bài tập/tài liệu:\n\n${textContent}\n\nHãy phân tích và trích xuất cấu trúc đồ thị JSON chuẩn GraphSpecification.`,
    });
  } else {
    const mimeType = file.type || 'image/png';
    const base64Data = Buffer.isBuffer(file.data)
      ? file.data.toString('base64')
      : (typeof file.data === 'string' ? file.data : Buffer.from(file.data).toString('base64'));
    parts.push({
      inlineData: {
        mimeType,
        data: base64Data,
      },
    });
  }

  const requestBody = {
    contents: [
      {
        parts,
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  };

  const candidateList = [];
  const seenCandidates = new Set();

  const addCandidate = (cand) => {
    if (!cand || !cand.name) return;
    const key = `${cand.apiVersion || 'v1beta'}:${cand.name}`;
    if (!seenCandidates.has(key)) {
      seenCandidates.add(key);
      candidateList.push({
        name: cand.name,
        apiVersion: cand.apiVersion || 'v1beta',
      });
    }
  };

  const primaryModel = options.model || process.env.GEMINI_MODEL || process.env.AI_MODEL;
  if (primaryModel && primaryModel !== 'auto') {
    addCandidate({ name: primaryModel, apiVersion: 'v1beta' });
    addCandidate({ name: primaryModel, apiVersion: 'v1' });
  }

  if (cachedBackendWorkingModel) {
    addCandidate(cachedBackendWorkingModel);
  }

  try {
    const discovered = await fetchBackendAvailableModels(apiKey);
    for (const d of discovered) {
      addCandidate(d);
    }
  } catch {}

  for (const fb of BACKEND_FALLBACK_GEMINI_MODELS) {
    addCandidate(fb);
  }

  let lastError = null;
  let response = null;

  for (const cand of candidateList) {
    const url = `https://generativelanguage.googleapis.com/${cand.apiVersion}/models/${encodeURIComponent(cand.name)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (res.ok) {
        response = res;
        cachedBackendWorkingModel = { name: cand.name, apiVersion: cand.apiVersion };
        break;
      }

      const errText = await res.text();
      let msg = `Lỗi Gemini API (${res.status})`;
      let errorStatus = '';
      try {
        const parsed = JSON.parse(errText);
        msg = parsed.error?.message || msg;
        errorStatus = parsed.error?.status || '';
      } catch {}

      const msgLower = msg.toLowerCase();

      // Case 0: Key kiểu AQ./OAuth không được REST API chấp nhận -> FAIL FAST, không thử model khác
      const isOAuthTokenTypeError =
        res.status === 401 ||
        errorStatus === 'UNAUTHENTICATED' ||
        msgLower.includes('oauth 2 access token') ||
        msgLower.includes('access_token_type_unsupported');
      if (isOAuthTokenTypeError) {
        throw new Error(
          'API Key của bạn không được API này chấp nhận (lỗi xác thực OAuth). Nguyên nhân thường gặp: ' +
          'Google gần đây cấp một số Key mới có tiền tố "AQ." thay vì "AIzaSy..." cổ điển, và loại Key "AQ." ' +
          'này hiện KHÔNG dùng được với cách gọi API Key trực tiếp. Vui lòng kiểm tra: Key của bạn có bắt đầu ' +
          'bằng "AIzaSy" không? Nếu Key bắt đầu bằng "AQ." thì hãy thử tạo Key mới tại ' +
          'https://aistudio.google.com/app/apikey bằng một tài khoản/dự án Google khác (dự án cũ hơn, chưa ' +
          'bị chuyển sang loại Key mới), hoặc dùng tài khoản Google Cloud có bật sẵn "Generative Language API" ' +
          'theo cách truyền thống.'
        );
      }

      // Case 1: Invalid API Key -> FAIL FAST
      if (
        msgLower.includes('api key not valid') ||
        msgLower.includes('invalid api key') ||
        msgLower.includes('api_key_invalid') ||
        (errorStatus === 'INVALID_ARGUMENT' && msgLower.includes('api key'))
      ) {
        throw new Error('Google Gemini API Key trên máy chủ không hợp lệ. Vui lòng kiểm tra lại GEMINI_API_KEY trong .env');
      }

      // Case 1.5: High demand / Server busy on this specific model -> Try next candidate model
      const isHighDemand = msgLower.includes('high demand') ||
                           msgLower.includes('spikes in demand') ||
                           msgLower.includes('overloaded') ||
                           res.status === 503 ||
                           errorStatus === 'UNAVAILABLE';
      if (isHighDemand) {
        lastError = new Error(`Mô hình ${cand.name} (${cand.apiVersion}) đang quá tải: ${msg}`);
        continue;
      }

      // Case 2: Quota Exceeded -> FAIL FAST
      if (res.status === 429 || errorStatus === 'RESOURCE_EXHAUSTED' || msgLower.includes('quota') || msgLower.includes('exhausted')) {
        throw new Error('API Key trên máy chủ đã vượt quá hạn ngạch (Quota Exceeded).');
      }

      // Case 2.5: Project Denied Access (Suspended) -> FAIL FAST
      if (msgLower.includes('your project has been denied access')) {
        throw new Error('Dự án Google Cloud chứa API Key này đã bị Google chặn/từ chối truy cập (Your project has been denied access). Vui lòng tạo API Key mới từ một tài khoản Google khác.');
      }

      // Case 3: Model Not Found, Not Supported, Access Denied, or Modality Error -> Try next model
      const isNotFound = res.status === 404 ||
                         errorStatus === 'NOT_FOUND' ||
                         msgLower.includes('not found') ||
                         msgLower.includes('not supported for generatecontent');
      const isForbidden = res.status === 403 ||
                          errorStatus === 'PERMISSION_DENIED' ||
                          msgLower.includes('denied access') ||
                          msgLower.includes('forbidden');
      const isModalityError = msgLower.includes('modality') ||
                              msgLower.includes('not enabled') ||
                              msgLower.includes('image input') ||
                              msgLower.includes('not supported');

      if (isNotFound || isForbidden || isModalityError) {
        lastError = new Error(`Mô hình ${cand.name} (${cand.apiVersion}) không phù hợp hoặc bị từ chối: ${msg}`);
        continue;
      }

      // Case 4: Other fatal error
      throw new Error(msg);
    } catch (err) {
      if (err.message && (
        err.message.includes('không khả dụng') ||
        err.message.includes('not found') ||
        err.message.includes('404') ||
        err.message.includes('từ chối') ||
        err.message.includes('403') ||
        err.message.includes('modality') ||
        err.message.includes('image input') ||
        err.message.includes('không phù hợp') ||
        err.message.includes('quá tải') ||
        err.message.includes('high demand') ||
        err.message.includes('overloaded') ||
        err.message.includes('503')
      )) {
        lastError = err;
        continue;
      }
      throw err;
    }
  }

  if (!response) {
    if (lastError) {
      throw new Error(`Không thể kết nối đến mô hình Gemini (${lastError.message}).`);
    }
    throw new Error('Không thể kết nối đến mô hình Gemini hợp lệ.');
  }

  const result = await response.json();
  const candidate = result.candidates?.[0];
  const textContent = candidate?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error('Gemini Vision không trả về nội dung hợp lệ.');
  }

  const cleanJson = cleanJsonResponseText(textContent);
  try {
    return JSON.parse(cleanJson);
  } catch (err) {
    throw new Error(`Kết quả từ Gemini Vision không phải là JSON hợp lệ: ${err.message}`);
  }
}

/**
 * Calls OpenAI Vision API.
 * @param {Object} file - { filename, type, data: Buffer, size }
 * @param {Object} options
 * @returns {Promise<Object>} Raw GraphSpecification object
 */
async function callOpenAIVision(file, options = {}) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error('Thiếu API Key cho OpenAI Vision.');
  }

  const model = options.model || process.env.OPENAI_MODEL || process.env.AI_MODEL || 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';

  let userContent;
  if (file.isText || file.text || (file.type && file.type.startsWith('text/'))) {
    const textContent = file.text || (file.data ? file.data.toString('utf8') : '');
    userContent = [
      {
        type: 'text',
        text: `Dưới đây là văn bản mô tả đồ thị từ bài tập/tài liệu:\n\n${textContent}\n\nHãy phân tích và trích xuất cấu trúc đồ thị JSON GraphSpecification.`,
      },
    ];
  } else {
    const mimeType = file.type || 'image/png';
    const base64Data = Buffer.isBuffer(file.data)
      ? file.data.toString('base64')
      : (typeof file.data === 'string' ? file.data : Buffer.from(file.data).toString('base64'));
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    userContent = [
      { type: 'text', text: 'Vui lòng phân tích đồ thị từ hình ảnh này và xuất JSON GraphSpecification.' },
      {
        type: 'image_url',
        image_url: { url: dataUrl },
      },
    ];
  }

  const requestBody = {
    model: model,
    messages: [
      {
        role: 'system',
        content: GRAPH_VISION_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: userContent,
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI Vision API error (${response.status}): ${errText}`);
  }

  const result = await response.json();
  const textContent = result.choices?.[0]?.message?.content;

  if (!textContent) {
    throw new Error('OpenAI Vision không trả về nội dung hợp lệ.');
  }

  const cleanJson = cleanJsonResponseText(textContent);
  try {
    return JSON.parse(cleanJson);
  } catch (err) {
    throw new Error(`Kết quả từ OpenAI Vision không phải là JSON hợp lệ: ${err.message}`);
  }
}

/**
 * Primary backend entry point for AI analysis of an uploaded graph file.
 * 
 * @param {Object} file - { filename: string, type: string, data: Buffer, size: number }
 * @param {Object} [options={}]
 * @returns {Promise<Object>} Raw GraphSpecification object
 */
export async function analyzeGraphFileBackend(file, options = {}) {
  if (!file || !file.data) {
    throw new Error('Không tìm thấy dữ liệu tệp đính kèm.');
  }

  // 1. Custom / Mock provider
  if (activeCustomProvider) {
    return await activeCustomProvider(file, options);
  }

  // 2. Direct mock support for testing
  if (options.mockSpec) {
    return options.mockSpec;
  }

  // 3. Check configuration
  if (!isAIConfigured()) {
    throw new Error('AI_NOT_CONFIGURED');
  }

  // 4. Determine provider based on environment
  if (process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    return await callOpenAIVision(file, options);
  }

  // Default to Gemini Vision (Google Generative AI)
  return await callGeminiVision(file, options);
}
