#!/usr/bin/env node

/**
 * 本地Whisper服务测试脚本
 * 用于验证faster-whisper是否正确安装和配置
 */

const { checkFasterWhisperAvailability, getAvailableModels, getSupportedLanguages } = require('./lib/localWhisperService');

async function testLocalWhisperService() {
  console.log('🔍 检查本地Whisper服务...\n');

  try {
    // 1. 检查faster-whisper是否可用
    console.log('1. 检查faster-whisper可用性...');
    const isAvailable = await checkFasterWhisperAvailability();
    
    if (isAvailable) {
      console.log('✅ faster-whisper 已安装并可用');
    } else {
      console.log('❌ faster-whisper 未找到');
      console.log('请运行: pip install faster-whisper');
      return;
    }

    // 2. 显示可用模型
    console.log('\n2. 可用的Whisper模型:');
    const models = getAvailableModels();
    models.forEach(model => {
      console.log(`   - ${model}`);
    });

    // 3. 显示支持的语言
    console.log('\n3. 支持的语言 (前10种):');
    const languages = getSupportedLanguages().slice(0, 10);
    languages.forEach(lang => {
      console.log(`   - ${lang.code}: ${lang.name}`);
    });
    console.log('   ... 等更多语言');

    console.log('\n✅ 本地Whisper服务配置检查完成！');
    console.log('\n📝 使用说明:');
    console.log('   - 默认模型: base');
    console.log('   - 推荐生产模型: medium');
    console.log('   - 高精度模型: large-v3');
    console.log('   - 配置环境变量 WHISPER_MODEL 来改变默认模型');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.log('\n🔧 故障排除建议:');
    console.log('   1. 确保Python已安装 (python --version)');
    console.log('   2. 安装faster-whisper: pip install faster-whisper');
    console.log('   3. 检查PATH环境变量包含Python scripts目录');
  }
}

// 运行测试
if (require.main === module) {
  testLocalWhisperService().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('测试脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = { testLocalWhisperService };