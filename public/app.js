/**
 * PDF ShrinkPro & Tools Suite - Full Application Controller
 * Features:
 * 1. Compress PDF to Target Size Limit (Adaptive Multi-Pass Engine)
 * 2. Split & Extract PDF Pages (Range, Single Pages, Visual Thumbnail Grid, ZIP)
 * 3. PDF to Image (PNG, JPEG, WebP at 72, 150, 300 DPI, Batch ZIP)
 * 4. Encrypt PDF (AES-256 Military Grade Protection)
 * 5. Decrypt PDF & Remove Lock (Permanent Password & Restriction Removal)
 */

(function () {
  'use strict';

  // -------------------------------------------------------------
  // Library Verification & PDF.js Worker Configuration
  // -------------------------------------------------------------
  const { PDFDocument } = window.PDFLib || {};
  const pdfjsLib = window.pdfjsLib;
  const JSZip = window.JSZip;

  if (pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
  }

  // -------------------------------------------------------------
  // Tool Descriptions
  // -------------------------------------------------------------
  const TOOL_DESCRIPTIONS = {
    compress: 'Compress your PDF documents down to an <strong>exact size limit</strong>. Powered by an adaptive resolution & quality algorithm that preserves maximum sharpness.',
    split: 'Extract specific pages, custom ranges, or burst every single page into individual standalone PDF files with <strong>visual page selection</strong>.',
    toImage: 'Convert document pages into crisp <strong>PNG, JPEG, or WebP</strong> images at up to 300 DPI ultra-high definition with batch ZIP download.',
    encrypt: 'Protect your sensitive documents with <strong>Acrobat-compatible AES-256 bit</strong> encryption and custom passwords.',
    decrypt: 'Permanently remove password protection and restrictions. Enter the document password once to export an <strong>unlocked PDF</strong>.'
  };

  // -------------------------------------------------------------
  // Global Application State
  // -------------------------------------------------------------
  const state = {
    currentTool: 'compress',   // 'compress' | 'split' | 'toImage' | 'encrypt' | 'decrypt'
    originalFile: null,        // File object
    originalBuffer: null,      // ArrayBuffer
    originalSize: 0,           // bytes
    originalPageCount: 0,
    originalPdfJsDoc: null,    // PDF.js Document Proxy
    pageDimensions: [],        // [{ width, height }] in points
    isEncrypted: false,
    documentPassword: '',

    // Compress Tool State
    targetSizeBytes: 1048576,  // default 1.0 MB
    targetUnit: 'MB',
    targetValue: 1.0,
    strategy: 'adaptive',
    compressedBytes: null,
    compressedSize: 0,
    compressedBlobUrl: null,
    compressedPdfJsDoc: null,

    // Split Tool State
    splitMode: 'range',        // 'range' | 'allPages' | 'everyN'
    selectedPages: new Set(),  // 1-indexed numbers: Set([1, 2, ...])
    splitResultBlob: null,
    splitResultFilename: '',

    // PDF to Image State
    imageFormat: 'png',        // 'png' | 'jpeg' | 'webp'
    imageDpi: 150,             // 72, 150, 300
    convertedImages: [],       // [{ pageNum, blob, dataUrl, filename }]

    // Encrypt State
    encryptResultBlob: null,

    // Decrypt State
    decryptResultBlob: null,

    previewCurrentPage: 1,
    isProcessing: false
  };

  // -------------------------------------------------------------
  // DOM Elements
  // -------------------------------------------------------------
  const toolTabs = document.querySelectorAll('.tool-tab');
  const heroToolDescription = document.getElementById('heroToolDescription');
  const activeFileBar = document.getElementById('activeFileBar');
  const displayFileName = document.getElementById('displayFileName');
  const displayOriginalSize = document.getElementById('displayOriginalSize');
  const displayPageCount = document.getElementById('displayPageCount');
  const displayDimensions = document.getElementById('displayDimensions');
  const displayLockStatus = document.getElementById('displayLockStatus');
  const changeFileBtn = document.getElementById('changeFileBtn');

  const uploadSection = document.getElementById('uploadSection');
  const dropZone = document.getElementById('dropZone');
  const pdfFileInput = document.getElementById('pdfFileInput');
  const loadSampleBtn = document.getElementById('loadSampleBtn');
  const dropzoneTitle = document.getElementById('dropzoneTitle');

  // Tool Panels
  const toolPanels = {
    compress: document.getElementById('toolSectionCompress'),
    split: document.getElementById('toolSectionSplit'),
    toImage: document.getElementById('toolSectionToImage'),
    encrypt: document.getElementById('toolSectionEncrypt'),
    decrypt: document.getElementById('toolSectionDecrypt')
  };

  // Compress Tool Controls
  const targetSizeValue = document.getElementById('targetSizeValue');
  const targetStepDown = document.getElementById('targetStepDown');
  const targetStepUp = document.getElementById('targetStepUp');
  const unitMB = document.getElementById('unitMB');
  const unitKB = document.getElementById('unitKB');
  const targetExactBytesDisplay = document.getElementById('targetExactBytesDisplay');
  const targetReductionEstimate = document.getElementById('targetReductionEstimate');
  const targetSizeSlider = document.getElementById('targetSizeSlider');
  const sliderMinLabel = document.getElementById('sliderMinLabel');
  const sliderCurrentLabel = document.getElementById('sliderCurrentLabel');
  const sliderMaxLabel = document.getElementById('sliderMaxLabel');
  const presetButtons = document.querySelectorAll('.preset-btn');
  const strategyInputs = document.querySelectorAll('input[name="compressionStrategy"]');
  const startCompressBtn = document.getElementById('startCompressBtn');
  const compressBtnText = document.getElementById('compressBtnText');

  // Split Tool Controls
  const splitRangeInput = document.getElementById('splitRangeInput');
  const splitSelectAllBtn = document.getElementById('splitSelectAllBtn');
  const splitClearBtn = document.getElementById('splitClearBtn');
  const splitSelectionSummary = document.getElementById('splitSelectionSummary');
  const splitThumbnailsGrid = document.getElementById('splitThumbnailsGrid');
  const executeSplitBtn = document.getElementById('executeSplitBtn');
  const splitBtnLabel = document.getElementById('splitBtnLabel');
  const splitModePills = document.querySelectorAll('.split-mode-pill');
  const splitRangeBox = document.getElementById('splitRangeBox');
  const splitEveryNBox = document.getElementById('splitEveryNBox');
  const splitEveryNInput = document.getElementById('splitEveryNInput');
  const everyNStepDown = document.getElementById('everyNStepDown');
  const everyNStepUp = document.getElementById('everyNStepUp');

  // PDF to Image Controls
  const formatButtons = document.querySelectorAll('[data-img-format]');
  const dpiButtons = document.querySelectorAll('[data-dpi]');
  const startConvertImagesBtn = document.getElementById('startConvertImagesBtn');
  const imageResultsContainer = document.getElementById('imageResultsContainer');
  const convertedImagesCount = document.getElementById('convertedImagesCount');
  const imageCardsGrid = document.getElementById('imageCardsGrid');
  const downloadAllImagesZipBtn = document.getElementById('downloadAllImagesZipBtn');

  // Encrypt Tool Controls
  const encryptPasswordInput = document.getElementById('encryptPasswordInput');
  const encryptPasswordConfirm = document.getElementById('encryptPasswordConfirm');
  const toggleEncryptPwdBtn = document.getElementById('toggleEncryptPwdBtn');
  const pwdStrengthFill = document.getElementById('pwdStrengthFill');
  const pwdStrengthLabel = document.getElementById('pwdStrengthLabel');
  const executeEncryptBtn = document.getElementById('executeEncryptBtn');

  // Decrypt Tool Controls
  const decryptPasswordInput = document.getElementById('decryptPasswordInput');
  const toggleDecryptPwdBtn = document.getElementById('toggleDecryptPwdBtn');
  const executeDecryptBtn = document.getElementById('executeDecryptBtn');
  const decryptStatusCard = document.getElementById('decryptStatusCard');
  const decryptCardTitle = document.getElementById('decryptCardTitle');
  const decryptCardDesc = document.getElementById('decryptCardDesc');

  // Generic Progress & Results
  const progressSection = document.getElementById('progressSection');
  const progressMainTitle = document.getElementById('progressMainTitle');
  const progressPercentage = document.getElementById('progressPercentage');
  const progressBarFill = document.getElementById('progressBarFill');
  const progressStatusText = document.getElementById('progressStatusText');
  const engineLogStream = document.getElementById('engineLogStream');

  const resultsSection = document.getElementById('resultsSection');
  const resultStatusHeadline = document.getElementById('resultStatusHeadline');
  const resultStatusDetail = document.getElementById('resultStatusDetail');
  const metricsGrid = document.getElementById('metricsGrid');
  const previewSection = document.getElementById('previewSection');
  const resOriginalSize = document.getElementById('resOriginalSize');
  const resOriginalBytes = document.getElementById('resOriginalBytes');
  const resTargetLimit = document.getElementById('resTargetLimit');
  const resTargetLimitBytes = document.getElementById('resTargetLimitBytes');
  const resCompressedSize = document.getElementById('resCompressedSize');
  const resTargetStatusBadge = document.getElementById('resTargetStatusBadge');
  const resSavingsPct = document.getElementById('resSavingsPct');
  const resSavingsBytes = document.getElementById('resSavingsBytes');

  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const previewPageIndicator = document.getElementById('previewPageIndicator');
  const originalPreviewCanvas = document.getElementById('originalPreviewCanvas');
  const compressedPreviewCanvas = document.getElementById('compressedPreviewCanvas');

  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  const downloadBtnText = document.getElementById('downloadBtnText');
  const recompressBtn = document.getElementById('recompressBtn');
  const startOverBtn = document.getElementById('startOverBtn');
  const toastContainer = document.getElementById('toastContainer');

  // Generic Download State Holder
  let currentDownloadAction = null;

  // -------------------------------------------------------------
  // Helpers: Formatting, Logs & Toasts
  // -------------------------------------------------------------
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function appendLog(message, type = 'normal') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    entry.innerHTML = `<span class="time">[${timeStr}]</span> <span>${message}</span>`;
    engineLogStream.appendChild(entry);
    engineLogStream.scrollTop = engineLogStream.scrollHeight;
  }

  function updateProgress(percentage, statusText) {
    progressBarFill.style.width = `${percentage}%`;
    progressPercentage.textContent = `${percentage}%`;
    progressStatusText.textContent = statusText;
  }

  // -------------------------------------------------------------
  // Navigation & Tool Switching
  // -------------------------------------------------------------
  function switchTool(toolKey) {
    if (state.isProcessing) return;

    state.currentTool = toolKey;
    toolTabs.forEach(tab => {
      if (tab.dataset.tool === toolKey) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    heroToolDescription.innerHTML = TOOL_DESCRIPTIONS[toolKey] || '';

    // Hide results and progress when switching
    resultsSection.classList.add('hidden');
    progressSection.classList.add('hidden');

    if (!state.originalFile) {
      uploadSection.classList.remove('hidden');
      activeFileBar.classList.add('hidden');
      Object.values(toolPanels).forEach(p => p.classList.add('hidden'));
      return;
    }

    // A file is loaded
    uploadSection.classList.add('hidden');
    activeFileBar.classList.remove('hidden');

    Object.entries(toolPanels).forEach(([key, panel]) => {
      if (key === toolKey) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });

    // Tool specific refreshes
    if (toolKey === 'split' && state.originalPdfJsDoc) {
      initSplitThumbnails();
    }
  }

  toolTabs.forEach(tab => {
    tab.addEventListener('click', () => switchTool(tab.dataset.tool));
  });

  // -------------------------------------------------------------
  // PDF Document Loading & Analysis
  // -------------------------------------------------------------
  async function loadPdfFile(file, isSample = false) {
    try {
      showToast('Reading and analyzing PDF document...', 'info');
      state.originalFile = file;
      state.originalSize = file.size;

      const arrayBuffer = await file.arrayBuffer();
      state.originalBuffer = arrayBuffer;

      // Check encryption using PDF.js
      let isEncrypted = false;
      let pdfDoc = null;

      try {
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
        pdfDoc = await loadingTask.promise;
      } catch (err) {
        if (err.name === 'PasswordException') {
          isEncrypted = true;
        } else {
          throw err;
        }
      }

      state.isEncrypted = isEncrypted;

      displayFileName.textContent = file.name;
      displayOriginalSize.textContent = formatBytes(file.size);

      if (isEncrypted) {
        displayLockStatus.classList.remove('hidden');
        displayPageCount.textContent = 'Locked';
        displayDimensions.textContent = 'Encrypted';
        showToast('Password-protected PDF detected! Switched to Decrypt tool.', 'alert');
        switchTool('decrypt');
        decryptCardTitle.textContent = 'Password-Protected PDF';
        decryptCardDesc.textContent = `File "${file.name}" is locked. Enter password below to unlock.`;
        return;
      }

      displayLockStatus.classList.add('hidden');
      state.originalPdfJsDoc = pdfDoc;
      state.originalPageCount = pdfDoc.numPages;

      const firstPage = await pdfDoc.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1.0 });
      displayPageCount.textContent = `${pdfDoc.numPages} Page${pdfDoc.numPages > 1 ? 's' : ''}`;
      displayDimensions.textContent = `${Math.round(viewport.width)} x ${Math.round(viewport.height)} pt`;

      // Setup Tool Defaults
      setupTargetSizeDefaults(file.size);
      setupSplitDefaults();

      // Show current active tool panel
      switchTool(state.currentTool);
      showToast(`Loaded ${file.name} (${formatBytes(file.size)})`, 'success');

    } catch (err) {
      console.error('Error loading PDF:', err);
      showToast('Failed to load PDF. Please ensure file is a valid PDF.', 'error');
    }
  }

  // -------------------------------------------------------------
  // TOOL 1: COMPRESS PDF LOGIC
  // -------------------------------------------------------------
  function setupTargetSizeDefaults(originalBytes) {
    let defaultTargetBytes;
    if (originalBytes > 2 * 1024 * 1024) {
      defaultTargetBytes = 1024 * 1024; // 1 MB
    } else if (originalBytes > 800 * 1024) {
      defaultTargetBytes = Math.round(originalBytes * 0.5);
    } else {
      defaultTargetBytes = Math.max(100 * 1024, Math.round(originalBytes * 0.6));
    }

    const minKB = 50;
    const maxKB = Math.round((originalBytes * 1.05) / 1024);
    targetSizeSlider.min = minKB;
    targetSizeSlider.max = maxKB;

    sliderMinLabel.textContent = formatBytes(minKB * 1024);
    sliderMaxLabel.textContent = `${formatBytes(originalBytes)} (Orig)`;

    setTargetSizeBytes(defaultTargetBytes);
  }

  function updateTargetFeedback() {
    let bytes = state.targetSizeBytes;
    targetExactBytesDisplay.textContent = `Target: ${formatBytes(bytes)} (${bytes.toLocaleString()} bytes)`;
    compressBtnText.textContent = `Compress to Target (${formatBytes(bytes)})`;

    if (state.originalSize > 0) {
      const diff = state.originalSize - bytes;
      const reduction = Math.round((diff / state.originalSize) * 100);
      if (reduction > 0) {
        targetReductionEstimate.textContent = `Reduction: ~${reduction}%`;
        targetReductionEstimate.style.background = 'rgba(16, 185, 129, 0.15)';
        targetReductionEstimate.style.color = '#34d399';
      } else {
        targetReductionEstimate.textContent = `Target is >= original size`;
        targetReductionEstimate.style.background = 'rgba(99, 102, 241, 0.15)';
        targetReductionEstimate.style.color = '#a5b4fc';
      }
    }

    sliderCurrentLabel.textContent = formatBytes(bytes);
    targetSizeSlider.value = Math.round(bytes / 1024);
  }

  function setTargetSizeBytes(bytes) {
    state.targetSizeBytes = Math.max(30 * 1024, Math.round(bytes));

    if (state.targetUnit === 'MB') {
      const mb = state.targetSizeBytes / (1024 * 1024);
      targetSizeValue.value = parseFloat(mb.toFixed(2));
      state.targetValue = parseFloat(mb.toFixed(2));
    } else {
      const kb = Math.round(state.targetSizeBytes / 1024);
      targetSizeValue.value = kb;
      state.targetValue = kb;
    }

    updateTargetFeedback();
  }

  function syncFromNumberInput() {
    let val = parseFloat(targetSizeValue.value);
    if (isNaN(val) || val <= 0) val = 0.5;
    state.targetValue = val;

    if (state.targetUnit === 'MB') {
      state.targetSizeBytes = Math.round(val * 1024 * 1024);
    } else {
      state.targetSizeBytes = Math.round(val * 1024);
    }

    updateTargetFeedback();
  }

  targetStepDown.addEventListener('click', () => {
    let step = state.targetUnit === 'MB' ? 0.2 : 50;
    let val = Math.max(0.05, parseFloat(targetSizeValue.value) - step);
    targetSizeValue.value = state.targetUnit === 'MB' ? parseFloat(val.toFixed(2)) : Math.round(val);
    syncFromNumberInput();
  });

  targetStepUp.addEventListener('click', () => {
    let step = state.targetUnit === 'MB' ? 0.2 : 50;
    let val = parseFloat(targetSizeValue.value) + step;
    targetSizeValue.value = state.targetUnit === 'MB' ? parseFloat(val.toFixed(2)) : Math.round(val);
    syncFromNumberInput();
  });

  targetSizeValue.addEventListener('input', syncFromNumberInput);

  unitMB.addEventListener('click', () => {
    if (state.targetUnit === 'MB') return;
    state.targetUnit = 'MB';
    unitMB.classList.add('active');
    unitKB.classList.remove('active');
    const mb = parseFloat((state.targetSizeBytes / (1024 * 1024)).toFixed(2));
    targetSizeValue.value = mb;
    targetSizeValue.step = '0.1';
    syncFromNumberInput();
  });

  unitKB.addEventListener('click', () => {
    if (state.targetUnit === 'KB') return;
    state.targetUnit = 'KB';
    unitKB.classList.add('active');
    unitMB.classList.remove('active');
    const kb = Math.round(state.targetSizeBytes / 1024);
    targetSizeValue.value = kb;
    targetSizeValue.step = '50';
    syncFromNumberInput();
  });

  targetSizeSlider.addEventListener('input', (e) => {
    const kb = parseInt(e.target.value, 10);
    setTargetSizeBytes(kb * 1024);
  });

  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const preset = btn.dataset.preset;
      if (preset === '500KB') {
        state.targetUnit = 'KB';
        unitKB.click();
        setTargetSizeBytes(500 * 1024);
      } else if (preset === '1MB') {
        state.targetUnit = 'MB';
        unitMB.click();
        setTargetSizeBytes(1024 * 1024);
      } else if (preset === '2MB') {
        state.targetUnit = 'MB';
        unitMB.click();
        setTargetSizeBytes(2 * 1024 * 1024);
      } else if (preset === '50PCT') {
        setTargetSizeBytes(Math.round(state.originalSize * 0.5));
      } else if (preset === '75PCT') {
        setTargetSizeBytes(Math.round(state.originalSize * 0.75));
      }
    });
  });

  strategyInputs.forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.strategy-card').forEach(card => card.classList.remove('active'));
      radio.closest('.strategy-card').classList.add('active');
      state.strategy = radio.value;
    });
  });

  async function runCompression() {
    if (!state.originalBuffer || state.isProcessing) return;

    state.isProcessing = true;
    startCompressBtn.disabled = true;

    toolPanels.compress.classList.add('hidden');
    progressSection.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    engineLogStream.innerHTML = '';

    updateProgress(5, 'Initializing compression engine...');
    appendLog(`Compressing: ${state.originalFile.name}`);
    appendLog(`Original Size: ${formatBytes(state.originalSize)} | Target Limit: ${formatBytes(state.targetSizeBytes)}`);

    try {
      const startTime = performance.now();
      let finalBytes = null;
      let passNumber = 0;

      // Phase 1: Lossless test
      appendLog('Phase 1: Testing lossless object stream deflating...');
      updateProgress(15, 'Testing lossless stream compression...');

      const originalDoc = await PDFDocument.load(state.originalBuffer.slice(0), { ignoreEncryption: true });
      const losslessBytes = await originalDoc.save({ useObjectStreams: true });
      appendLog(`Lossless save result: ${formatBytes(losslessBytes.length)}`);

      if (losslessBytes.length <= state.targetSizeBytes || state.strategy === 'lossless') {
        if (losslessBytes.length <= state.targetSizeBytes) {
          appendLog(`✓ Target achieved losslessly!`, 'success');
        }
        finalBytes = losslessBytes;
      }

      // Phase 2: Adaptive Optimizer
      if (!finalBytes) {
        appendLog('Phase 2: Launching Adaptive Resolution & Quality Optimizer...');
        const marginFactor = state.strategy === 'strict' ? 0.88 : 0.97;
        const effectiveTarget = Math.round(state.targetSizeBytes * marginFactor);
        const pageCount = state.originalPageCount;
        const targetBytesPerPage = effectiveTarget / pageCount;

        let currentScale = 1.4;
        let currentQuality = 0.75;

        if (targetBytesPerPage >= 280 * 1024) {
          currentScale = 1.8; currentQuality = 0.85;
        } else if (targetBytesPerPage >= 140 * 1024) {
          currentScale = 1.5; currentQuality = 0.78;
        } else if (targetBytesPerPage >= 70 * 1024) {
          currentScale = 1.25; currentQuality = 0.70;
        } else if (targetBytesPerPage >= 35 * 1024) {
          currentScale = 1.0; currentQuality = 0.60;
        } else if (targetBytesPerPage >= 18 * 1024) {
          currentScale = 0.82; currentQuality = 0.45;
        } else {
          currentScale = 0.70; currentQuality = 0.35;
        }

        const maxPasses = 3;
        let passSuccess = false;

        while (passNumber < maxPasses && !passSuccess) {
          passNumber++;
          appendLog(`Pass ${passNumber}/${maxPasses}: Scale ${currentScale.toFixed(2)}x (~${Math.round(currentScale * 72)} DPI), Quality ${(currentQuality * 100).toFixed(0)}%`, 'adjust');

          const assembledBytes = await renderAndAssemblePdf(
            state.originalPdfJsDoc,
            pageCount,
            currentScale,
            currentQuality,
            (pageIdx, total) => {
              const basePct = 20 + (passNumber - 1) * 25;
              const passPct = Math.round((pageIdx / total) * 22);
              updateProgress(basePct + passPct, `Pass ${passNumber}: Page ${pageIdx}/${total}`);
            }
          );

          const passSize = assembledBytes.length;
          appendLog(`Pass ${passNumber} assembled: ${formatBytes(passSize)}`);

          if (passSize <= effectiveTarget) {
            appendLog(`✓ Pass ${passNumber} SUCCESS! Target limit satisfied!`, 'success');
            finalBytes = assembledBytes;
            passSuccess = true;
            break;
          } else {
            const overshoot = passSize / effectiveTarget;
            appendLog(`Pass ${passNumber} overshot target by ${Math.round((overshoot - 1) * 100)}%. Adjusting...`, 'alert');

            if (passNumber < maxPasses) {
              const scaleAdj = (1 / Math.sqrt(overshoot)) * 0.94;
              const qualityAdj = (1 / Math.pow(overshoot, 0.35)) * 0.96;
              currentScale = Math.max(0.45, currentScale * scaleAdj);
              currentQuality = Math.max(0.18, currentQuality * qualityAdj);
            } else {
              appendLog(`Final guaranteed squeeze pass...`, 'adjust');
              finalBytes = await renderAndAssemblePdf(
                state.originalPdfJsDoc,
                pageCount,
                Math.max(0.42, currentScale * 0.8),
                Math.max(0.15, currentQuality * 0.75)
              );
            }
          }
        }
      }

      const totalTimeMs = Math.round(performance.now() - startTime);
      updateProgress(100, 'Compression completed!');

      state.compressedBytes = finalBytes;
      state.compressedSize = finalBytes.length;

      const blob = new Blob([finalBytes], { type: 'application/pdf' });
      state.compressedBlobUrl = URL.createObjectURL(blob);

      const compressedPdfTask = pdfjsLib.getDocument({ data: finalBytes.slice(0) });
      state.compressedPdfJsDoc = await compressedPdfTask.promise;

      currentDownloadAction = () => {
        downloadBlob(blob, `${state.originalFile.name.replace(/\.pdf$/i, '')}_compressed.pdf`);
      };

      setTimeout(() => {
        showCompressionResults(totalTimeMs);
      }, 500);

    } catch (err) {
      console.error(err);
      appendLog(`ERROR: ${err.message}`, 'alert');
      showToast(`Compression failed: ${err.message}`, 'error');
    } finally {
      state.isProcessing = false;
      startCompressBtn.disabled = false;
    }
  }

  async function renderAndAssemblePdf(pdfJsDoc, pageCount, scale, quality, onPageProgress) {
    const newDoc = await PDFDocument.create();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      if (onPageProgress) onPageProgress(pageNum, pageCount);

      const page = await pdfJsDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const origViewport = page.getViewport({ scale: 1.0 });

      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport }).promise;

      const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64Data = jpegDataUrl.split(',')[1];
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const jpegBytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        jpegBytes[i] = binaryString.charCodeAt(i);
      }

      const embeddedImage = await newDoc.embedJpg(jpegBytes);
      const newPage = newDoc.addPage([origViewport.width, origViewport.height]);
      newPage.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: origViewport.width,
        height: origViewport.height
      });
    }

    return await newDoc.save({ useObjectStreams: true });
  }

  async function showCompressionResults(timeMs) {
    progressSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    metricsGrid.classList.remove('hidden');
    previewSection.classList.remove('hidden');

    const orig = state.originalSize;
    const comp = state.compressedSize;
    const target = state.targetSizeBytes;

    resOriginalSize.textContent = formatBytes(orig);
    resOriginalBytes.textContent = `${orig.toLocaleString()} bytes`;
    resTargetLimit.textContent = formatBytes(target);
    resTargetLimitBytes.textContent = `${target.toLocaleString()} bytes`;
    resCompressedSize.textContent = formatBytes(comp);

    if (comp <= target) {
      resTargetStatusBadge.textContent = '✓ Under Target Limit';
      resTargetStatusBadge.className = 'target-met-badge';
      resultStatusHeadline.textContent = 'Target Size Limit Satisfied!';
      resultStatusDetail.textContent = `Successfully compressed down to ${formatBytes(comp)} (under ${formatBytes(target)} limit) in ${(timeMs / 1000).toFixed(1)}s.`;
    } else {
      resTargetStatusBadge.textContent = 'Maximum Compression Applied';
      resTargetStatusBadge.className = 'target-met-badge alert';
      resultStatusHeadline.textContent = 'Optimal Compression Reached';
      resultStatusDetail.textContent = `Compressed to ${formatBytes(comp)}.`;
    }

    const savedBytes = orig - comp;
    const savingsPct = ((savedBytes / orig) * 100).toFixed(1);
    resSavingsPct.textContent = savedBytes >= 0 ? `-${savingsPct}%` : `+${Math.abs(savingsPct)}%`;
    resSavingsBytes.textContent = savedBytes >= 0 ? `Saved ${formatBytes(savedBytes)}` : 'Size increased';

    downloadBtnText.textContent = `Download Compressed PDF (${formatBytes(comp)})`;

    state.previewCurrentPage = 1;
    await renderComparisonPage(state.previewCurrentPage);
    showToast('Compression complete!', 'success');
  }

  async function renderComparisonPage(pageNum) {
    previewPageIndicator.textContent = `Page ${pageNum} of ${state.originalPageCount}`;
    prevPageBtn.disabled = pageNum <= 1;
    nextPageBtn.disabled = pageNum >= state.originalPageCount;

    if (state.originalPdfJsDoc) {
      const origPage = await state.originalPdfJsDoc.getPage(pageNum);
      const viewport = origPage.getViewport({ scale: 0.8 });
      originalPreviewCanvas.width = viewport.width;
      originalPreviewCanvas.height = viewport.height;
      const ctx1 = originalPreviewCanvas.getContext('2d');
      await origPage.render({ canvasContext: ctx1, viewport }).promise;
    }

    if (state.compressedPdfJsDoc) {
      const compPage = await state.compressedPdfJsDoc.getPage(pageNum);
      const viewport = compPage.getViewport({ scale: 0.8 });
      compressedPreviewCanvas.width = viewport.width;
      compressedPreviewCanvas.height = viewport.height;
      const ctx2 = compressedPreviewCanvas.getContext('2d');
      await compPage.render({ canvasContext: ctx2, viewport }).promise;
    }
  }

  // -------------------------------------------------------------
  // TOOL 2: SPLIT PDF LOGIC
  // -------------------------------------------------------------
  function setupSplitDefaults() {
    state.selectedPages.clear();
    for (let i = 1; i <= state.originalPageCount; i++) {
      state.selectedPages.add(i);
    }
    updateSplitRangeInputFromSelection();
  }

  async function initSplitThumbnails() {
    if (!state.originalPdfJsDoc) return;
    splitThumbnailsGrid.innerHTML = '';

    for (let pageNum = 1; pageNum <= state.originalPageCount; pageNum++) {
      const card = document.createElement('div');
      card.className = `page-thumb-card ${state.selectedPages.has(pageNum) ? 'selected' : ''}`;
      card.dataset.pageNum = pageNum;

      const canvasBox = document.createElement('div');
      canvasBox.className = 'page-thumb-canvas-box';

      const canvas = document.createElement('canvas');
      canvasBox.appendChild(canvas);

      const footer = document.createElement('div');
      footer.className = 'page-thumb-footer';
      footer.innerHTML = `
        <span>Page ${pageNum}</span>
        <input type="checkbox" class="page-select-checkbox" ${state.selectedPages.has(pageNum) ? 'checked' : ''} aria-label="Select page ${pageNum}">
      `;

      card.appendChild(canvasBox);
      card.appendChild(footer);
      splitThumbnailsGrid.appendChild(card);

      // Render thumbnail asynchronously
      (async (pNum, cvs) => {
        try {
          const page = await state.originalPdfJsDoc.getPage(pNum);
          const viewport = page.getViewport({ scale: 0.25 });
          cvs.width = viewport.width;
          cvs.height = viewport.height;
          const ctx = cvs.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;
        } catch (e) {
          console.error(e);
        }
      })(pageNum, canvas);

      card.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          const chk = card.querySelector('input[type="checkbox"]');
          chk.checked = !chk.checked;
        }
        togglePageSelection(pageNum);
      });
    }
    updateSplitSummary();
  }

  function togglePageSelection(pageNum) {
    const card = splitThumbnailsGrid.querySelector(`[data-page-num="${pageNum}"]`);
    if (state.selectedPages.has(pageNum)) {
      state.selectedPages.delete(pageNum);
      if (card) {
        card.classList.remove('selected');
        const chk = card.querySelector('input[type="checkbox"]');
        if (chk) chk.checked = false;
      }
    } else {
      state.selectedPages.add(pageNum);
      if (card) {
        card.classList.add('selected');
        const chk = card.querySelector('input[type="checkbox"]');
        if (chk) chk.checked = true;
      }
    }
    updateSplitRangeInputFromSelection();
    updateSplitSummary();
  }

  function updateSplitRangeInputFromSelection() {
    const sorted = Array.from(state.selectedPages).sort((a, b) => a - b);
    if (sorted.length === 0) {
      splitRangeInput.value = '';
      return;
    }

    // Convert array to ranges (e.g. [1, 2, 3, 5] -> "1-3, 5")
    const ranges = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = sorted[i];
        end = sorted[i];
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    splitRangeInput.value = ranges.join(', ');
  }

  function parseRangeString(str, maxPages) {
    const pages = new Set();
    const parts = str.split(',');
    for (let part of parts) {
      part = part.trim();
      if (!part) continue;
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          for (let p = Math.max(1, start); p <= Math.min(maxPages, end); p++) {
            pages.add(p);
          }
        }
      } else {
        const p = parseInt(part, 10);
        if (!isNaN(p) && p >= 1 && p <= maxPages) {
          pages.add(p);
        }
      }
    }
    return pages;
  }

  splitRangeInput.addEventListener('input', () => {
    state.selectedPages = parseRangeString(splitRangeInput.value, state.originalPageCount);
    // Update thumbnail cards
    document.querySelectorAll('.page-thumb-card').forEach(card => {
      const pNum = parseInt(card.dataset.pageNum, 10);
      const chk = card.querySelector('input[type="checkbox"]');
      if (state.selectedPages.has(pNum)) {
        card.classList.add('selected');
        if (chk) chk.checked = true;
      } else {
        card.classList.remove('selected');
        if (chk) chk.checked = false;
      }
    });
    updateSplitSummary();
  });

  splitSelectAllBtn.addEventListener('click', () => {
    for (let i = 1; i <= state.originalPageCount; i++) {
      state.selectedPages.add(i);
    }
    updateSplitRangeInputFromSelection();
    document.querySelectorAll('.page-thumb-card').forEach(c => {
      c.classList.add('selected');
      c.querySelector('input[type="checkbox"]').checked = true;
    });
    updateSplitSummary();
  });

  splitClearBtn.addEventListener('click', () => {
    state.selectedPages.clear();
    splitRangeInput.value = '';
    document.querySelectorAll('.page-thumb-card').forEach(c => {
      c.classList.remove('selected');
      c.querySelector('input[type="checkbox"]').checked = false;
    });
    updateSplitSummary();
  });

  function updateSplitSummary() {
    const count = state.selectedPages.size;
    splitSelectionSummary.textContent = `Selected: ${count} of ${state.originalPageCount} pages`;
    splitBtnLabel.textContent = `Extract ${count} Selected Page${count > 1 ? 's' : ''} (PDF)`;
  }

  // Split mode toggle
  splitModePills.forEach(pill => {
    pill.addEventListener('click', () => {
      splitModePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const radio = pill.querySelector('input[type="radio"]');
      radio.checked = true;
      state.splitMode = radio.value;

      if (state.splitMode === 'range') {
        splitRangeBox.classList.remove('hidden');
        splitEveryNBox.classList.add('hidden');
        splitBtnLabel.textContent = `Extract Selected Pages (PDF)`;
      } else if (state.splitMode === 'allPages') {
        splitRangeBox.classList.add('hidden');
        splitEveryNBox.classList.add('hidden');
        splitBtnLabel.textContent = `Extract All ${state.originalPageCount} Pages to ZIP`;
      } else if (state.splitMode === 'everyN') {
        splitRangeBox.classList.add('hidden');
        splitEveryNBox.classList.remove('hidden');
        splitBtnLabel.textContent = `Split Document Every N Pages (ZIP)`;
      }
    });
  });

  everyNStepDown.addEventListener('click', () => {
    let val = Math.max(1, parseInt(splitEveryNInput.value, 10) - 1);
    splitEveryNInput.value = val;
  });

  everyNStepUp.addEventListener('click', () => {
    let val = Math.min(state.originalPageCount, parseInt(splitEveryNInput.value, 10) + 1);
    splitEveryNInput.value = val;
  });

  async function executeSplit() {
    if (!state.originalBuffer || state.isProcessing) return;

    state.isProcessing = true;
    toolPanels.split.classList.add('hidden');
    progressSection.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    engineLogStream.innerHTML = '';

    try {
      appendLog('Loading PDF into memory...');
      updateProgress(20, 'Parsing PDF document structure...');
      const sourceDoc = await PDFDocument.load(state.originalBuffer.slice(0), { ignoreEncryption: true });

      const baseName = state.originalFile.name.replace(/\.pdf$/i, '');

      if (state.splitMode === 'range') {
        const sortedPages = Array.from(state.selectedPages).sort((a, b) => a - b);
        if (sortedPages.length === 0) {
          throw new Error('Please select at least one page to extract.');
        }

        appendLog(`Extracting ${sortedPages.length} pages: ${sortedPages.join(', ')}...`);
        updateProgress(50, `Copying ${sortedPages.length} pages...`);

        const newDoc = await PDFDocument.create();
        const pageIndices = sortedPages.map(p => p - 1);
        const copiedPages = await newDoc.copyPages(sourceDoc, pageIndices);
        copiedPages.forEach(p => newDoc.addPage(p));

        updateProgress(85, 'Assembling output PDF...');
        const outBytes = await newDoc.save({ useObjectStreams: true });
        const blob = new Blob([outBytes], { type: 'application/pdf' });
        const outFilename = `${baseName}_extracted_pages.pdf`;

        currentDownloadAction = () => downloadBlob(blob, outFilename);
        showGenericResults('Pages Extracted Successfully!', `Extracted ${sortedPages.length} pages into a clean standalone PDF (${formatBytes(outBytes.length)}).`, `Download PDF (${formatBytes(outBytes.length)})`);

      } else if (state.splitMode === 'allPages') {
        appendLog(`Extracting all ${state.originalPageCount} pages as individual PDFs...`);
        const zip = new JSZip();

        for (let i = 0; i < state.originalPageCount; i++) {
          const pageNum = i + 1;
          updateProgress(20 + Math.round((i / state.originalPageCount) * 60), `Extracting Page ${pageNum}/${state.originalPageCount}...`);
          appendLog(`Extracting Page ${pageNum}...`);

          const singleDoc = await PDFDocument.create();
          const [copied] = await singleDoc.copyPages(sourceDoc, [i]);
          singleDoc.addPage(copied);

          const singleBytes = await singleDoc.save({ useObjectStreams: true });
          zip.file(`${baseName}_page_${pageNum}.pdf`, singleBytes);
        }

        updateProgress(90, 'Packaging into ZIP archive...');
        appendLog('Creating ZIP archive...');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipFilename = `${baseName}_all_pages.zip`;

        currentDownloadAction = () => downloadBlob(zipBlob, zipFilename);
        showGenericResults('All Pages Split to ZIP!', `Created ${state.originalPageCount} individual PDF files bundled into a ZIP archive (${formatBytes(zipBlob.size)}).`, `Download ZIP (${formatBytes(zipBlob.size)})`);

      } else if (state.splitMode === 'everyN') {
        const n = Math.max(1, parseInt(splitEveryNInput.value, 10));
        appendLog(`Splitting into chunks of ${n} page(s)...`);
        const zip = new JSZip();
        let chunkIndex = 1;

        for (let i = 0; i < state.originalPageCount; i += n) {
          const endPage = Math.min(state.originalPageCount, i + n);
          const pageIndices = [];
          for (let p = i; p < endPage; p++) pageIndices.push(p);

          updateProgress(30 + Math.round((i / state.originalPageCount) * 50), `Creating chunk ${chunkIndex} (Pages ${i + 1}-${endPage})...`);
          appendLog(`Creating chunk ${chunkIndex} (Pages ${i + 1}-${endPage})...`);

          const chunkDoc = await PDFDocument.create();
          const copied = await chunkDoc.copyPages(sourceDoc, pageIndices);
          copied.forEach(p => chunkDoc.addPage(p));
          const chunkBytes = await chunkDoc.save({ useObjectStreams: true });

          zip.file(`${baseName}_part_${chunkIndex}_pages_${i + 1}-${endPage}.pdf`, chunkBytes);
          chunkIndex++;
        }

        updateProgress(90, 'Compressing into ZIP archive...');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipFilename = `${baseName}_chunks_of_${n}p.zip`;

        currentDownloadAction = () => downloadBlob(zipBlob, zipFilename);
        showGenericResults('Document Split Complete!', `Split into ${chunkIndex - 1} PDF chunk files bundled in a ZIP archive (${formatBytes(zipBlob.size)}).`, `Download ZIP (${formatBytes(zipBlob.size)})`);
      }

    } catch (err) {
      console.error(err);
      appendLog(`ERROR: ${err.message}`, 'alert');
      showToast(`Split failed: ${err.message}`, 'error');
    } finally {
      state.isProcessing = false;
    }
  }

  executeSplitBtn.addEventListener('click', executeSplit);

  // -------------------------------------------------------------
  // TOOL 3: PDF TO IMAGE LOGIC
  // -------------------------------------------------------------
  formatButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      formatButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.imageFormat = btn.dataset.imgFormat;
    });
  });

  dpiButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      dpiButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.imageDpi = parseInt(btn.dataset.dpi, 10);
    });
  });

  async function convertPdfToImages() {
    if (!state.originalPdfJsDoc || state.isProcessing) return;

    state.isProcessing = true;
    startConvertImagesBtn.disabled = true;
    imageResultsContainer.classList.add('hidden');
    imageCardsGrid.innerHTML = '';
    state.convertedImages = [];

    toolPanels.toImage.classList.add('hidden');
    progressSection.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    engineLogStream.innerHTML = '';

    const format = state.imageFormat; // 'png' | 'jpeg' | 'webp'
    const dpi = state.imageDpi;       // 72, 150, 300
    const scale = dpi / 72.0;
    const mimeType = format === 'jpeg' ? 'image/jpeg' : (format === 'webp' ? 'image/webp' : 'image/png');
    const ext = format === 'jpeg' ? 'jpg' : format;

    appendLog(`Starting PDF to Image conversion...`);
    appendLog(`Format: ${format.toUpperCase()} | Resolution: ${dpi} DPI (Scale: ${scale.toFixed(2)}x)`);

    try {
      const pageCount = state.originalPageCount;
      const baseName = state.originalFile.name.replace(/\.pdf$/i, '');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        updateProgress(
          Math.round((pageNum / pageCount) * 85),
          `Rendering Page ${pageNum}/${pageCount} at ${dpi} DPI...`
        );
        appendLog(`Rendering Page ${pageNum} at ${dpi} DPI...`);

        const page = await state.originalPdfJsDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport }).promise;

        const dataUrl = canvas.toDataURL(mimeType, 0.92);
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const filename = `${baseName}_page_${pageNum}.${ext}`;

        state.convertedImages.push({
          pageNum,
          blob,
          dataUrl,
          filename,
          size: blob.size,
          width: canvas.width,
          height: canvas.height
        });
      }

      updateProgress(100, 'Conversion completed!');
      appendLog(`✓ Successfully converted ${pageCount} pages to ${format.toUpperCase()} images!`, 'success');

      // Populate Image Cards Grid
      convertedImagesCount.textContent = pageCount;
      state.convertedImages.forEach(img => {
        const card = document.createElement('div');
        card.className = 'image-card';

        card.innerHTML = `
          <div class="image-card-preview">
            <img src="${img.dataUrl}" alt="Page ${img.pageNum}" loading="lazy">
          </div>
          <div class="image-card-body">
            <div class="image-card-meta">
              <span>Page ${img.pageNum}</span> &bull; <span>${formatBytes(img.size)}</span>
            </div>
            <button type="button" class="btn btn-secondary btn-sm download-single-img-btn" data-page="${img.pageNum}">
              ⬇ Download
            </button>
          </div>
        `;
        imageCardsGrid.appendChild(card);
      });

      // Hook single page download clicks
      imageCardsGrid.querySelectorAll('.download-single-img-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const p = parseInt(btn.dataset.page, 10);
          const imgObj = state.convertedImages.find(i => i.pageNum === p);
          if (imgObj) {
            downloadBlob(imgObj.blob, imgObj.filename);
            showToast(`Downloaded Page ${p}!`, 'success');
          }
        });
      });

      // Show in panel
      progressSection.classList.add('hidden');
      toolPanels.toImage.classList.remove('hidden');
      imageResultsContainer.classList.remove('hidden');
      showToast(`Converted ${pageCount} pages to images!`, 'success');

    } catch (err) {
      console.error(err);
      appendLog(`ERROR: ${err.message}`, 'alert');
      showToast(`Conversion failed: ${err.message}`, 'error');
      toolPanels.toImage.classList.remove('hidden');
      progressSection.classList.add('hidden');
    } finally {
      state.isProcessing = false;
      startConvertImagesBtn.disabled = false;
    }
  }

  startConvertImagesBtn.addEventListener('click', convertPdfToImages);

  downloadAllImagesZipBtn.addEventListener('click', async () => {
    if (state.convertedImages.length === 0) return;
    showToast('Creating ZIP archive of images...', 'info');
    const zip = new JSZip();
    state.convertedImages.forEach(img => {
      zip.file(img.filename, img.blob);
    });
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const baseName = state.originalFile.name.replace(/\.pdf$/i, '');
    downloadBlob(zipBlob, `${baseName}_images_${state.imageFormat}.zip`);
    showToast('Images ZIP downloaded!', 'success');
  });

  // -------------------------------------------------------------
  // TOOL 4: ENCRYPT PDF LOGIC
  // -------------------------------------------------------------
  toggleEncryptPwdBtn.addEventListener('click', () => {
    const isPwd = encryptPasswordInput.type === 'password';
    encryptPasswordInput.type = isPwd ? 'text' : 'password';
    toggleEncryptPwdBtn.textContent = isPwd ? '🙈' : '👁';
  });

  encryptPasswordInput.addEventListener('input', () => {
    const pwd = encryptPasswordInput.value;
    let strength = 0;
    if (pwd.length >= 4) strength += 25;
    if (pwd.length >= 8) strength += 25;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) strength += 25;
    if (/[0-9]/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) strength += 25;

    pwdStrengthFill.style.width = `${strength}%`;
    if (strength <= 25) {
      pwdStrengthFill.style.background = '#ef4444';
      pwdStrengthLabel.textContent = 'Weak Password';
      pwdStrengthLabel.style.color = '#f87171';
    } else if (strength <= 75) {
      pwdStrengthFill.style.background = '#f59e0b';
      pwdStrengthLabel.textContent = 'Medium Strength';
      pwdStrengthLabel.style.color = '#fbbf24';
    } else {
      pwdStrengthFill.style.background = '#10b981';
      pwdStrengthLabel.textContent = 'Strong Password';
      pwdStrengthLabel.style.color = '#34d399';
    }
  });

  async function executeEncrypt() {
    if (!state.originalBuffer || state.isProcessing) return;

    const pwd = encryptPasswordInput.value;
    const confirm = encryptPasswordConfirm.value;

    if (!pwd || pwd.length < 4) {
      showToast('Password must be at least 4 characters.', 'error');
      encryptPasswordInput.focus();
      return;
    }
    if (pwd !== confirm) {
      showToast('Passwords do not match. Please verify.', 'error');
      encryptPasswordConfirm.focus();
      return;
    }

    state.isProcessing = true;
    executeEncryptBtn.disabled = true;

    toolPanels.encrypt.classList.add('hidden');
    progressSection.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    engineLogStream.innerHTML = '';

    appendLog('Preparing PDF buffer for AES-256 encryption...');
    updateProgress(25, 'Connecting to encryption engine...');

    try {
      // Convert buffer to base64
      const uint8 = new Uint8Array(state.originalBuffer);
      let binary = '';
      const len = uint8.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const b64 = btoa(binary);

      appendLog('Applying AES-256 bit encryption keys...');
      updateProgress(60, 'Encrypting PDF streams...');

      const resp = await fetch('/api/encrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64: b64,
          password: pwd,
          algorithm: 'AES-256'
        })
      });

      const resData = await resp.json();
      if (!resp.ok || !resData.success) {
        throw new Error(resData.error || 'Server encryption error');
      }

      updateProgress(100, 'Encryption complete!');
      appendLog('✓ AES-256 encryption applied successfully!', 'success');

      // Decode result
      const encBinary = atob(resData.encryptedBase64);
      const encLen = encBinary.length;
      const encBytes = new Uint8Array(encLen);
      for (let i = 0; i < encLen; i++) {
        encBytes[i] = encBinary.charCodeAt(i);
      }

      const blob = new Blob([encBytes], { type: 'application/pdf' });
      const baseName = state.originalFile.name.replace(/\.pdf$/i, '');
      const outFilename = `${baseName}_encrypted.pdf`;

      currentDownloadAction = () => downloadBlob(blob, outFilename);

      showGenericResults(
        'Document Encrypted Successfully!',
        `Your PDF is now protected with AES-256 encryption. Password is required to open. (${formatBytes(blob.size)})`,
        `Download Protected PDF (${formatBytes(blob.size)})`
      );

      showToast('PDF encrypted successfully!', 'success');

    } catch (err) {
      console.error(err);
      appendLog(`ERROR: ${err.message}`, 'alert');
      showToast(`Encryption failed: ${err.message}`, 'error');
      toolPanels.encrypt.classList.remove('hidden');
      progressSection.classList.add('hidden');
    } finally {
      state.isProcessing = false;
      executeEncryptBtn.disabled = false;
    }
  }

  executeEncryptBtn.addEventListener('click', executeEncrypt);

  // -------------------------------------------------------------
  // TOOL 5: DECRYPT PDF / REMOVE LOCK LOGIC
  // -------------------------------------------------------------
  toggleDecryptPwdBtn.addEventListener('click', () => {
    const isPwd = decryptPasswordInput.type === 'password';
    decryptPasswordInput.type = isPwd ? 'text' : 'password';
    toggleDecryptPwdBtn.textContent = isPwd ? '🙈' : '👁';
  });

  async function executeDecrypt() {
    if (!state.originalBuffer || state.isProcessing) return;

    const pwd = decryptPasswordInput.value;
    if (!pwd) {
      showToast('Please enter the document password.', 'error');
      decryptPasswordInput.focus();
      return;
    }

    state.isProcessing = true;
    executeDecryptBtn.disabled = true;

    toolPanels.decrypt.classList.add('hidden');
    progressSection.classList.remove('hidden');
    resultsSection.classList.add('hidden');
    engineLogStream.innerHTML = '';

    appendLog('Sending encrypted PDF to unlock engine...');
    updateProgress(25, 'Verifying password and decrypting...');

    try {
      const uint8 = new Uint8Array(state.originalBuffer);
      let binary = '';
      const len = uint8.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8[i]);
      }
      const b64 = btoa(binary);

      const resp = await fetch('/api/decrypt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64: b64,
          password: pwd
        })
      });

      const resData = await resp.json();
      if (resp.status === 401) {
        throw new Error('Incorrect password! Please check the password and try again.');
      }
      if (!resp.ok || !resData.success) {
        throw new Error(resData.error || 'Decryption failed');
      }

      updateProgress(100, 'Document unlocked successfully!');
      appendLog('✓ Decryption successful! All security restrictions removed.', 'success');

      const decBinary = atob(resData.decryptedBase64);
      const decLen = decBinary.length;
      const decBytes = new Uint8Array(decLen);
      for (let i = 0; i < decLen; i++) {
        decBytes[i] = decBinary.charCodeAt(i);
      }

      const blob = new Blob([decBytes], { type: 'application/pdf' });
      const baseName = state.originalFile.name.replace(/\.pdf$/i, '').replace(/_encrypted$/i, '');
      const outFilename = `${baseName}_unlocked.pdf`;

      currentDownloadAction = () => downloadBlob(blob, outFilename);

      showGenericResults(
        'Password Lock Removed Permanently!',
        `Your document has been decrypted. It can now be viewed, edited, and printed without any password prompt. (${formatBytes(blob.size)})`,
        `Download Unlocked PDF (${formatBytes(blob.size)})`
      );

      showToast('Lock removed successfully!', 'success');

    } catch (err) {
      console.error(err);
      appendLog(`ERROR: ${err.message}`, 'alert');
      showToast(err.message, 'error');
      toolPanels.decrypt.classList.remove('hidden');
      progressSection.classList.add('hidden');
    } finally {
      state.isProcessing = false;
      executeDecryptBtn.disabled = false;
    }
  }

  executeDecryptBtn.addEventListener('click', executeDecrypt);

  // -------------------------------------------------------------
  // Universal Results Display & Download Helpers
  // -------------------------------------------------------------
  function showGenericResults(headline, detail, downloadText) {
    progressSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    metricsGrid.classList.add('hidden');
    previewSection.classList.add('hidden');

    resultStatusHeadline.textContent = headline;
    resultStatusDetail.textContent = detail;
    downloadBtnText.textContent = downloadText;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  downloadPdfBtn.addEventListener('click', () => {
    if (typeof currentDownloadAction === 'function') {
      currentDownloadAction();
      showToast('Download started!', 'success');
    }
  });

  recompressBtn.addEventListener('click', () => {
    resultsSection.classList.add('hidden');
    switchTool(state.currentTool);
  });

  startOverBtn.addEventListener('click', () => {
    resultsSection.classList.add('hidden');
    Object.values(toolPanels).forEach(p => p.classList.add('hidden'));
    activeFileBar.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    state.originalFile = null;
    state.originalBuffer = null;
    state.originalPdfJsDoc = null;
    pdfFileInput.value = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  changeFileBtn.addEventListener('click', () => {
    pdfFileInput.click();
  });

  // -------------------------------------------------------------
  // Drag & Drop and Sample Loader
  // -------------------------------------------------------------
  dropZone.addEventListener('click', () => pdfFileInput.click());

  pdfFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        showToast('Please select a valid PDF file.', 'error');
        return;
      }
      loadPdfFile(file);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        showToast('Only PDF files are supported.', 'error');
        return;
      }
      loadPdfFile(file);
    }
  });

  loadSampleBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      showToast('Fetching sample presentation PDF...', 'info');
      const response = await fetch('sample_large_presentation.pdf');
      if (!response.ok) throw new Error('Sample file not found');
      const blob = await response.blob();
      const sampleFile = new File([blob], 'sample_large_presentation.pdf', { type: 'application/pdf' });
      await loadPdfFile(sampleFile, true);
    } catch (err) {
      console.error(err);
      showToast('Could not load sample file.', 'error');
    }
  });

  startCompressBtn.addEventListener('click', runCompression);

  // Initialize tool on load
  switchTool('compress');

})();
