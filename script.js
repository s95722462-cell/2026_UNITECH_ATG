    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const voiceSearchButton = document.getElementById('voiceSearchButton');
    const micIcon = document.getElementById('micIcon');
    const voiceSearchText = document.getElementById('voiceSearchText');
    const resultsTableBody = document.getElementById('resultsTableBody');
    const errorMessageDiv = document.getElementById('errorMessage');
    const discountRateInput = document.getElementById('discountRate');
    let productData = [];
    let currentResults = [];

    // Multi-search elements
    const multiSearchInput = document.getElementById('multiSearchInput');
    const multiSearchButton = document.getElementById('multiSearchButton');
    const multiResultsContainer = document.getElementById('multiResultsContainer');
    const multiResultsBuffer = document.getElementById('multiResultsBuffer');
    const multiShareButton = document.getElementById('multiShareButton');
    const clearSearchButton = document.getElementById('clearSearchButton');
    const clearMultiSearchButton = document.getElementById('clearMultiSearchButton');


    // Check for Web Speech API compatibility
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
    const SpeechRecognitionEvent = window.SpeechRecognitionEvent || window.webkitSpeechRecognitionEvent;

    if (!SpeechRecognition) {
        voiceSearchButton.style.display = 'none'; // Hide button if not supported
        console.warn('Web Speech API is not supported in this browser.');
    }
    const multiResultsTableBody = document.getElementById('multiResultsTableBody');

    clearMultiSearchButton.addEventListener('click', () => {
        multiSearchInput.value = '';
        multiResultsBuffer.value = ''; // Also clear the results buffer
        multiResultsTableBody.innerHTML = ''; // Clear the results table
        multiResultsContainer.style.display = 'none'; // Hide results container
        multiShareButton.disabled = true; // Disable share button
    });

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

        const profitMargin = parseFloat(discountRateInput.value) || 0;

        if (results.length > 0) {
            results.forEach(item => {
                const basePriceStr = item['가격'] || '0';
                const basePrice = parseFloat(basePriceStr.replace(/,/g, ''));
                let calculatedDisplayPrice = 'N/A';
                let formattedBasePrice = 'N/A';
                let isMarginTooLow = false;

                if (!isNaN(basePrice)) {
                    formattedBasePrice = basePrice.toLocaleString('ko-KR');
                    if (profitMargin > 0) {
                        const divisor = (1 - profitMargin / 100);
                        if (divisor > 0) {
                            const sellingPriceUnrounded = basePrice / divisor;
                            isMarginTooLow = (sellingPriceUnrounded - basePrice) < (basePrice * 0.05);
                            
                            const sellingPrice = Math.round(sellingPriceUnrounded / 1000) * 1000;
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
                const shareButtonDisabled = isSamePrice || isMarginTooLow;
                const shareButtonText = isMarginTooLow ? '마진 낮음' : (isSamePrice ? '동일 가격' : '공유');

                const shareButton = `<button class="btn btn-sm btn-outline-secondary share-btn${shareButtonDisabled ? ' disabled' : ''}" ${shareButtonDisabled ? 'disabled' : ''} data-name="${item['품목명']}" data-price="${calculatedDisplayPrice}">${shareButtonText}</button>`;

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
        const searchTerm = searchInput.value.trim().toLowerCase();
        if (!searchTerm) {
            errorMessageDiv.textContent = '검색어를 입력해주세요.';
            errorMessageDiv.style.display = 'block';
            currentResults = [];
            renderResults(currentResults);
            return;
        }

        currentResults = productData.filter(item => {
            const itemCode = item['품목코드'] ? String(item['품목코드']).toLowerCase() : '';
            const itemName = item['품목명'] ? String(item['품목명']).toLowerCase() : '';
            return itemCode.includes(searchTerm) || itemName.includes(searchTerm);
        });

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
            const processedSpeechResult = speechResult.replace(/[-\s]/g, '');
            searchInput.value = processedSpeechResult;
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
            
            const profitMargin = parseFloat(discountRateInput.value) || 0;
            if (profitMargin <= 0) {
                alert('이익률을 입력하세요.');
                return;
            }

            const name = shareButton.dataset.name;
            const price = shareButton.dataset.price;
            const textToCopy = `규격: ${name}\n견적가: ${price}원\n\nATG대리점 유니테크`;

            copyToClipboard(textToCopy, shareButton);

        } else if (row && row.dataset.code) {
            const productCode = row.dataset.code;
            searchInput.value = productCode; // Set the search input value
            searchProducts(); // Perform a new search with the product code
        }
    });

    function searchMultipleProducts() {
        multiSearchButton.disabled = true;
        multiSearchButton.textContent = '처리 중...';
    
        setTimeout(() => {
            const inputText = multiSearchInput.value.trim();
            if (!inputText) {
                multiResultsBuffer.value = '입력창에 규격을 입력해주세요.';
                multiResultsTableBody.innerHTML = '';
                multiResultsContainer.style.display = 'block';
                multiShareButton.disabled = true;
                multiSearchButton.disabled = false;
                multiSearchButton.textContent = '다중 검색 실행';
                return;
            }
    
            const specs = inputText.split(',').map(s => s.trim()).filter(s => s);
            if (specs.length > 10) {
                multiResultsBuffer.value = '오류: 최대 10개까지만 입력할 수 있습니다.';
                multiResultsTableBody.innerHTML = '';
                multiResultsContainer.style.display = 'block';
                multiShareButton.disabled = true;
                multiSearchButton.disabled = false;
                multiSearchButton.textContent = '다중 검색 실행';
                return;
            }
    
            const profitMargin = parseFloat(discountRateInput.value) || 0;
            let foundCount = 0;
            let isAnyMarginTooLow = false;
            const multiResultsData = [];
    
            specs.forEach(spec => {
                const searchTerm = spec.toLowerCase();
                const foundItem = productData.find(item => {
                    const itemCode = item['품목코드'] ? String(item['품목코드']).toLowerCase() : '';
                    const itemName = item['품목명'] ? String(item['품목명']).toLowerCase() : '';
                    return itemCode === searchTerm || itemName === searchTerm;
                });
    
                const resultEntry = {
                    spec: spec.toUpperCase(), // Convert spec to uppercase for display
                    item: foundItem,
                    formattedBasePrice: 'N/A',
                    calculatedDisplayPrice: 'N/A',
                    isMarginTooLow: false,
                    suggestions: ''
                };
    
                if (foundItem) {
                    foundCount++;
                    const basePriceStr = foundItem['가격'] || '0';
                    const basePrice = parseFloat(basePriceStr.replace(/,/g, ''));
    
                    if (!isNaN(basePrice)) {
                        resultEntry.formattedBasePrice = basePrice.toLocaleString('ko-KR');
                        if (profitMargin > 0) {
                            const divisor = (1 - profitMargin / 100);
                            if (divisor > 0) {
                                const sellingPriceUnrounded = basePrice / divisor;
                                if ((sellingPriceUnrounded - basePrice) < (basePrice * 0.05)) {
                                    resultEntry.isMarginTooLow = true;
                                    isAnyMarginTooLow = true;
                                }
                                const sellingPrice = Math.round(sellingPriceUnrounded / 1000) * 1000;
                                resultEntry.calculatedDisplayPrice = sellingPrice.toLocaleString('ko-KR');
                            } else {
                                resultEntry.calculatedDisplayPrice = '이익률 초과';
                            }
                        } else {
                            resultEntry.calculatedDisplayPrice = resultEntry.formattedBasePrice;
                        }
                    }
                } else {
                    // Suggest similar items for not found items
                    const similarItems = productData.filter(item => {
                        const itemCode = item['품목코드'] ? String(item['품목코드']).toLowerCase() : '';
                        const itemName = item['품목명'] ? String(item['품목명']).toLowerCase() : '';
                        return itemCode.includes(searchTerm) || itemName.includes(searchTerm);
                    }).slice(0, 2);
    
                    if (similarItems.length > 0) {
                        resultEntry.suggestions = similarItems.map(item => item['품목명'] || item['품목코드']).join(', ');
                    }
                }
                multiResultsData.push(resultEntry);
            });
    
            renderMultiResults(multiResultsData, profitMargin);
    
            multiResultsContainer.style.display = 'block';
            multiShareButton.disabled = !(specs.length > 0 && profitMargin > 0);
            
            multiSearchButton.disabled = false;
            multiSearchButton.textContent = '다중 검색 실행';
        }, 0);
    }

    multiShareButton.addEventListener('click', () => {
        if (!multiResultsBuffer.value) return;

        const profitMargin = parseFloat(discountRateInput.value) || 0;
        if (profitMargin <= 0) {
            alert('이익률을 입력하세요.');
            return;
        }

        const textToCopy = multiResultsBuffer.value + '\n\nATG대리점 유니테크';
        copyToClipboard(textToCopy, multiShareButton);
    });


    searchButton.addEventListener('click', searchProducts);
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            searchProducts();
        }
    });

    discountRateInput.addEventListener('input', () => {
        // Save the new value to localStorage
        localStorage.setItem('savedDiscountRate', discountRateInput.value);

        renderResults(currentResults);
        // If the multi-search buffer is visible, re-run the multi-search to update prices
        if (multiResultsContainer.style.display === 'block') {
            searchMultipleProducts();
        }
    });

    multiSearchButton.addEventListener('click', searchMultipleProducts);

    // Event listeners for the clear search button
    searchInput.addEventListener('input', () => {
        if (searchInput.value) {
            clearSearchButton.style.display = 'block';
        } else {
            clearSearchButton.style.display = 'none';
        }
    });

    clearSearchButton.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchButton.style.display = 'none';
        currentResults = [];
        renderResults([]); // Clear the table
        resultsTableBody.innerHTML = `<tr><td colspan="5" class="text-center placeholder-message">검색어를 입력하고 검색 버튼을 누르세요.</td></tr>`;
    });

    function initialize() {
        // Load the saved discount rate from localStorage
        const savedRate = localStorage.getItem('savedDiscountRate');
        if (savedRate) {
            discountRateInput.value = savedRate;
        }
        // Load product data
        loadProductData();
    }

    initialize();

    function renderMultiResults(resultsData, profitMargin) {
        multiResultsTableBody.innerHTML = '';
        let resultStringForBuffer = '';
    
        resultsData.forEach((result, index) => {
            const row = multiResultsTableBody.insertRow();
            let rowHtml = '';
            let bufferText = `${index + 1}. 규격: ${result.spec}\n`;
    
            if (result.item) {
                rowHtml = `
                    <td data-label="품목코드">${result.item['품목코드'] || 'N/A'}</td>
                    <td data-label="규격">${result.item['품목명'] || 'N/A'}</td>
                    <td data-label="가격">${result.formattedBasePrice}</td>
                    <td data-label="견적가">${result.calculatedDisplayPrice}${result.isMarginTooLow ? ' (마진 낮음)' : ''}</td>
                `;
                bufferText += `   견적가: ${result.calculatedDisplayPrice}원${result.isMarginTooLow ? ' (마진 낮음)' : ''}\n\n`;
            } else {
                let notFoundMessage = '오타가 있거나 없는 제품입니다.';
                if (result.suggestions) {
                    notFoundMessage += `<br><small>혹시: ${result.suggestions}?</small>`;
                }
                rowHtml = `
                    <td data-label="품목코드">${result.spec}</td>
                    <td data-label="규격" colspan="3">${notFoundMessage}</td>
                `;
                row.classList.add('table-danger'); // Highlight not found rows
    
                bufferText += `   견적가: 오타가 있거나 없는 제품입니다.\n`;
                if (result.suggestions) {
                    bufferText += `   혹시 다음을 찾으셨나요?: ${result.suggestions}\n\n`;
                } else {
                    bufferText += `\n`;
                }
            }
            row.innerHTML = rowHtml;
            resultStringForBuffer += bufferText;
        });
    
        multiResultsBuffer.value = resultStringForBuffer.trim();
    }

    function copyToClipboard(text, buttonElement) {
        const showSuccess = (btn) => {
            const originalText = btn.textContent;
            const originalDisabled = btn.disabled;
            btn.textContent = '복사됨!';
            btn.disabled = true;
            setTimeout(() => {
                btn.textContent = originalText;
                btn.disabled = originalDisabled;
            }, 1500);
        };
    
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                showSuccess(buttonElement);
            }).catch(err => {
                console.error('Async clipboard copy failed, falling back:', err);
                fallbackCopyTextToClipboard(text, buttonElement, showSuccess);
            });
        } else {
            console.warn('Async clipboard not available, falling back.');
            fallbackCopyTextToClipboard(text, buttonElement, showSuccess);
        }
    }
    
    function fallbackCopyTextToClipboard(text, buttonElement, successCallback) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // Avoid scrolling to bottom
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
    
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
    
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                successCallback(buttonElement);
            } else {
                console.error('Fallback copy command failed');
                alert('클립보드 복사에 실패했습니다.');
            }
        } catch (err) {
            console.error('Fallback copy exception:', err);
            alert('클립보드 복사에 실패했습니다.');
        }
    
        document.body.removeChild(textArea);
    }