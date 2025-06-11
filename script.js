document.addEventListener('DOMContentLoaded', () => {
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

    // 用于存储待发送的文件数据
    let attachedImageBase64 = null;
    let attachedImageType = null;
    let attachedFileContent = null; // 新增：用于存储文本文件内容
    let attachedFileName = null; // 新增：用于存储文件名


    // --- 事件监听 ---
    sendButton.addEventListener('click', handleUserInput);
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
        } else if (file.type === 'text/plain' || file.type === 'text/markdown' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
            // 处理文本文件
            const reader = new FileReader();
            reader.onload = (e) => {
                attachedFileContent = e.target.result;
                displayTextPreview(file.name); // 显示文件名预览
            }
             reader.onerror = () => {
                 showStatus(`读取文本文件 "${file.name}" 时出错`, true);
                 clearAttachedData();
            }
            reader.readAsText(file);
        } else {
            // 不支持的文件类型
            showStatus(`不支持的文件类型: ${file.type || '未知'}`, true);
            attachedFileName = null; // 清除非支持文件的名称
             clearAttachedData(); // 确保清除所有状态
        }
         // 清空 input 的值，以便可以再次选择同一个文件
        fileUploadInput.value = '';
    });


    // --- 函数定义 ---

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
      */
     function displayTextPreview(fileName) {
        filePreviewContainer.innerHTML = ''; // 清空旧预览
        const span = document.createElement('span');
        span.textContent = fileName;
        span.title = `文本文件: ${fileName} (点击移除)`;
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
            // 在调用 API 之前禁用发送按钮
            sendButton.disabled = true;
            callLLMApi(inputText, attachedImageBase64, attachedImageType, attachedFileContent);

            // 清除已附加的文件数据和预览
            clearAttachedData();


            // 输入框重新获得焦点
            userInput.focus();
        } else {
             showStatus("请输入消息或上传文件", true);
        }
    }

    /**
     * 调用大模型API (处理文本、图片、文本文件)
     * @param {string} prompt 用户输入的提示
     * @param {string | null} imageBase64 Base64编码的图片数据 (无前缀)
     * @param {string | null} imageType 图片的MIME类型 (例如 image/jpeg)
     * @param {string | null} fileContent 文本文件的内容
     */
    async function callLLMApi(prompt, imageBase64, imageType, fileContent) {
        displayMessage("思考中...", 'model', true);

        const selectedConnectionMode = document.querySelector('input[name="connection-mode"]:checked').value;
        const currentBaseUrl = apiBaseUrlInput.value.trim();
        const currentApiKey = apiKeyInput.value.trim();
        const currentModel = apiModelInput.value.trim() || 'gpt-3.5-turbo';

        // --- 构建最终发送给模型的文本 prompt ---
        let combinedPrompt = prompt || ""; // 开始时是用户输入的文本
        if (fileContent) {
            // 如果有文本文件内容，将其添加到 prompt 前面或后面
            // 为模型提供上下文，说明这是文件内容
            combinedPrompt = `文件 "${attachedFileName}" 的内容如下：\n\n${fileContent}\n\n---\n\n${combinedPrompt}`;
             console.log(`已将文件 "${attachedFileName}" 内容添加到 Prompt。`);
        }
        // 注意：需要检查组合后的 prompt 是否过长，可能需要截断 fileContent

        try {
            let modelReply = null;

            if (selectedConnectionMode === 'backend') {
                // --- 模式1：通过本地服务器代理 ---
                const backendApiUrl = 'http://localhost:3000/api/chat';
                 // 发送给后端的数据结构
                 const requestBody = {
                    prompt: combinedPrompt, // 发送组合后的 prompt
                    model: currentModel,
                    ...(currentBaseUrl && { baseUrl: currentBaseUrl }),
                    ...(imageBase64 && { imageBase64: imageBase64, imageType: imageType }) // 图片数据
                    // 注意：如果后端也处理 fileContent，则在此处添加
                };
                console.log(`通过后端 ${backendApiUrl} 发送请求`, requestBody);

                const response = await fetch(backendApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    let errorData;
                    try { errorData = await response.json(); } catch (e) { errorData = { message: response.statusText }; }
                    throw new Error(`后端错误: ${response.status} - ${errorData.error || errorData.message}`);
                }
                const data = await response.json();
                modelReply = data.reply;

            } else if (selectedConnectionMode === 'direct') {
                // --- 模式2：直接浏览器连接 ---
                if (!currentApiKey) throw new Error("请在设置中输入 API Key 以使用直接连接模式。");
                if (!currentBaseUrl) throw new Error("请在设置中输入 API 基础 URL 以使用直接连接模式。");

                // 构建 OpenAI Vision API 的 messages 结构
                const messages = [];
                const userContent = [];
                // 添加组合后的文本（包含文件内容）
                if (combinedPrompt) {
                    userContent.push({ type: "text", text: combinedPrompt });
                }
                 // 添加图片
                if (imageBase64 && imageType) {
                    userContent.push({
                        type: "image_url",
                        image_url: { "url": `data:${imageType};base64,${imageBase64}` }
                    });
                }
                // 必须至少有文本或图片
                 if (userContent.length === 0) {
                      throw new Error("没有有效的文本或图片内容发送。");
                 }
                 messages.push({ role: "user", content: userContent });

                const directApiUrl = currentBaseUrl.endsWith('/') ? `${currentBaseUrl}chat/completions` : `${currentBaseUrl}/chat/completions`;
                console.log(`直接连接 ${directApiUrl} 发送请求，Model: ${currentModel}`);
                showStatus("警告：您正在使用直接连接模式，API Key 在浏览器中处理。", true);

                const response = await fetch(directApiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${currentApiKey}`
                    },
                    body: JSON.stringify({
                        model: currentModel,
                        messages: messages,
                        // max_tokens: 1000
                    })
                });

                if (!response.ok) {
                    let errorData;
                    try { errorData = await response.json(); } catch (e) { errorData = { message: response.statusText }; }
                    const errorMessage = errorData?.error?.message || errorData.message || response.statusText;
                    throw new Error(`直接 API 错误: ${response.status} - ${errorMessage}`);
                }
                const data = await response.json();
                modelReply = data.choices?.[0]?.message?.content?.trim();
            }

            // --- 处理回复 ---
            removeThinkingMessage();
            if (modelReply) {
                displayMessage(modelReply, 'model');
            } else {
                throw new Error(selectedConnectionMode === 'direct' ? "未能从 API 获取有效回复内容" : "从后端获取的回复无效或为空");
            }

        } catch (error) {
            console.error(`调用 API 时出错 (${selectedConnectionMode} 模式):`, error);
            removeThinkingMessage();
            displayMessage(`错误：无法获取模型回复 (${error.message})`, 'model', false, true);
            // 如果是因为直接连接模式缺少配置，清除附件避免重复发送
            if (selectedConnectionMode === 'direct' && (error.message.includes("API Key") || error.message.includes("基础 URL"))) {
                 clearAttachedData();
           }
       } finally {
           // 无论成功或失败，最终都重新启用发送按钮
           sendButton.disabled = false;
       }
   }

   /**
     * 在聊天输出区显示消息
     * @param {string} text 消息内容
     * @param {'user' | 'model'} sender 发送者 ('user' 或 'model')
     * @param {boolean} [isThinking=false] 是否为思考状态消息
     * @param {boolean} [isError=false] 是否为错误消息
     */
    function displayMessage(text, sender, isThinking = false, isError = false) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        if (isThinking) {
            messageElement.classList.add('thinking-message');
            messageElement.innerHTML = `<span class="thinking-dot">.</span><span class="thinking-dot">.</span><span class="thinking-dot">.</span> ${text}`;
        } else if (isError) {
            messageElement.classList.add('error-message');
            messageElement.style.color = 'red';
            messageElement.textContent = text;
        } else {
             messageElement.style.whiteSpace = 'pre-wrap';
             messageElement.textContent = text;
        }
        chatOutput.appendChild(messageElement);
        scrollToBottom();
    }

    /**
     * 移除"思考中..."的消息
     */
    function removeThinkingMessage() {
        const thinkingMsg = chatOutput.querySelector('.thinking-message');
        if (thinkingMsg) {
            chatOutput.removeChild(thinkingMsg);
        }
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

    function saveProfile(profileNameToSave) {
        if (!profileNameToSave) {
            showStatus("错误：请输入配置名称！", true);
            profileNameInput.focus();
            return;
        }
        const selectedConnectionMode = document.querySelector('input[name="connection-mode"]:checked').value;
        const profiles = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        profiles[profileNameToSave] = {
            provider: apiProviderInput.value.trim(),
            baseUrl: apiBaseUrlInput.value.trim(),
            apiKey: apiKeyInput.value.trim(),
            model: apiModelInput.value.trim(),
            connectionMode: selectedConnectionMode
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
        localStorage.setItem(LAST_USED_PROFILE_KEY, profileNameToSave);
        loadProfiles();
        configProfileSelect.value = profileNameToSave;
        showStatus(`配置 "${profileNameToSave}" 已保存!`);
        console.log("配置已保存:", profileNameToSave, profiles[profileNameToSave]);
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
        saveProfile(profileNameInput.value.trim());
    });
    loadProfileButton.addEventListener('click', loadSelectedProfile);
    deleteProfileButton.addEventListener('click', deleteProfile);
    newProfileButton.addEventListener('click', handleNewProfile);
    configProfileSelect.addEventListener('change', loadSelectedProfile);

    // 添加一些初始提示或欢迎语 (可选)
    displayMessage("您好！我是AI助手，请问有什么可以帮您的吗？", 'model');

    // --- 初始化 ---
    loadProfiles();
    loadLastUsedConfig();

});