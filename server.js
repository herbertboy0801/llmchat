// 引入必要的模块
require('dotenv').config(); // 加载 .env 文件中的环境变量
const express = require('express');
const { OpenAI } = require('openai'); // 使用 OpenAI v4+ 的导入方式

// 检查 API Key 是否已加载
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'YOUR_API_KEY_HERE') {
    console.error('错误：请在 .env 文件中设置您的 OPENAI_API_KEY');
    process.exit(1); // 如果没有设置Key，则退出程序
}

// 全局 OpenAI 实例 (使用 .env 中的 Key, 无 Base URL)
// 我们将在请求处理中根据需要创建带 Base URL 的实例
const defaultOpenai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 创建 Express 应用
const app = express();
const port = process.env.PORT || 3000; // 使用环境变量中的端口或默认3000

// 中间件: 解析 JSON 请求体
app.use(express.json());

// 中间件: 允许从前端访问 (设置基本的CORS)
// 注意：在生产环境中，您可能需要更严格的CORS设置
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // 允许所有来源 (开发时方便)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200); // 处理预检请求
    }
    next();
});

// --- API 端点: 处理聊天请求 ---
app.post('/api/chat', async (req, res) => {
    // 从请求体中获取 messages (对话历史), model, baseUrl
    // prompt, imageBase64, imageType 不再直接使用，它们包含在 messages 中
    const { messages, model, baseUrl } = req.body;

    // 验证 messages 是否存在且为数组
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: '请求体中缺少有效的 messages 字段 (对话历史)' });
    }
    // 注意：即使有图片，prompt 也可以为空 (现在检查 messages 即可)
    // if (!prompt && !imageBase64) {
    //     return res.status(400).json({ error: '请求体中缺少 prompt 或 imageBase64 字段' });
    // }
    // 实际应用中可能需要更复杂的验证逻辑


    // 决定使用哪个 OpenAI 客户端实例
    let currentOpenai;
    if (baseUrl) {
        // 如果请求中提供了 Base URL，创建一个使用该 URL 的新实例
        try {
             currentOpenai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
                baseURL: baseUrl, // 使用请求中提供的 Base URL
            });
             console.log(`使用自定义 Base URL: ${baseUrl}`);
        } catch(urlError) {
             console.error(`创建使用 Base URL "${baseUrl}" 的 OpenAI 实例时出错:`, urlError);
             return res.status(400).json({ error: `无效的 Base URL: ${urlError.message}` });
        }
    } else {
        // 否则使用默认的全局实例
        currentOpenai = defaultOpenai;
        console.log(`使用默认 OpenAI Base URL`);
    }

    // 确定要使用的模型名称，如果前端没传，则使用默认值
    const modelToUse = model || "gpt-3.5-turbo";

    try {
        // 设置 SSE 响应头
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders(); // 发送头部信息

        // 使用 messages 数组中的信息记录日志 (messages 来自 req.body)
        const lastUserMessageContent = messages[messages.length - 1]?.content;
        let logPrompt = '(无文本)';
        let logImage = 'No';
        if (Array.isArray(lastUserMessageContent)) {
            const textPart = lastUserMessageContent.find(part => part.type === 'text');
            const imagePart = lastUserMessageContent.find(part => part.type === 'image_url');
            if (textPart) logPrompt = textPart.text.substring(0, 50) + (textPart.text.length > 50 ? '...' : ''); // 截断长文本
            if (imagePart) logImage = 'Yes';
        } else if (typeof lastUserMessageContent === 'string') { // 兼容旧格式或纯文本
             logPrompt = lastUserMessageContent.substring(0, 50) + (lastUserMessageContent.length > 50 ? '...' : '');
        }
        console.log(`收到请求，Model: ${modelToUse}, Last Prompt: ${logPrompt}, Image in last msg: ${logImage}`);

        // 不再需要在后端构建 messages，直接使用前端传来的 history (名为 messages)

        // 调用 OpenAI Chat Completions API (启用流式响应)
        const stream = await currentOpenai.chat.completions.create({
            model: modelToUse, // 使用前端指定的模型
            messages: messages, // 直接使用前端发送的对话历史 (messages 变量来自 req.body)
            stream: true, // <--- 启用流式响应
            // max_tokens: 1000 // 对于包含图片的请求，可能需要调整 max_tokens
            // temperature: 0.7,
            // max_tokens: 150,
        });

        // 处理流式响应
        for await (const chunk of stream) {
            const contentDelta = chunk.choices[0]?.delta?.content;
            if (contentDelta) {
                // 发送数据块到前端
                res.write(`data: ${JSON.stringify({ delta: contentDelta })}\n\n`);
            }
             // 可以在这里检查 finish_reason 来确定流是否结束，但更可靠的是在循环结束后发送 [DONE]
             if (chunk.choices[0]?.finish_reason) {
                 console.log("Stream finished with reason:", chunk.choices[0].finish_reason);
             }
        }

        // 发送流结束信号
        res.write('data: [DONE]\n\n');
        res.end(); // 结束响应

    } catch (error) {
        console.error('处理流式 API 调用时出错:', error);
        // 如果头部已发送，无法再发送 JSON 错误，只能尝试发送 SSE 错误事件
        if (!res.headersSent) {
             res.status(500).json({ error: `调用 OpenAI API 时出错: ${error.message}` });
        } else {
             // 尝试发送一个错误事件（前端需要能解析这个）
             res.write(`event: error\ndata: ${JSON.stringify({ message: error.message || '流处理时发生未知错误' })}\n\n`);
             res.end(); // 结束响应
        }
        // 根据错误类型发送更具体的错误信息可能更好
        res.status(500).json({ error: `调用 OpenAI API 时出错: ${error.message}` });
    }
});

// 简单的根路由，用于测试服务器是否运行
app.get('/', (req, res) => {
    res.send('LLM Chatbot Backend is running!');
});

// 启动服务器
app.listen(port, () => {
    console.log(`服务器正在监听 http://localhost:${port}`);
});