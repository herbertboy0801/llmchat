document.addEventListener('DOMContentLoaded', () => {
    // 配置 marked.js
    marked.setOptions({
        breaks: true, // 将回车符渲染为 <br>
        gfm: true, // 启用 GitHub Flavored Markdown
        highlight: function(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        }
    });
    // 获取DOM元素
    const chatOutput = document.getElementById('chat-output');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    // 设置面板相关元素
    const settingsToggleButton = document.getElementById('settings-toggle-button');
    const settingsPanel = document.getElementById('settings-panel');
    const closeSettingsButton = document.getElementById('close-settings-button');
    const configProfileSelect = document.getElementById('config-profile-select');
    const loadProfileButton = document.getElementById('load-profile-button');
    const saveProfileButton = document.getElementById('save-profile-button');
    const newProfileButton = document.getElementById('new-profile-button');
    const deleteProfileButton = document.getElementById('delete-profile-button');
    const downloadTemplateButton = document.getElementById('download-template-button');
    const uploadConfigInput = document.getElementById('upload-config-input');
    const uploadConfigButton = document.getElementById('upload-config-button');
    const profileNameInput = document.getElementById('profile-name-input');
    const apiProviderInput = document.getElementById('api-provider-input');
    const apiBaseUrlInput = document.getElementById('api-base-url-input');
    const apiKeyInput = document.getElementById('api-key-input');
    const apiModelInput = document.getElementById('api-model-input');
    const settingsStatus = document.getElementById('settings-status');
    // 连接方式单选按钮
    const connectionModeRadios = document.querySelectorAll('input[name="connection-mode"]');
    // 文件上传相关元素 (使用新 ID)
    const fileUploadButton = document.getElementById('file-upload-button');
    const fileUploadInput = document.getElementById('file-upload-input');
    const filePreviewContainer = document.getElementById('file-preview-container');
    // HTML 预览模态窗口元素
    const htmlPreviewModal = document.getElementById('html-preview-modal');
    const htmlPreviewOverlay = document.getElementById('html-preview-overlay');
    const closePreviewButton = document.getElementById('close-preview-button');
    const htmlPreviewIframe = document.getElementById('html-preview-iframe');

    // 用于存储待发送的文件数据
    let attachedImageBase64 = null;
    let attachedImageType = null;
    let attachedFileContent = null; // 新增：用于存储文本文件内容
    let attachedFileName = null; // 新增：用于存储文件名
    let conversationHistory = []; // 新增：用于存储对话历史
    const MAX_HISTORY_LENGTH = 10; // 限制历史记录长度 (例如 10 条消息 = 5 轮对话)

    // --- 事件监听 ---
    sendButton.addEventListener('click', handleUserInput);
    // 关闭 HTML 预览模态窗口
    closePreviewButton.addEventListener('click', closeHtmlPreview);
    htmlPreviewOverlay.addEventListener('click', closeHtmlPreview);

    userInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleUserInput();
        }
    });

    // 文件上传按钮点击时触发隐藏的 input
    fileUploadButton.addEventListener('click', () => {
        fileUploadInput.click();
    });

    // 处理文件选择 (图片或文本)
    fileUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // 清除上一个附件
        clearAttachedData();
        attachedFileName = file.name; // 保存文件名

        if (file.type.startsWith('image/')) {
            // 处理图片文件
            const reader = new FileReader();
            reader.onload = (e) => {
                attachedImageBase64 = e.target.result.split(',')[1];
                attachedImageType = file.type;
                displayImagePreview(e.target.result, file.name); // 显示图片预览
            }
            reader.onerror = () => {
                 showStatus(`读取图片文件 "${file.name}" 时出错`, true);
                 clearAttachedData();
            }
            reader.readAsDataURL(file);
        } else if (
            file.type === 'text/plain' ||
            file.type === 'text/markdown' ||
            file.name.endsWith('.txt') ||
            file.name.endsWith('.md')
        ) {
            // 处理文本文件
            const reader = new FileReader();
            reader.onload = (e) => {
                attachedFileContent = e.target.result; // 存储文本内容
                displayTextPreview(file.name, "文本文件");
            }
            reader.onerror = () => {
                showStatus(`读取文本文件 "${file.name}" 时出错`, true);
                clearAttachedData();
            }
            reader.readAsText(file);
        } else if (
            file.type === 'application/pdf' ||
            file.name.endsWith('.pdf')
        ) {
            // 处理 PDF 文件
            const reader = new FileReader();
            reader.onload = async (e) => {
                const arrayBuffer = e.target.result;
                try {
                    // 设置 worker 路径，pdf.js 需要这个来加载 worker
                    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js`;
                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    let fullText = '';
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        fullText += textContent.items.map(item => item.str).join(' ') + '\n';
                    }
                    attachedFileContent = fullText; // 存储 PDF 内容
                    displayTextPreview(file.name, "PDF 文件 (内容已加载)");
                    showStatus(`PDF 文件 "${file.name}" 内容已成功加载。`, false);
                } catch (error) {
                    showStatus(`解析 PDF 文件 "${file.name}" 时出错: ${error.message}`, true);
                    clearAttachedData();
                }
            };
            reader.onerror = () => {
                showStatus(`读取 PDF 文件 "${file.name}" 时出错`, true);
                clearAttachedData();
            };
            reader.readAsArrayBuffer(file);
        } else if (
            file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.name.endsWith('.docx') ||
            file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.name.endsWith('.xlsx')
        ) {
            // 处理 Word, Excel 文件 - 仅预览文件名
            attachedFileContent = null; // 不读取这些文件的内容到此变量
            let fileTypeDescription = "文件";
            if (file.name.endsWith('.docx')) fileTypeDescription = "Word 文档";
            else if (file.name.endsWith('.xlsx')) fileTypeDescription = "Excel 表格";
            displayTextPreview(file.name, fileTypeDescription); // 显示文件名预览，并传递类型描述
        } else {
            // 不支持的文件类型
            showStatus(`不支持的文件类型: ${file.type || '未知'} (${file.name})`, true);
            attachedFileName = null; // 清除非支持文件的名称
            clearAttachedData(); // 确保清除所有状态
        }
        // 清空 input 的值，以便可以再次选择同一个文件
        fileUploadInput.value = '';
    });


    // --- 函数定义 ---

    /**
     * 将消息（HTML或纯文本）附加到聊天窗口
     * @param {string} content 要显示的内容 (可以是 HTML)
     * @param {string} sender 'user' 或 'model'
     * @param {string} [messageId=null] 可选的消息元素ID，用于后续更新
     * @returns {HTMLElement} 返回创建的消息元素
     */



    /**
     * 显示图片预览
     * @param {string} imageDataUrl 图片的 Data URL
     * @param {string} fileName 文件名
     */
     function displayImagePreview(imageDataUrl, fileName) {
        filePreviewContainer.innerHTML = ''; // 清空旧预览
        const img = document.createElement('img');
        img.src = imageDataUrl;
        img.alt = fileName;
        img.title = `图片: ${fileName} (点击移除)`;
        img.classList.add('preview-image');
        img.onclick = () => clearAttachedData();
        filePreviewContainer.appendChild(img);
     }

     /**
      * 显示文本文件预览 (文件名)
      * @param {string} fileName 文件名
      * @param {string} fileTypeDescription 文件类型描述 (例如 "文本文件", "PDF")
      */
     function displayTextPreview(fileName, fileTypeDescription = "文件") {
        filePreviewContainer.innerHTML = ''; // 清空旧预览
        const span = document.createElement('span');
        span.textContent = fileName;
        span.title = `${fileTypeDescription}: ${fileName} (点击移除)`;
        span.classList.add('preview-filename');
        span.onclick = () => clearAttachedData();
        filePreviewContainer.appendChild(span);
     }

     /**
      * 清除所有已附加的文件数据和预览
      */
     function clearAttachedData() {
        attachedImageBase64 = null;
        attachedImageType = null;
        attachedFileContent = null;
        attachedFileName = null;
        filePreviewContainer.innerHTML = ''; // 清空预览
        fileUploadInput.value = ''; // 重置文件输入
        console.log("附件已清除");
     }


    /**
     * 处理用户输入 (包含文件处理)
     */
    function handleUserInput() {
        const inputText = userInput.value.trim();
        // 必须有文本或附件才能发送
        if (inputText || attachedImageBase64 || attachedFileContent) {
            let displayText = inputText;
            let fileInfoForDisplay = null; // 用于在消息流中显示附件信息

            if (attachedFileName) {
                 // 如果有附件，修改显示文本或添加文件信息
                 fileInfoForDisplay = `(附带文件: ${attachedFileName})`;
                 if (!displayText) {
                     displayText = fileInfoForDisplay; // 如果没有输入文本，只显示附件信息
                 } else {
                      // 可以选择将文件信息附加到文本后
                      // displayText += ` ${fileInfoForDisplay}`;
                 }
            }

            displayMessage(displayText, 'user'); // 显示用户输入（可能包含附件提示）

            // --- 构建用户消息并添加到历史记录 ---
            const userMessageContent = [];
            // 组合文本和文件内容作为文本部分
            let combinedTextForHistory = inputText || "";
            if (attachedFileContent) { // 纯文本文件内容
                combinedTextForHistory = `文件 "${attachedFileName}" (文本内容):\n${attachedFileContent}\n\n---\n\n${combinedTextForHistory}`;
            } else if (attachedFileName && !attachedImageBase64) { // 其他类型的文件，仅有文件名
                combinedTextForHistory = `[已附加文件: ${attachedFileName}]\n\n${combinedTextForHistory}`;
            }

            if (combinedTextForHistory || attachedImageBase64) { // 如果有文本或图片，则添加text部分
                 userMessageContent.push({ type: "text", text: combinedTextForHistory.trim() });
            }
            
            // 添加图片
            if (attachedImageBase64 && attachedImageType) {
                 userMessageContent.push({
                     type: "image_url",
                     image_url: { "url": `data:${attachedImageType};base64,${attachedImageBase64}` }
                 });
            }

            if (userMessageContent.length > 0) {
                conversationHistory.push({ role: "user", content: userMessageContent });
                console.log("User message added to history:", conversationHistory[conversationHistory.length - 1]);
            }

            // --- 截断历史记录 ---
            if (conversationHistory.length > MAX_HISTORY_LENGTH) {
                // 保留最新的 MAX_HISTORY_LENGTH 条记录
                conversationHistory = conversationHistory.slice(-MAX_HISTORY_LENGTH);
                console.log(`History truncated to last ${MAX_HISTORY_LENGTH} messages.`);
            }

             // 如果有图片预览，也显示在消息流中（可选）
            if (attachedImageBase64) {
                const imgElement = document.createElement('img');
                imgElement.src = `data:${attachedImageType};base64,${attachedImageBase64}`;
                imgElement.style.maxWidth = '200px';
                imgElement.style.maxHeight = '200px';
                imgElement.style.display = 'block';
                imgElement.style.marginTop = '5px';
                 const userMessages = chatOutput.querySelectorAll('.user-message');
                 if (userMessages.length > 0) {
                      userMessages[userMessages.length - 1].appendChild(imgElement);
                 }
            }


            // 清空输入框
            userInput.value = '';
            adjustTextareaHeight();

            // 调用API函数，传递文本、图片和文件内容
            // 在调用 API 之前禁用发送按钮并更改文本
            sendButton.disabled = true;
            sendButton.textContent = '思考中...'; // 更改按钮文本
            // 传递整个对话历史给 API 调用函数
            callLLMApi(conversationHistory);

            // 清除已附加的文件数据和预览 (因为它们已被添加到历史记录)
            clearAttachedData();


            // 输入框重新获得焦点
            userInput.focus();
        } else {
             showStatus("请输入消息或上传文件", true);
        }
    }

    /**
     * 调用大模型API (处理对话历史)
     * @param {Array<object>} history 当前的对话历史记录 (messages 格式)
    */
    async function callLLMApi(history) { // <-- Change signature
        // 创建一个占位的模型消息元素用于流式显示或直接模式的最终显示
        const modelMessageElement = displayMessage("", 'model', true); // isThinking=true initially
        let fullModelReply = ""; // 用于累积完整的模型回复 (流式或直接)

        const selectedConnectionMode = document.querySelector('input[name="connection-mode"]:checked').value;
        const currentBaseUrl = apiBaseUrlInput.value.trim();
        const currentApiKey = apiKeyInput.value.trim();
        const currentModel = apiModelInput.value.trim() || 'gpt-3.5-turbo';

        try {
            if (selectedConnectionMode === 'backend') {
                // --- 模式1：通过本地服务器代理 (流式处理) ---
                const backendApiUrl = 'http://localhost:3000/api/chat';
                const requestBody = {
                   model: currentModel,
                   ...(currentBaseUrl && { baseUrl: currentBaseUrl }),
                   messages: history
               };
                console.log(`通过后端 ${backendApiUrl} 发送流式请求`, requestBody);

               const response = await fetch(backendApiUrl, {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify(requestBody)
               });

               if (!response.ok) {
                    // 尝试解析错误体，后端可能在流开始前返回错误
                    let errorData;
                    try { errorData = await response.json(); } catch (e) { errorData = { message: response.statusText }; }
                    throw new Error(`后端错误(非流式): ${response.status} - ${errorData.error || errorData.message}`);
               }
               if (!response.body) {
                    throw new Error("后端响应没有流式主体");
               }

               // --- 处理流 ---
               const reader = response.body.getReader();
               const decoder = new TextDecoder();
               let buffer = '';
               modelMessageElement.classList.remove('thinking-message'); // 移除思考样式
               modelMessageElement.textContent = ''; // 清空占位符

               while (true) {
                   const { value, done } = await reader.read();
                   if (done) {
                        console.log("Stream reader finished.");
                        // 确保处理完缓冲区最后的内容
                        if (buffer.startsWith('data: ')) {
                             const dataStr = buffer.substring(6);
                             if (dataStr === '[DONE]') { /* Handled */ }
                             else {
                                  try {
                                       const parsedData = JSON.parse(dataStr);
                                       if (parsedData.delta) {
                                            fullModelReply += parsedData.delta;
                                            displayMessage(fullModelReply, 'model', false, false, modelMessageElement); // Update existing element
                                       }
                                  } catch (e) { console.error("Error parsing final SSE buffer:", e, "Data:", dataStr); }
                             }
                        }
                        break;
                   };

                   buffer += decoder.decode(value, { stream: true });
                   const lines = buffer.split('\n\n');
                   buffer = lines.pop() || '';

                   for (const line of lines) {
                       if (line.startsWith('data: ')) {
                           const dataStr = line.substring(6).trim();
                           if (dataStr === '[DONE]') {
                               console.log("Received [DONE] signal.");
                               // [DONE] 信号表示结束，不再处理后续，历史记录在循环结束后添加
                           } else {
                               try {
                                   const parsedData = JSON.parse(dataStr);
                                   if (parsedData.delta) {
                                       fullModelReply += parsedData.delta;
                                       displayMessage(fullModelReply, 'model', false, false, modelMessageElement); // Update existing element
                                   }
                               } catch (e) { console.error("Error parsing SSE data:", e, "Data:", dataStr); }
                           }
                       } else if (line.startsWith('event: error')) {
                            const errorDataLine = lines.find(l => l.startsWith('data: '));
                            let errorMessage = '流处理时发生未知错误';
                            if(errorDataLine) {
                                const errorDataStr = errorDataLine.substring(6).trim();
                                try {
                                     const errorJson = JSON.parse(errorDataStr);
                                     errorMessage = `流处理错误: ${errorJson.message || '未知错误'}`;
                                } catch (e) { errorMessage = `流处理错误: 无法解析错误数据 ${errorDataStr}`; }
                            }
                            console.error(errorMessage);
                            displayMessage(errorMessage, 'model', false, true, modelMessageElement); // Display error in the message element
                            throw new Error(errorMessage); // 抛出错误以停止处理并进入 catch
                       }
                   }
               }
               // 流正常结束后，添加完整历史记录
               if (fullModelReply) {
                    conversationHistory.push({ role: "assistant", content: fullModelReply });
                    console.log("Assistant message added to history after stream:", conversationHistory[conversationHistory.length - 1]);
               }


            } else if (selectedConnectionMode === 'direct') {
                // --- 模式2：直接浏览器连接 (保持非流式) ---
                if (!currentApiKey) throw new Error("请在设置中输入 API Key 以使用直接连接模式。");
                if (!currentBaseUrl) throw new Error("请在设置中输入 API 基础 URL 以使用直接连接模式。");

                const directApiUrl = currentBaseUrl.endsWith('/') ? `${currentBaseUrl}chat/completions` : `${currentBaseUrl}/chat/completions`;
                console.log(`直接连接 ${directApiUrl} 发送请求，Model: ${currentModel}`);
                showStatus("警告：您正在使用直接连接模式，API Key 在浏览器中处理。", true);

                const response = await fetch(directApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentApiKey}` },
                    body: JSON.stringify({ model: currentModel, messages: history })
                });

                if (!response.ok) {
                    let errorData;
                    try { errorData = await response.json(); } catch (e) { errorData = { message: response.statusText }; }
                    const errorMessage = errorData?.error?.message || errorData.message || response.statusText;
                    throw new Error(`直接 API 错误: ${response.status} - ${errorMessage}`);
                }
                const data = await response.json();
                fullModelReply = data.choices?.[0]?.message?.content?.trim(); // Assign to fullModelReply

                // --- 处理直接模式的回复 ---
                // removeThinkingMessage(); // 移除思考占位符 (或更新 modelMessageElement) <-- 移除此行，displayMessage会处理
                if (fullModelReply) {
                     displayMessage(fullModelReply, 'model', false, false, modelMessageElement); // Update existing element
                     // 将模型回复添加到历史记录
                     conversationHistory.push({ role: "assistant", content: fullModelReply });
                     console.log("Assistant message added to history (direct):", conversationHistory[conversationHistory.length - 1]);
                } else {
                     throw new Error("未能从 API 获取有效回复内容 (直接模式)");
                }
            }
            // 回复添加历史记录的逻辑已移到各自模式处理完成之后

        } catch (error) {
            console.error(`调用 API 时出错 (${selectedConnectionMode} 模式):`, error);
            // 尝试更新消息元素为错误状态，如果它还处于思考状态
            if (modelMessageElement && modelMessageElement.classList.contains('thinking-message')) {
                 displayMessage(`错误：无法获取模型回复 (${error.message})`, 'model', false, true, modelMessageElement);
            } else if (!modelMessageElement){ // Should not happen normally
                 displayMessage(`错误：无法获取模型回复 (${error.message})`, 'model', false, true);
            }
            // 不需要在 catch 中添加历史记录，成功的分支会处理

        } finally {
            // 无论成功或失败，最终都重新启用发送按钮并恢复文本
            sendButton.disabled = false;
            sendButton.textContent = '发送'; // 恢复按钮文本
        }
    }

    /**
     * 在聊天输出区显示消息
     * @param {string} text 消息内容
     * @param {'user' | 'model'} sender 发送者 ('user' 或 'model')
     * @param {boolean} [isThinking=false] 是否为思考状态消息
     * @param {boolean} [isError=false] 是否为错误消息
     * @param {HTMLElement | null} [elementToUpdate=null] 如果提供，则更新此元素而不是创建新元素
     */
    function displayMessage(text, sender, isThinking = false, isError = false, elementToUpdate = null) {
        const messageElement = elementToUpdate || document.createElement('div');

        // 只有在创建新元素时才添加基础 class
        if (!elementToUpdate) {
            messageElement.classList.add('message', `${sender}-message`);
        }

        // 清理旧状态
        messageElement.classList.remove('thinking-message', 'error-message');
        messageElement.style.color = ''; // 重置颜色

        if (isThinking) {
            messageElement.classList.add('thinking-message');
            // 使用 requestAnimationFrame 稍微延迟添加动画类，确保 CSS 过渡生效
            requestAnimationFrame(() => {
                 messageElement.innerHTML = `<span class="thinking-dot">.</span><span class="thinking-dot">.</span><span class="thinking-dot">.</span> ${text || '思考中...'}`;
            });
        } else if (isError) {
            messageElement.classList.add('error-message');
            messageElement.style.color = 'red';
            messageElement.textContent = text;
        } else {
            // 正常消息
            messageElement.style.whiteSpace = 'pre-wrap';

            if (sender === 'model') {
                // 使用 marked.js 解析 Markdown，它会自动使用 hljs 进行语法高亮
                messageElement.innerHTML = marked.parse(text);

                // 后处理：查找所有 HTML 代码块并添加预览按钮
                messageElement.querySelectorAll('pre code.language-html').forEach(codeBlock => {
                    // 从 code 标签的 textContent 中提取纯 HTML 内容
                    const htmlContent = codeBlock.textContent;

                    // 创建并添加预览按钮
                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'preview-button-container';
                    const buttonElement = document.createElement('button');
                    buttonElement.className = 'preview-html-button';
                    buttonElement.innerHTML = `<span class="material-icons">visibility</span> 预览 HTML`;
                    buttonElement.addEventListener('click', () => showHtmlPreview(htmlContent));
                    buttonContainer.appendChild(buttonElement);

                    // 将按钮容器插入到 <pre> 元素之后
                    if (codeBlock.parentElement && codeBlock.parentElement.tagName === 'PRE') {
                        codeBlock.parentElement.insertAdjacentElement('afterend', buttonContainer);
                    }
                });
            } else { // 对于用户消息或其他非模型发送者
                messageElement.textContent = text; // 保持简单，只显示纯文本
            }
        }

        // 只有在创建新元素时才添加到 DOM
        if (!elementToUpdate) {
             chatOutput.appendChild(messageElement);
        }
        // 仅在添加新消息或更新内容时滚动
        if (!elementToUpdate || text) {
             scrollToBottom();
        }
        return messageElement; // 返回元素引用
    }



    /**
     * 滚动聊天区域到底部
     */
    function scrollToBottom() {
        const chatArea = document.getElementById('chat-area');
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    /**
     * 根据内容自动调整Textarea高度
     */
    function adjustTextareaHeight() {
        userInput.style.height = 'auto';
        let newHeight = userInput.scrollHeight;
        const maxHeight = parseInt(window.getComputedStyle(userInput).maxHeight, 10);
        if (newHeight > maxHeight) {
            newHeight = maxHeight;
            userInput.style.overflowY = 'auto';
        } else {
            userInput.style.overflowY = 'hidden';
        }
        userInput.style.height = `${newHeight + 2}px`;
    }

    userInput.addEventListener('input', adjustTextareaHeight);
    adjustTextareaHeight();

    // 设置面板显隐
    settingsToggleButton.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
    });
    closeSettingsButton.addEventListener('click', () => {
        settingsPanel.classList.add('hidden');
    });
    document.addEventListener('click', (event) => {
        if (!settingsPanel.classList.contains('hidden') &&
            !settingsPanel.contains(event.target) &&
            event.target !== settingsToggleButton &&
            !settingsToggleButton.contains(event.target)
           ) {
            settingsPanel.classList.add('hidden');
        }
    });

    // --- HTML 预览模态窗口逻辑 ---
    /**
     * 显示 HTML 预览模态窗口
     * @param {string} htmlContent 要预览的 HTML 内容
     */
    function showHtmlPreview(htmlContent) {
        console.log("准备预览 HTML:", htmlContent.substring(0, 100) + "...");
        // 清理可能的脚本注入（基本清理，更复杂的需要DOMPurify等库）
        // const sanitizedHtml = htmlContent.replace(/<script.*?>.*?<\/script>/gi, ''); // 移除 script 标签
        htmlPreviewIframe.srcdoc = htmlContent; // 直接使用 srcdoc 更安全，浏览器会处理沙箱
        htmlPreviewModal.classList.remove('hidden');
    }

    /**
     * 关闭 HTML 预览模态窗口
     */
    function closeHtmlPreview() {
        htmlPreviewModal.classList.add('hidden');
        htmlPreviewIframe.srcdoc = ''; // 清空内容
    }
    // 关闭按钮和遮罩层的事件监听已在前面添加 (lines 44-45)


    // --- 设置面板逻辑 ---
    const STORAGE_KEY = 'llmChatbotApiConfigs';
    const LAST_USED_PROFILE_KEY = 'llmChatbotLastProfile';

    function loadProfiles() {
        const profiles = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const profileNames = Object.keys(profiles);
        configProfileSelect.innerHTML = '';
        if (profileNames.length === 0) {
            configProfileSelect.innerHTML = '<option value="">无可用配置</option>';
            disableProfileButtons(true);
        } else {
            profileNames.sort().forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                configProfileSelect.appendChild(option);
            });
            disableProfileButtons(false);
        }
        console.log("已加载配置列表:", profileNames);
    }

     function disableProfileButtons(disable) {
        loadProfileButton.disabled = disable;
        deleteProfileButton.disabled = disable;
     }

    /**
     * 保存单个配置对象到 localStorage
     * @param {object} profileData - 包含配置信息的对象
     * @returns {boolean} - 是否成功保存
     */
    function saveProfileData(profileData) {
        if (!profileData || typeof profileData.profileName !== 'string' || profileData.profileName.trim() === '') {
            console.warn("尝试保存的配置数据无效或缺少 profileName:", profileData);
            return false;
        }
        const profileNameToSave = profileData.profileName.trim();
        const profiles = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

        // 确保所有期望的字段都存在，如果不存在则使用默认值
        profiles[profileNameToSave] = {
            provider: profileData.provider || 'OpenAI Compatible',
            baseUrl: profileData.baseUrl || '',
            apiKey: profileData.apiKey || '',
            model: profileData.model || 'gpt-3.5-turbo',
            connectionMode: profileData.connectionMode || 'backend'
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
        localStorage.setItem(LAST_USED_PROFILE_KEY, profileNameToSave); // 更新最后使用的配置
        console.log("配置数据已保存:", profileNameToSave, profiles[profileNameToSave]);
        return true;
    }

    /**
     * 从当前表单保存配置
     * @param {string} profileNameToSave - 要保存的配置名称
     */
    function saveCurrentFormAsProfile(profileNameToSave) {
        if (!profileNameToSave) {
            showStatus("错误：请输入配置名称！", true);
            profileNameInput.focus();
            return;
        }
        const currentProfileData = {
            profileName: profileNameToSave,
            provider: apiProviderInput.value.trim(),
            baseUrl: apiBaseUrlInput.value.trim(),
            apiKey: apiKeyInput.value.trim(),
            model: apiModelInput.value.trim(),
            connectionMode: document.querySelector('input[name="connection-mode"]:checked').value
        };

        if (saveProfileData(currentProfileData)) {
            loadProfiles(); // 重新加载下拉列表
            configProfileSelect.value = profileNameToSave; // 选中刚保存的
            showStatus(`配置 "${profileNameToSave}" 已保存!`);
        } else {
            showStatus(`配置 "${profileNameToSave}" 保存失败，请检查控制台。`, true);
        }
    }


    function loadSelectedProfile() {
        const selectedProfileName = configProfileSelect.value;
        if (!selectedProfileName) return;
        const profiles = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const profileData = profiles[selectedProfileName];
        if (profileData) {
            profileNameInput.value = selectedProfileName;
            apiProviderInput.value = profileData.provider || '';
            apiBaseUrlInput.value = profileData.baseUrl || '';
            apiKeyInput.value = profileData.apiKey || '';
            apiModelInput.value = profileData.model || '';
            const savedMode = profileData.connectionMode || 'backend';
            document.querySelector(`input[name="connection-mode"][value="${savedMode}"]`).checked = true;
            localStorage.setItem(LAST_USED_PROFILE_KEY, selectedProfileName);
            showStatus(`配置 "${selectedProfileName}" 已加载!`);
            console.log("配置已加载:", selectedProfileName, profileData);
        } else {
            showStatus(`错误：无法找到配置 "${selectedProfileName}"`, true);
        }
    }

    function deleteProfile() {
        const selectedProfileName = configProfileSelect.value;
        if (!selectedProfileName) {
            showStatus("没有选择有效的配置来删除", true);
            return;
        }
        if (confirm(`确定要删除配置 "${selectedProfileName}" 吗？此操作不可撤销。`)) {
            const profiles = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            delete profiles[selectedProfileName];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
            if (localStorage.getItem(LAST_USED_PROFILE_KEY) === selectedProfileName) {
                 localStorage.removeItem(LAST_USED_PROFILE_KEY);
            }
            profileNameInput.value = '';
            loadProfiles();
            const remainingProfiles = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            const lastUsed = localStorage.getItem(LAST_USED_PROFILE_KEY);
            const firstProfile = configProfileSelect.options.length > 0 ? configProfileSelect.options[0].value : null;
            if(lastUsed && remainingProfiles[lastUsed]) {
                 configProfileSelect.value = lastUsed;
            } else if (firstProfile) {
                 configProfileSelect.value = firstProfile;
            } else {
                 clearSettingsInputs();
                 profileNameInput.value = '';
                 disableProfileButtons(true);
            }
            if (configProfileSelect.value) {
                 loadSelectedProfile();
            } else {
                 clearSettingsInputs();
                 profileNameInput.value = '';
            }
            showStatus(`配置 "${selectedProfileName}" 已删除!`);
            console.log("配置已删除:", selectedProfileName);
        }
    }

     function handleNewProfile() {
        const newName = prompt("请输入新配置文件的名称:", "");
        if (newName && newName.trim()) {
            const trimmedName = newName.trim();
             const profiles = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
             if (profiles[trimmedName]) {
                 if (!confirm(`配置 "${trimmedName}" 已存在，要覆盖吗？`)) {
                     return;
                 }
             }
            clearSettingsInputs(false);
            profileNameInput.value = trimmedName;
            apiBaseUrlInput.focus();
            showStatus(`请输入 "${trimmedName}" 的配置信息并保存。`);
        }
     }

     function clearSettingsInputs(clearName = true) {
        if (clearName) {
            profileNameInput.value = '';
        }
        apiProviderInput.value = 'OpenAI Compatible';
        apiBaseUrlInput.value = '';
        apiKeyInput.value = '';
        apiModelInput.value = 'gpt-3.5-turbo';
        document.querySelector('input[name="connection-mode"][value="backend"]').checked = true;
     }

     function showStatus(message, isError = false) {
        settingsStatus.textContent = message;
        settingsStatus.className = isError ? 'status-message error' : 'status-message';
        setTimeout(() => {
            settingsStatus.textContent = '';
            settingsStatus.className = 'status-message';
        }, 3000);
     }

     function loadLastUsedConfig() {
        const lastUsed = localStorage.getItem(LAST_USED_PROFILE_KEY);
        const profiles = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (lastUsed && profiles[lastUsed]) {
            configProfileSelect.value = lastUsed;
            loadSelectedProfile();
        } else if (configProfileSelect.options.length > 0 && configProfileSelect.options[0].value) {
             configProfileSelect.selectedIndex = 0;
             loadSelectedProfile();
        } else {
            clearSettingsInputs();
            profileNameInput.value = '';
            disableProfileButtons(true);
        }
     }

    // --- 设置面板事件监听 ---
    saveProfileButton.addEventListener('click', () => {
        saveCurrentFormAsProfile(profileNameInput.value.trim());
    });
    loadProfileButton.addEventListener('click', loadSelectedProfile);
    deleteProfileButton.addEventListener('click', deleteProfile);
    newProfileButton.addEventListener('click', handleNewProfile);
    configProfileSelect.addEventListener('change', loadSelectedProfile);
    downloadTemplateButton.addEventListener('click', downloadConfigTemplate);
    uploadConfigButton.addEventListener('click', () => uploadConfigInput.click());
    uploadConfigInput.addEventListener('change', handleUploadConfigFile);

    // 添加一些初始提示或欢迎语 (可选)
    displayMessage("您好！我是AI助手，请问有什么可以帮您的吗？", 'model');

    // --- 初始化 ---
    loadProfiles();
    loadLastUsedConfig();

    // --- 新增功能函数 ---

    /**
     * 下载当前配置或一个空模板作为JSON文件
     */
    function downloadConfigTemplate() {
        const profileNameToDownload = profileNameInput.value.trim();
        const currentConfig = {
            profileName: profileNameToDownload || "My New Config", // 如果当前名称为空，给个默认
            provider: apiProviderInput.value.trim() || "OpenAI Compatible",
            baseUrl: apiBaseUrlInput.value.trim(),
            apiKey: apiKeyInput.value.trim(), // 通常模板不应包含真实密钥
            model: apiModelInput.value.trim() || "gpt-3.5-turbo",
            connectionMode: document.querySelector('input[name="connection-mode"]:checked').value || "backend"
        };

        // 对于下载的模板，可以考虑清空敏感信息如apiKey
        const templateConfig = { ...currentConfig };
        if (confirm("是否在模板中包含当前的API密钥？取消则模板中的API密钥将为空。")) {
            // 用户选择包含，什么也不做
        } else {
            templateConfig.apiKey = ""; // 清空API密钥
        }


        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(templateConfig, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        const downloadFileName = templateConfig.profileName ? `config_${templateConfig.profileName.replace(/\s+/g, '_')}.json` : "llm_config_template.json";
        downloadAnchorNode.setAttribute("download", downloadFileName);
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        showStatus(`配置模板 "${downloadFileName}" 已开始下载。`);
        console.log("下载配置模板:", templateConfig);
    }

    /**
     * 处理上传的配置文件
     * @param {Event} event 文件输入框的change事件
     */
    function handleUploadConfigFile(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        if (file.type !== 'application/json') {
            showStatus(`错误：请上传有效的JSON配置文件 (.json) 而不是 ${file.type || '未知类型'}`, true);
            uploadConfigInput.value = ''; // 清空选择，以便可以再次选择
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsedJson = JSON.parse(e.target.result);
                let configsToProcess = [];
                let importedCount = 0;
                let skippedCount = 0;

                if (Array.isArray(parsedJson)) {
                    configsToProcess = parsedJson;
                } else if (typeof parsedJson === 'object' && parsedJson !== null) {
                    configsToProcess = [parsedJson]; // 将单个对象视为单元素数组处理
                } else {
                    throw new Error("无效的JSON格式，既不是对象也不是数组。");
                }

                configsToProcess.forEach(configObject => {
                    if (configObject && typeof configObject === 'object' &&
                        configObject.profileName && typeof configObject.profileName === 'string' &&
                        configObject.profileName.trim() !== '') {
                        if (saveProfileData(configObject)) {
                            importedCount++;
                        } else {
                            skippedCount++; // saveProfileData内部可能因其他验证失败（虽然目前较少）
                        }
                    } else {
                        skippedCount++;
                        console.warn("跳过无效或无名的配置对象:", configObject);
                    }
                });

                if (importedCount > 0) {
                    loadProfiles(); // 重新加载下拉列表
                    // 尝试加载最后一个成功导入的配置到表单，或者第一个（如果LAST_USED_PROFILE_KEY被更新了）
                    const lastUsedProfile = localStorage.getItem(LAST_USED_PROFILE_KEY);
                    if (lastUsedProfile && configProfileSelect.querySelector(`option[value="${lastUsedProfile}"]`)) {
                         configProfileSelect.value = lastUsedProfile;
                         loadSelectedProfile(); // 加载到表单
                    } else if (configProfileSelect.options.length > 0) {
                        configProfileSelect.selectedIndex = 0; // 选择第一个
                        loadSelectedProfile();
                    } else {
                        clearSettingsInputs(); // 如果没有可选项了，清空表单
                    }
                    showStatus(`${importedCount} 个配置已成功导入。${skippedCount > 0 ? skippedCount + ' 个配置因格式问题被跳过。' : ''}`);
                } else if (skippedCount > 0) {
                    showStatus(`未能导入任何配置。${skippedCount} 个配置因格式无效或缺少名称而被跳过。`, true);
                } else {
                     showStatus(`上传的文件 "${file.name}" 中没有找到有效的配置数据。`, true);
                }
                console.log(`配置文件 "${file.name}" 处理完毕。导入: ${importedCount}, 跳过: ${skippedCount}`);

            } catch (error) {
                showStatus(`错误：解析或处理配置文件 "${file.name}" 失败: ${error.message}`, true);
                console.error("解析上传的配置文件失败:", error);
            } finally {
                uploadConfigInput.value = ''; // 清空选择，以便可以再次选择同一个文件
            }
        };
        reader.onerror = () => {
            showStatus(`错误：读取文件 "${file.name}" 时发生错误。`, true);
            uploadConfigInput.value = '';
        };
        reader.readAsText(file);
    }

});