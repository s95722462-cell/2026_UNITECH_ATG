    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const voiceSearchButton = document.getElementById('voiceSearchButton');
    const micIcon = document.getElementById('micIcon');
    const voiceSearchText = document.getElementById('voiceSearchText');
    const resultsTableBody = document.getElementById('resultsTableBody');
    const errorMessageDiv = document.getElementById('errorMessage');
    const discountRateInput = document.getElementById('discountRate');
    const multiSearchInput = document.getElementById('multiSearchInput');
    const multiSearchButton = document.getElementById('multiSearchButton');
    const resetButton = document.getElementById('resetButton');
    const copyAllButton = document.getElementById('copyAllButton');
    let productData = [];
    let currentResults = [];

    // Check for Web Speech API compatibility
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
    const SpeechRecognitionEvent = window.SpeechRecognitionEvent || window.webkitSpeechRecognitionEvent;

    if (!SpeechRecognition) {
        voiceSearchButton.style.display = 'none'; // Hide button if not supported
        console.warn('Web Speech API is not supported in this browser.');
    }

    async function loadProductData() {
        errorMessageDiv.style.display = 'none';
        try {
            const response = await fetch('csvjson.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            productData = await response.json();
            console.log('제품 데이터 로드 완료.', productData.length, '개 항목');
            resultsTableBody.innerHTML = `<tr><td colspan="5" class="text-center placeholder-message">검색어를 입력하고 검색 버튼을 누르세요.</td></tr>`;
        } catch (error) {
            console.error('제품 데이터를 불러오는 중 오류 발생:', error);
            errorMessageDiv.textContent = '데이터를 불러오는 데 실패했습니다. (Failed to fetch)';
            errorMessageDiv.style.display = 'block';
        }
    }

    function renderResults(results) {
        resultsTableBody.innerHTML = '';
        errorMessageDiv.style.display = 'none';
        
        // 결과가 2개 이상일 때만 전체 복사 버튼 표시
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
                            // Round to the nearest 1000 (사사오입)
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
                
                const row = resultsTableBody.insertRow();
                row.dataset.code = item['품목코드'];
                row.classList.add('clickable-row');

                const isSamePrice = (formattedBasePrice === calculatedDisplayPrice);
                // 따옴표 문제 방지를 위해 속성값을 이스케이프 처리하거나 안전하게 처리
                const safeItemName = (item['품목명'] || 'N/A').replace(/"/g, '&quot;');
                
                // 가격과 견적가가 동일하면 공유 버튼을 숨김
                const shareButton = isSamePrice ? '' : `<button class="btn btn-sm btn-outline-secondary share-btn" data-name="${safeItemName}" data-price="${calculatedDisplayPrice}">공유</button>`;

                row.innerHTML = `
                    <td data-label="품목코드">${item['품목코드'] || 'N/A'}</td>
                    <td data-label="규격">${item['품목명'] || 'N/A'}</td>
                    <td data-label="가격">${formattedBasePrice}</td>
                    <td data-label="견적가">${calculatedDisplayPrice}</td>
                    <td data-label="공유">${shareButton}</td>
                `;
            });
        } else {
             if (searchInput.value) {
                errorMessageDiv.textContent = '해당 검색어와 일치하는 제품을 찾을 수 없습니다.';
                errorMessageDiv.style.display = 'block';
            }
        }
    }

    function searchProducts() {
        const searchTerm = searchInput.value.trim();
        if (!searchTerm) {
            errorMessageDiv.textContent = '검색어를 입력해주세요.';
            errorMessageDiv.style.display = 'block';
            currentResults = [];
            renderResults(currentResults);
            return;
        }

        // 공백이나 쉼표로 검색어 분리 (2글자 이상 권장되나 유연하게 처리)
        const queries = searchTerm.split(/[\s,]+/).filter(q => q.length > 0);
        
        if (queries.length === 0) {
            currentResults = [];
            renderResults(currentResults);
            return;
        }

        currentResults = productData.filter(item => {
            const itemCode = item['품목코드'] ? String(item['품목코드']).toUpperCase().replace(/[-\s]/g, "") : '';
            const itemName = item['품목명'] ? String(item['품목명']).toUpperCase().replace(/[-\s]/g, "") : '';
            
            return queries.some(q => {
                const cleanQ = q.toUpperCase().replace(/[-\s]/g, "");
                if (!cleanQ) return false;
                return itemCode.includes(cleanQ) || itemName.includes(cleanQ);
            });
        });

        // 결과 상위 100개로 제한 (성능 최적화)
        currentResults = currentResults.slice(0, 100);

        if (currentResults.length === 0) {
            errorMessageDiv.textContent = '해당 검색어와 일치하는 제품을 찾을 수 없습니다.';
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
        recognition.maxAlternatives = 1;

        voiceSearchButton.addEventListener('click', () => {
            errorMessageDiv.style.display = 'none';
            searchInput.value = '';
            voiceSearchButton.disabled = true;
            micIcon.style.display = 'none';
            voiceSearchText.style.display = 'inline';
            voiceSearchText.textContent = '말씀해주세요...';
            recognition.stop();
            recognition.start();
        });

        recognition.onresult = (event) => {
            const speechResult = event.results[0][0].transcript;
            // 음성 검색 결과도 동일하게 검색 처리
            searchInput.value = speechResult;
            searchProducts();
        };

        recognition.onspeechend = () => {
            voiceSearchButton.disabled = false;
            micIcon.style.display = 'inline';
            voiceSearchText.style.display = 'none';
            voiceSearchText.textContent = '';
            recognition.stop();
        };

        recognition.onerror = (event) => {
            voiceSearchButton.disabled = false;
            micIcon.style.display = 'inline';
            voiceSearchText.style.display = 'none';
            voiceSearchText.textContent = '';
            errorMessageDiv.textContent = `음성 인식 오류: ${event.error}`;
            errorMessageDiv.style.display = 'block';
            console.error('Speech recognition error:', event.error);
            recognition.stop();
        };
    }

    // Event listener delegation for row clicks and share button clicks
    resultsTableBody.addEventListener('click', (event) => {
        const shareButton = event.target.closest('.share-btn');
        const row = event.target.closest('tr.clickable-row');

        if (shareButton) {
            event.stopPropagation(); // Prevent row click event when share button is clicked
            const name = shareButton.dataset.name;
            const price = shareButton.dataset.price;
            const textToCopy = `[ATG 대리점 유니테크]\n규격: ${name}\n견적가: ${price}원`;

            navigator.clipboard.writeText(textToCopy).then(() => {
                const originalText = shareButton.textContent;
                shareButton.textContent = '복사됨!';
                shareButton.disabled = true;
                setTimeout(() => {
                    shareButton.textContent = originalText;
                    shareButton.disabled = false;
                }, 1500);
            }).catch(err => {
                console.error('클립보드 복사 실패:', err);
                alert('클립보드 복사에 실패했습니다.');
            });

        } else if (row && row.dataset.code) {
            const productCode = row.dataset.code;
            const selectedProduct = productData.find(item => item['품목코드'] === productCode);
            if (selectedProduct) {
                renderResults([selectedProduct]);
            }
        }
    });

    searchButton.addEventListener('click', searchProducts);
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            searchProducts();
        }
    });

    discountRateInput.addEventListener('input', () => {
        renderResults(currentResults);
    });

    // 다중 검색 기능 (기존 textarea 방식도 개선된 로직 적용)
    function multiSearchProducts() {
        const input = multiSearchInput.value.trim();
        if (!input) {
            errorMessageDiv.textContent = '규격을 입력해주세요.';
            errorMessageDiv.style.display = 'block';
            return;
        }

        // 입력받은 모든 텍스트를 메인 검색창에 넣고 실행하는 것과 동일하게 처리
        searchInput.value = input;
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
            copyAllButton.textContent = '전체 복사됨!';
            copyAllButton.classList.replace('btn-success', 'btn-outline-success');
            setTimeout(() => {
                copyAllButton.innerHTML = originalText;
                copyAllButton.classList.replace('btn-outline-success', 'btn-success');
            }, 1500);
        }).catch(err => {
            console.error('전체 복사 실패:', err);
            alert('전체 복사에 실패했습니다.');
        });
    });

    resetButton.addEventListener('click', () => {
        multiSearchInput.value = '';
        searchInput.value = '';
        currentResults = [];
        renderResults(currentResults);
        errorMessageDiv.style.display = 'none';
        resultsTableBody.innerHTML = `<tr><td colspan="5" class="text-center placeholder-message">검색어를 입력하고 검색 버튼을 누르세요.</td></tr>`;
    });

    loadProductData();