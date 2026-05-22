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

    async function loadProductData() {
        errorMessageDiv.style.display = 'none';
        resultsList.innerHTML = `<div style="text-align: center; padding: 40px 0; color: #94a3b8; font-size: 14px;">데이터를 불러오는 중입니다... (csvjson.json)</div>`;
        try {
            const response = await fetch('csvjson.json');
            if (!response.ok) {
                throw new Error(`파일을 찾을 수 없습니다. (HTTP 상태 코드: ${response.status})`);
            }
            productData = await response.json();
            
            if (!Array.isArray(productData) || productData.length === 0) {
                throw new Error('데이터 형식이 잘못되었거나 데이터가 비어 있습니다.');
            }

            resultsList.innerHTML = `<div style="text-align: center; padding: 40px 0; color: #94a3b8; font-style: italic; font-size: 14px;">품목명 또는 코드를 입력하여 검색을 시작하세요.<br>(${productData.length.toLocaleString()}개 항목 로드됨)</div>`;
        } catch (error) {
            console.error('제품 데이터를 불러오는 중 오류 발생:', error);
            errorMessageDiv.innerHTML = `<strong>데이터 로드 실패:</strong><br>${error.message}`;
            errorMessageDiv.style.display = 'block';
            resultsList.innerHTML = `<div style="text-align: center; padding: 40px 0; color: #ef4444; font-weight: 700;">데이터 로딩 에러 발생</div>`;
        }
    }

    function renderResults(results) {
        resultsList.innerHTML = '';
        errorMessageDiv.style.display = 'none';
        
        if (results.length > 1) {
            copyAllButton.style.display = 'inline-block';
        } else {
            copyAllButton.style.display = 'none';
        }

        const profitMargin = parseFloat(discountRateInput.value) || 0;

        if (results.length > 0) {
            results.forEach(item => {
                const basePriceStr = item['가격'] || '0';
                const basePrice = parseFloat(basePriceStr.replace(/,/g, ''));
                let calculatedDisplayPrice = 'N/A';
                let formattedBasePrice = 'N/A';

                if (!isNaN(basePrice)) {
                    formattedBasePrice = basePrice.toLocaleString('ko-KR');
                    if (profitMargin > 0) {
                        const divisor = (1 - profitMargin / 100);
                        if (divisor > 0) {
                            let sellingPrice = basePrice / divisor;
                            sellingPrice = Math.round(sellingPrice / 1000) * 1000;
                            calculatedDisplayPrice = sellingPrice.toLocaleString('ko-KR');
                        } else {
                            calculatedDisplayPrice = '이익률 초과';
                        }
                    } else if (profitMargin === 0) {
                        calculatedDisplayPrice = formattedBasePrice;
                    } else {
                        calculatedDisplayPrice = '유효하지 않은 이익률';
                    }
                }
                
                const isSamePrice = (formattedBasePrice === calculatedDisplayPrice);
                const safeItemName = (item['품목명'] || 'N/A').replace(/"/g, '&quot;');
                
                const card = document.createElement('div');
                card.className = 'product-card';
                card.dataset.code = item['품목코드'];
                
                const shareButtonHtml = isSamePrice ? '' : `
                    <button class="share-btn-round share-btn" data-name="${safeItemName}" data-price="${calculatedDisplayPrice}">
                        <i class="fas fa-share-alt"></i>
                    </button>`;

                card.innerHTML = `
                    <div class="product-code">${item['품목코드'] || 'N/A'}</div>
                    <div class="product-name">${item['품목명'] || 'N/A'}</div>
                    <div class="price-row">
                        <div>
                            <div class="price-label">원가</div>
                            <div class="base-price">${formattedBasePrice}원</div>
                        </div>
                        <div style="text-align: right;">
                            <div class="price-label">견적가 (${profitMargin}%)</div>
                            <div class="final-price">${calculatedDisplayPrice}원</div>
                        </div>
                        <div style="margin-left: 12px;">
                            ${shareButtonHtml}
                        </div>
                    </div>
                `;
                resultsList.appendChild(card);
            });
        } else {
             if (searchInput.value) {
                errorMessageDiv.textContent = '일치하는 제품을 찾을 수 없습니다.';
                errorMessageDiv.style.display = 'block';
            }
        }
    }

    function searchProducts() {
        const rawSearchTerm = searchInput.value.trim();
        if (!rawSearchTerm) {
            errorMessageDiv.textContent = '검색어를 입력해주세요.';
            errorMessageDiv.style.display = 'block';
            currentResults = [];
            renderResults(currentResults);
            return;
        }

        const groups = rawSearchTerm.split(',').map(g => g.trim()).filter(g => g.length > 0);
        
        currentResults = productData.filter(item => {
            const code = item['품목코드'] ? String(item['품목코드']).toUpperCase() : '';
            const name = item['품목명'] ? String(item['품목명']).toUpperCase() : '';
            const cleanCode = code.replace(/[-\s]/g, "");
            const cleanName = name.replace(/[-\s]/g, "");

            return groups.some(group => {
                const words = group.split(/\s+/).filter(w => w.length > 0);
                if (words.length === 0) return false;

                return words.every(word => {
                    const w = word.toUpperCase();
                    const cleanW = w.replace(/[-\s]/g, "");
                    if (!cleanW) return false;

                    return code.includes(w) || name.includes(w) || 
                           cleanCode.includes(cleanW) || cleanName.includes(cleanW);
                });
            });
        });

        currentResults = currentResults.slice(0, 100);

        if (currentResults.length === 0) {
            errorMessageDiv.textContent = '일치하는 제품을 찾을 수 없습니다.';
            errorMessageDiv.style.display = 'block';
        } else {
            errorMessageDiv.style.display = 'none';
        }

        renderResults(currentResults);
    }

    // Voice search functionality
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'ko-KR';
        recognition.interimResults = false;

        voiceSearchButton.addEventListener('click', () => {
            errorMessageDiv.style.display = 'none';
            searchInput.value = '';
            voiceSearchButton.disabled = true;
            micIcon.style.display = 'none';
            voiceSearchText.style.display = 'inline';
            recognition.start();
        });

        recognition.onresult = (event) => {
            searchInput.value = event.results[0][0].transcript;
            searchProducts();
        };

        recognition.onspeechend = () => {
            voiceSearchButton.disabled = false;
            micIcon.style.display = 'inline';
            voiceSearchText.style.display = 'none';
            recognition.stop();
        };

        recognition.onerror = (event) => {
            voiceSearchButton.disabled = false;
            micIcon.style.display = 'inline';
            voiceSearchText.style.display = 'none';
            errorMessageDiv.textContent = `음성 인식 오류: ${event.error}`;
            errorMessageDiv.style.display = 'block';
            recognition.stop();
        };
    }

    resultsList.addEventListener('click', (event) => {
        const shareButton = event.target.closest('.share-btn');
        const card = event.target.closest('.product-card');

        if (shareButton) {
            event.stopPropagation();
            const name = shareButton.dataset.name;
            const price = shareButton.dataset.price;
            const textToCopy = `[ATG 대리점 유니테크]\n규격: ${name}\n견적가: ${price}원`;

            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalContent = shareButton.innerHTML;
                shareButton.innerHTML = '<i class="fas fa-check" style="color: #22c55e;"></i>';
                setTimeout(() => {
                    shareButton.innerHTML = originalContent;
                }, 1500);
            });

        } else if (card && card.dataset.code) {
            const productCode = card.dataset.code;
            const selectedProduct = productData.find(item => item['품목코드'] === productCode);
            if (selectedProduct) {
                renderResults([selectedProduct]);
            }
        }
    });

    searchButton.addEventListener('click', searchProducts);
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') searchProducts();
    });

    discountRateInput.addEventListener('input', () => {
        renderResults(currentResults);
    });

    function multiSearchProducts() {
        searchInput.value = multiSearchInput.value.trim();
        searchProducts();
    }

    multiSearchButton.addEventListener('click', multiSearchProducts);

    copyAllButton.addEventListener('click', () => {
        if (currentResults.length === 0) return;

        const profitMargin = parseFloat(discountRateInput.value) || 0;
        let textToCopy = `[ATG 대리점 유니테크]\n`;

        currentResults.forEach((item, index) => {
            const basePriceStr = item['가격'] || '0';
            const basePrice = parseFloat(basePriceStr.replace(/,/g, ''));
            let calculatedDisplayPrice = 'N/A';

            if (!isNaN(basePrice)) {
                if (profitMargin > 0) {
                    const divisor = (1 - profitMargin / 100);
                    if (divisor > 0) {
                        let sellingPrice = basePrice / divisor;
                        sellingPrice = Math.round(sellingPrice / 1000) * 1000;
                        calculatedDisplayPrice = sellingPrice.toLocaleString('ko-KR');
                    } else {
                        calculatedDisplayPrice = '이익률 초과';
                    }
                } else {
                    calculatedDisplayPrice = basePrice.toLocaleString('ko-KR');
                }
            }
            textToCopy += `\n${index + 1}. 규격: ${item['품목명']}\n   견적가: ${calculatedDisplayPrice}원`;
        });

        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalText = copyAllButton.innerHTML;
            copyAllButton.textContent = '복사 완료!';
            setTimeout(() => {
                copyAllButton.innerHTML = originalText;
            }, 1500);
        });
    });

    resetButton.addEventListener('click', () => {
        multiSearchInput.value = '';
        searchInput.value = '';
        currentResults = [];
        renderResults(currentResults);
        errorMessageDiv.style.display = 'none';
        resultsList.innerHTML = `<div style="text-align: center; padding: 40px 0; color: #94a3b8; font-style: italic; font-size: 14px;">품목명 또는 코드를 입력하여 검색을 시작하세요.</div>`;
    });

    loadProductData();
