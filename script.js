document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const voiceSearchButton = document.getElementById('voiceSearchButton');
    const micIcon = document.getElementById('micIcon');
    const voiceSearchText = document.getElementById('voiceSearchText');
    const resultsList = document.getElementById('resultsList');
    const errorMessageDiv = document.getElementById('errorMessage');
    const discountRateInput = document.getElementById('discountRate');
    const multiSearchInput = document.getElementById('multiSearchInput');
    const multiSearchButton = document.getElementById('multiSearchButton');
    const resetButton = document.getElementById('resetButton');
    const copyAllButton = document.getElementById('copyAllButton');
    const copyKakaoTextButton = document.getElementById('copyKakaoTextButton');
    const copyKakaoImageButton = document.getElementById('copyKakaoImageButton');

    // 원가 + 이익률로 견적가 계산 (renderResults, 전체복사, 카톡복사 공통 사용)
    function calcDisplayPrice(item, profitMargin) {
        const basePriceStr = item['가격'] || '0';
        const basePrice = parseFloat(String(basePriceStr).replace(/,/g, ''));
        if (isNaN(basePrice)) return { basePrice: 0, displayPrice: 'N/A' };
        let sellingPrice = basePrice / (1 - profitMargin / 100);
        sellingPrice = Math.round(sellingPrice / 1000) * 1000;
        return { basePrice, displayPrice: sellingPrice.toLocaleString('ko-KR') };
    }

    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('클립보드 복사 실패:', err);
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                return true;
            } catch (e2) {
                return false;
            }
        }
    }

    async function copyImageBlob(blob) {
        try {
            if (navigator.clipboard && window.ClipboardItem) {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                return true;
            }
            return false;
        } catch (err) {
            console.error('이미지 클립보드 복사 실패:', err);
            return false;
        }
    }

    function showCopyFeedback(button, success, label) {
        const original = button.innerHTML;
        button.innerHTML = success ? `<i class="fas fa-check"></i> ${label || '복사 완료'}` : `<i class="fas fa-xmark"></i> 실패`;
        button.disabled = true;
        setTimeout(() => {
            button.innerHTML = original;
            button.disabled = false;
        }, 1500);
    }
    
    // Global Notepad Elements
    const globalNoteTextarea = document.getElementById('globalNote');
    const saveStatusSpan = document.getElementById('saveStatus');
    const toggleNotepadBtn = document.getElementById('toggleNotepadBtn');

    // Font size controls
    const fontUp = document.getElementById('fontUp');
    const fontDown = document.getElementById('fontDown');
    let currentFontSize = 16;

    fontUp.addEventListener('click', () => {
        if (currentFontSize < 24) {
            currentFontSize++;
            document.body.style.fontSize = `${currentFontSize}px`;
        }
    });

    fontDown.addEventListener('click', () => {
        if (currentFontSize > 12) {
            currentFontSize--;
            document.body.style.fontSize = `${currentFontSize}px`;
        }
    });

    let productData = [];
    let currentResults = [];
    let lastSearchMode = 'single'; // 'single' | 'multi' — 카톡 사진은 multi만

    // Check for Web Speech API compatibility
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        voiceSearchButton.style.display = 'none'; 
    }

    // Toggle Notepad Visibility
    toggleNotepadBtn.addEventListener('click', () => {
        const isHidden = globalNoteTextarea.style.display === 'none';
        globalNoteTextarea.style.display = isHidden ? 'block' : 'none';
        toggleNotepadBtn.textContent = isHidden ? '메모 닫기' : '메모 열기';
    });

    // LocalStorage Notepad Logic
    function loadMemo() {
        const savedMemo = localStorage.getItem('atg_price_memo');
        if (savedMemo) {
            globalNoteTextarea.value = savedMemo;
        }
    }

    let saveTimeout = null;
    globalNoteTextarea.addEventListener('input', () => {
        saveStatusSpan.textContent = "저장 중...";
        saveStatusSpan.style.display = 'inline';
        saveStatusSpan.style.color = '#f08c00';
        
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            localStorage.setItem('atg_price_memo', globalNoteTextarea.value);
            saveStatusSpan.textContent = "저장됨";
            saveStatusSpan.style.color = '#22c55e';
            setTimeout(() => {
                saveStatusSpan.style.display = 'none';
            }, 1500);
        }, 500);
    });

    async function loadProductData() {
        errorMessageDiv.style.display = 'none';
        resultsList.innerHTML = `<div style="text-align: center; padding: 40px 0; color: #94a3b8; font-size: 14px;">데이터를 불러오는 중입니다...</div>`;
        try {
            const response = await fetch('csvjson.json');
            if (!response.ok) {
                throw new Error(`파일을 찾을 수 없습니다.`);
            }
            productData = await response.json();
            resultsList.innerHTML = ``;
        } catch (error) {
            console.error('데이터 로드 오류:', error);
            errorMessageDiv.innerHTML = `<strong>데이터 로드 실패</strong>`;
            errorMessageDiv.style.display = 'block';
        }
    }

    function renderResults(results) {
        resultsList.innerHTML = '';
        const profitMargin = parseFloat(discountRateInput.value) || 0;
        
        if (results.length >= 1) {
            copyAllButton.style.display = 'inline-block';
            // 카톡 값 복사: 결과 있으면 항상
            copyKakaoTextButton.style.display = 'inline-block';
            // 카톡 사진 복사: 다중 검색(정확 일치) 결과일 때만
            copyKakaoImageButton.style.display = (lastSearchMode === 'multi') ? 'inline-block' : 'none';
        } else {
            copyAllButton.style.display = 'none';
            copyKakaoTextButton.style.display = 'none';
            copyKakaoImageButton.style.display = 'none';
        }

        if (results.length > 0) {
            results.forEach(item => {
                const { basePrice, displayPrice } = calcDisplayPrice(item, profitMargin);

                const card = document.createElement('div');
                card.className = 'product-card';
                card.innerHTML = `
                    <div class="product-code">${item['품목코드'] || 'N/A'}</div>
                    <div class="product-name">${item['품목명'] || 'N/A'}</div>
                    <div class="price-row">
                        <div>
                            <div class="price-label">원가</div>
                            <div class="base-price">${basePrice.toLocaleString()}원</div>
                        </div>
                        <div style="text-align: right;">
                            <div class="price-label">견적가 (${profitMargin}%)</div>
                            <div class="final-price">${displayPrice}원</div>
                        </div>
                        <div style="margin-left: 12px;">
                            <button class="share-btn-round share-btn" data-name="${(item['품목명'] || '').replace(/"/g, '&quot;')}" data-price="${displayPrice}">
                                <i class="fas fa-share-alt"></i>
                            </button>
                        </div>
                    </div>
                `;
                resultsList.appendChild(card);
            });
        } else if (searchInput.value) {
            errorMessageDiv.textContent = '일치하는 제품을 찾을 수 없습니다.';
            errorMessageDiv.style.display = 'block';
        }
    }

    function searchProducts() {
        const term = searchInput.value.trim().toUpperCase();
        if (!term) return;

        lastSearchMode = 'single'; // 포함 검색
        const queries = term.split(/[\s,]+/).filter(q => q.length > 1);
        currentResults = productData.filter(p => {
            const code = String(p['품목코드']).toUpperCase();
            const name = String(p['품목명']).toUpperCase();
            return queries.some(q => code.includes(q) || name.includes(q));
        });

        renderResults(currentResults.slice(0, 100));
    }

    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'ko-KR';
        voiceSearchButton.addEventListener('click', () => {
            micIcon.style.display = 'none';
            voiceSearchText.style.display = 'inline';
            recognition.start();
        });
        recognition.onresult = (e) => {
            searchInput.value = e.results[0][0].transcript;
            searchProducts();
        };
        recognition.onspeechend = () => {
            micIcon.style.display = 'inline';
            voiceSearchText.style.display = 'none';
            recognition.stop();
        };
    }

    resultsList.addEventListener('click', (event) => {
        const shareBtn = event.target.closest('.share-btn');
        if (shareBtn) {
            const text = `[ATG대리점 유니테크]\n규격: ${shareBtn.dataset.name}\n견적가: ${shareBtn.dataset.price}원`;
            navigator.clipboard.writeText(text).then(() => {
                const icon = shareBtn.querySelector('i');
                icon.className = 'fas fa-check';
                setTimeout(() => icon.className = 'fas fa-share-alt', 1500);
            });
        }
    });

    searchButton.addEventListener('click', searchProducts);
    searchInput.addEventListener('keyup', (e) => e.key === 'Enter' && searchProducts());
    discountRateInput.addEventListener('input', () => renderResults(currentResults));
    // 다중 검색: 위 단일 검색창과 분리, 정확히 일치만
    function handleMultiSearch() {
        errorMessageDiv.style.display = 'none';
        const raw = multiSearchInput.value.trim();
        if (!raw) {
            currentResults = [];
            lastSearchMode = 'multi';
            renderResults([]);
            return;
        }

        lastSearchMode = 'multi'; // 정확 일치 → 카톡 사진 활성화

        // 줄바꿈·쉼표 구분, 최대 10개
        let terms = raw
            .split(/[\n,]+/)
            .map(t => t.trim())
            .filter(Boolean);

        if (terms.length > 10) {
            terms = terms.slice(0, 10);
        }

        const termsUpper = terms.map(t => t.toUpperCase());
        const matched = [];
        const seen = new Set();

        termsUpper.forEach(term => {
            productData.forEach(p => {
                const code = String(p['품목코드'] || '').toUpperCase();
                const name = String(p['품목명'] || '').toUpperCase();
                // 정확히 일치만 (품목코드 또는 품목명)
                if (code === term || name === term) {
                    const key = code || name;
                    if (!seen.has(key)) {
                        seen.add(key);
                        matched.push(p);
                    }
                }
            });
        });

        currentResults = matched;
        renderResults(matched);

        if (matched.length === 0) {
            errorMessageDiv.textContent = '일치하는 제품을 찾을 수 없습니다.';
            errorMessageDiv.style.display = 'block';
        }
    }

    multiSearchButton.addEventListener('click', handleMultiSearch);
    resetButton.addEventListener('click', () => {
        searchInput.value = '';
        multiSearchInput.value = '';
        currentResults = [];
        lastSearchMode = 'single';
        errorMessageDiv.style.display = 'none';
        renderResults([]);
    });

    copyAllButton.addEventListener('click', () => {
        const profitMargin = parseFloat(discountRateInput.value) || 0;
        let fullText = "[ATG대리점 유니테크]\n\n";

        currentResults.forEach((item, index) => {
            const { displayPrice } = calcDisplayPrice(item, profitMargin);
            fullText += `${index + 1}. ${item['품목명'] || 'N/A'}\n   견적가: ${displayPrice}원\n\n`;
        });

        navigator.clipboard.writeText(fullText.trim()).then(() => {
            showCopyFeedback(copyAllButton, true, '복사 완료');
        });
    });

    // 카톡 값 복사: 탭 구분 텍스트 + HTML 테이블(엑셀 호환) 동시 복사
    copyKakaoTextButton.addEventListener('click', async () => {
        if (currentResults.length === 0) {
            showCopyFeedback(copyKakaoTextButton, false);
            return;
        }
        const profitMargin = parseFloat(discountRateInput.value) || 0;

        const title = 'ATG대리점 유니테크';
        const plain = title + '\n' + currentResults.map(item => {
            const { displayPrice } = calcDisplayPrice(item, profitMargin);
            return `${item['품목명'] || ''}\t${displayPrice}`;
        }).join('\n');

        const htmlRows = currentResults.map(item => {
            const { displayPrice } = calcDisplayPrice(item, profitMargin);
            const name = String(item['품목명'] || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const price = String(displayPrice).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<tr><td style="padding:4px 12px;white-space:nowrap;">${name}</td><td style="padding:4px 12px;white-space:nowrap;text-align:right;">${price}</td></tr>`;
        }).join('');
        const html = `<div style="font-weight:bold;margin-bottom:6px;">${title}</div><table><tbody>${htmlRows}</tbody></table>`;

        let ok = false;
        try {
            if (navigator.clipboard && window.ClipboardItem) {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/plain': new Blob([plain], { type: 'text/plain' }),
                        'text/html': new Blob([html], { type: 'text/html' })
                    })
                ]);
                ok = true;
            } else {
                ok = await copyText(plain);
            }
        } catch (err) {
            console.error('카톡 값 복사 실패:', err);
            ok = await copyText(plain);
        }
        showCopyFeedback(copyKakaoTextButton, ok, '복사됨!');
    });

    // 카톡 사진 복사: 검색 결과를 표 이미지로 그려서 클립보드에 복사
    copyKakaoImageButton.addEventListener('click', () => {
        if (currentResults.length === 0) {
            showCopyFeedback(copyKakaoImageButton, false);
            return;
        }
        const profitMargin = parseFloat(discountRateInput.value) || 0;
        const rows = currentResults.map((item, i) => {
            const { displayPrice } = calcDisplayPrice(item, profitMargin);
            return { no: String(i + 1), name: item['품목명'] || '', price: String(displayPrice) };
        });

        const padding = 20;
        const titleHeight = 40;
        const rowHeight = 42;
        const headerHeight = 46;
        const colNoWidth = 60;
        const colPriceWidth = 150;
        const FIXED_ROWS = 10;
        const bodyRows = Math.max(FIXED_ROWS, rows.length);
        const titleText = 'ATG대리점 유니테크';

        const measureCanvas = document.createElement('canvas');
        const measureCtx = measureCanvas.getContext('2d');
        measureCtx.font = '16px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
        let maxNameTextWidth = measureCtx.measureText('품목명').width;
        rows.forEach(row => {
            const w = measureCtx.measureText(row.name).width;
            if (w > maxNameTextWidth) maxNameTextWidth = w;
        });
        const colNameWidth = Math.min(420, Math.max(200, Math.ceil(maxNameTextWidth) + 24));

        const tableWidth = colNoWidth + colNameWidth + colPriceWidth;
        const tableHeight = headerHeight + bodyRows * rowHeight;
        const canvasWidth = tableWidth + padding * 2;
        const canvasHeight = titleHeight + tableHeight + padding * 2;

        const canvas = document.createElement('canvas');
        const scale = 3;
        canvas.width = canvasWidth * scale;
        canvas.height = canvasHeight * scale;
        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // 상단 타이틀
        ctx.fillStyle = '#1e3a5f';
        ctx.font = 'bold 20px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(titleText, padding, padding + titleHeight / 2);

        const startX = padding;
        const startY = padding + titleHeight;

        ctx.fillStyle = '#2563eb';
        ctx.fillRect(startX, startY, tableWidth, headerHeight);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('No.', startX + colNoWidth / 2, startY + headerHeight / 2);
        ctx.fillText('품목명', startX + colNoWidth + colNameWidth / 2, startY + headerHeight / 2);
        ctx.fillText('견적가', startX + colNoWidth + colNameWidth + colPriceWidth / 2, startY + headerHeight / 2);

        ctx.font = '16px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
        for (let i = 0; i < bodyRows; i++) {
            const y = startY + headerHeight + i * rowHeight;
            ctx.fillStyle = (i % 2 === 1) ? '#f0f5ff' : '#ffffff';
            ctx.fillRect(startX, y, tableWidth, rowHeight);

            const row = rows[i];
            if (row) {
                ctx.fillStyle = '#333333';
                ctx.textAlign = 'center';
                ctx.fillText(row.no, startX + colNoWidth / 2, y + rowHeight / 2);

                ctx.textAlign = 'left';
                ctx.fillText(row.name, startX + colNoWidth + 12, y + rowHeight / 2);

                ctx.textAlign = 'right';
                ctx.fillText(row.price + '원', startX + colNoWidth + colNameWidth + colPriceWidth - 10, y + rowHeight / 2);
            }
        }

        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        for (let i = 0; i <= bodyRows + 1; i++) {
            const y = startY + (i === 0 ? 0 : headerHeight + (i - 1) * rowHeight);
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(startX + tableWidth, y);
            ctx.stroke();
        }
        [0, colNoWidth, colNoWidth + colNameWidth, tableWidth].forEach(cx => {
            ctx.beginPath();
            ctx.moveTo(startX + cx, startY);
            ctx.lineTo(startX + cx, startY + tableHeight);
            ctx.stroke();
        });

        canvas.toBlob(async (blob) => {
            if (!blob) {
                showCopyFeedback(copyKakaoImageButton, false);
                return;
            }
            const ok = await copyImageBlob(blob);
            if (ok) {
                showCopyFeedback(copyKakaoImageButton, true, '복사됨!');
            } else {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = '견적표.png';
                a.click();
                URL.revokeObjectURL(url);
                showCopyFeedback(copyKakaoImageButton, true, '다운로드됨');
            }
        }, 'image/png');
    });

    loadMemo();
    loadProductData();
});
