#!/usr/bin/env node

/**
 * 本地LLM服务健康检查和测试脚本
 * 使用方法: node scripts/test-local-llm.js
 */

const { checkOllamaHealth, ensureModelsAvailable } = require('../lib/localLLMService');

async function main() {
  console.log('🔍 检查本地LLM服务状态...\n');

  // 1. 健康检查
  console.log('1. Ollama服务健康检查:');
  try {
    const health = await checkOllamaHealth();
    if (health.status === 'healthy') {
      console.log('   ✅ Ollama服务运行正常');
    } else {
      console.log('   ❌ Ollama服务异常:', health.error);
      return;
    }
  } catch (error) {
    console.log('   ❌ 检查失败:', error.message);
    return;
  }

  // 2. 模型检查
  console.log('\n2. 必需模型检查:');
  try {
    const models = await ensureModelsAvailable();
    if (models.success) {
      console.log('   ✅', models.message);
    } else {
      console.log('   ⚠️ ', models.message);
      console.log('   💡 请运行以下命令安装缺失的模型:');
      console.log('      ollama pull qwen2.5:7b');
      console.log('      ollama pull llama3.1:8b');
    }
  } catch (error) {
    console.log('   ❌ 检查失败:', error.message);
  }

  // 3. 语言检测测试
  console.log('\n3. 语言检测测试:');
  const { localLLMClient } = require('../lib/localLLMService');
  
  const testCases = [
    { text: "Hello, this is an English text for testing.", expected: "llama3.1:8b" },
    { text: "你好，这是一段中文测试文本。", expected: "qwen2.5:7b" },
    { text: "This is mixed content with some 中文 characters.", expected: "qwen2.5:7b" }
  ];

  testCases.forEach((testCase, index) => {
    try {
      const client = localLLMClient(testCase.text);
      const modelId = client.modelId;
      const isCorrect = modelId === testCase.expected;
      console.log(`   测试 ${index + 1}: ${isCorrect ? '✅' : '❌'} "${testCase.text.substring(0, 30)}..." -> ${modelId}`);
    } catch (error) {
      console.log(`   测试 ${index + 1}: ❌ 错误:`, error.message);
    }
  });

  console.log('\n✨ 测试完成!');
  console.log('\n📋 使用指南:');
  console.log('   - 设置环境变量: USE_LOCAL_LLM=true');
  console.log('   - 确保Ollama服务运行: ollama serve');
  console.log('   - 启动应用: npm run dev');
  console.log('\n🔗 更多信息请查看: LOCAL_LLM_INTEGRATION_GUIDE.md');
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };