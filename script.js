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
            resultsList.innerHTML = `<div style="text-align: center; padding: 40px 0; color: #94a3b8; font-style: italic; font-size: 14px;">품목명 또는 코드를 입력하여 검색을 시작하세요.</div>`;
        } catch (error) {
            console.error('데이터 로드 오류:', error);
            errorMessageDiv.innerHTML = `<strong>데이터 로드 실패</strong>`;
            errorMessageDiv.style.display = 'block';
        }
    }

    function renderResults(results) {
        resultsList.innerHTML = '';
        const profitMargin = parseFloat(discountRateInput.value) || 0;
        
        if (results.length > 1) {
            copyAllButton.style.display = 'inline-block';
        } else {
            copyAllButton.style.display = 'none';
        }

        if (results.length > 0) {
            results.forEach(item => {
                const basePriceStr = item['가격'] || '0';
                const basePrice = parseFloat(basePriceStr.replace(/,/g, ''));
                let displayPrice = 'N/A';
                
                if (!isNaN(basePrice)) {
                    let sellingPrice = basePrice / (1 - profitMargin / 100);
                    sellingPrice = Math.round(sellingPrice / 1000) * 1000;
                    displayPrice = sellingPrice.toLocaleString('ko-KR');
                }

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
            const text = `[유니테크 견적]\n규격: ${shareBtn.dataset.name}\n견적가: ${shareBtn.dataset.price}원`;
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
    multiSearchButton.addEventListener('click', () => {
        searchInput.value = multiSearchInput.value.trim();
        searchProducts();
    });
    resetButton.addEventListener('click', () => {
        searchInput.value = '';
        multiSearchInput.value = '';
        currentResults = [];
        renderResults([]);
    });

    loadMemo();
    loadProductData();
});
