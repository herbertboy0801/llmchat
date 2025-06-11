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
    // 从请求体中获取 prompt, model, baseUrl, imageBase64, imageType
    const { prompt, model, baseUrl, imageBase64, imageType } = req.body;

    // 注意：即使有图片，prompt 也可以为空
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
        console.log(`收到请求，Prompt: ${prompt || '(无文本)'}, Model: ${modelToUse}, Image: ${imageBase64 ? 'Yes' : 'No'}`);

        // 构建发送给 OpenAI 的消息体 (支持 Vision)
        const messages = [];
        const userContent = [];
        if (prompt) {
            userContent.push({ type: "text", text: prompt });
        }
        if (imageBase64 && imageType) {
            // 后端接收到的是纯 base64，需要加上 Data URL 前缀
            userContent.push({
                type: "image_url",
                image_url: { "url": `data:${imageType};base64,${imageBase64}` }
            });
        }

        if (userContent.length > 0) {
             messages.push({ role: "user", content: userContent });
        } else {
             // 如果既没有文本也没有图片，则返回错误（虽然前端应该已阻止这种情况）
             return res.status(400).json({ error: '没有有效的文本或图片内容发送' });
        }


        // 调用 OpenAI Chat Completions API (使用选定的客户端实例和模型)
        const completion = await currentOpenai.chat.completions.create({
            model: modelToUse, // 使用前端指定的模型
            messages: messages, // 使用构建好的消息体
            // max_tokens: 1000 // 对于包含图片的请求，可能需要调整 max_tokens
            // temperature: 0.7,
            // max_tokens: 150,
        });

        // 提取模型的回复内容
        const reply = completion.choices[0]?.message?.content?.trim();

        if (reply) {
            console.log(`模型回复: ${reply}`);
            res.json({ reply: reply }); // 将回复发送回前端
        } else {
            console.error('未能从 OpenAI 获取有效回复');
            res.status(500).json({ error: '未能从 OpenAI 获取有效回复' });
        }

    } catch (error) {
        console.error('调用 OpenAI API 时出错:', error);
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