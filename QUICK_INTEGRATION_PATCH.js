/**
 * 本地LLM服务快速集成补丁
 * 
 * 将此代码替换app/api/transform/route.ts中的第75-79行:
 * 
 * 原代码:
 * const aiClient = togetherVercelAiClient(apiKey);
 * const { textStream } = streamText({
 *   model: aiClient("meta-llama/Meta-Llama-3-70B-Instruct-Turbo"),
 *   prompt,
 * });
 */

// 1. 首先在文件顶部添加import (在现有imports后面)
import { createUnifiedLLMClient, checkOllamaHealth } from "@/lib/apiClients";

// 2. 将第75-79行替换为以下代码:

  // 检查是否启用本地LLM
  const useLocalLLM = process.env.USE_LOCAL_LLM === "true" || 
                     req.headers.get("X-Use-Local-LLM") === "true";
  let aiClient;
  let model;
  
  if (useLocalLLM) {
    try {
      // 检查Ollama服务健康状态
      const healthCheck = await checkOllamaHealth();
      if (healthCheck.status === 'healthy') {
        console.log("✅ 使用本地LLM服务 (Ollama)");
        aiClient = createUnifiedLLMClient(true);
        // 智能选择模型：根据转录内容语言自动选择中文或英文模型
        model = aiClient(whisper.fullTranscription);
      } else {
        console.warn("⚠️ 本地LLM不可用，回退到Together.ai:", healthCheck.error);
        aiClient = togetherVercelAiClient(apiKey); 
        model = aiClient("meta-llama/Meta-Llama-3-70B-Instruct-Turbo");
      }
    } catch (error) {
      console.error("❌ 本地LLM检查失败，回退到Together.ai:", error);
      aiClient = togetherVercelAiClient(apiKey);
      model = aiClient("meta-llama/Meta-Llama-3-70B-Instruct-Turbo");
    }
  } else {
    console.log("🌐 使用Together.ai服务");
    aiClient = togetherVercelAiClient(apiKey);
    model = aiClient("meta-llama/Meta-Llama-3-70B-Instruct-Turbo");
  }

  // 开始流式处理 (保持原有的streamText调用)
  const { textStream } = await streamText({
    model,
    prompt,
  });

// 3. 在return Response的headers中添加服务标识 (可选):
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Accel-Buffering": "no", 
      "Cache-Control": "no-cache",
      "X-LLM-Service": useLocalLLM ? "local-ollama" : "together-ai", // 添加这行
    },
  });

/**
 * 使用步骤:
 * 
 * 1. 确保已创建 /lib/localLLMService.ts 文件
 * 2. 更新 /lib/apiClients.ts 文件 (添加本地LLM导出)
 * 3. 在 .env.local 中设置: USE_LOCAL_LLM=true
 * 4. 安装并运行Ollama: 
 *    - ollama pull qwen2.5:7b
 *    - ollama pull llama3.1:8b  
 *    - ollama serve
 * 5. 重启应用: npm run dev
 * 
 * 功能:
 * - 自动语言检测 (中文用qwen2.5:7b, 英文用llama3.1:8b)
 * - 健康检查和自动回退
 * - 错误处理和重试机制
 * - 与现有API完全兼容
 */