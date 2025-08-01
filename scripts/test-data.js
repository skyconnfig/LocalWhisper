const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function createTestData() {
  console.log('🚀 开始创建测试数据...');

  try {
    // 创建测试用户
    const testUsers = [
      {
        id: 'test-user-1',
        name: '张三',
        email: 'test1@example.com',
        emailVerified: new Date(),
      },
      {
        id: 'test-user-2',
        name: '李四',
        email: 'test2@example.com',
        emailVerified: new Date(),
      }
    ];

    console.log('👥 创建测试用户...');
    for (const user of testUsers) {
      await prisma.user.upsert({
        where: { email: user.email },
        update: {},
        create: user,
      });
    }

    // 创建测试 Whisper 记录
    const testWhispers = [
      {
        id: uuidv4(),
        title: '会议记录 - 产品讨论',
        userId: 'test-user-1',
        fullTranscription: '今天我们讨论了新产品的功能规划，包括用户界面设计、后端架构以及数据库优化方案。会议中提到了需要改进语音识别的准确率，并且考虑增加多语言支持功能。',
      },
      {
        id: uuidv4(),
        title: '客户访谈 - 用户反馈',
        userId: 'test-user-2',
        fullTranscription: '客户对我们的产品整体满意度很高，特别是对语音转文字的功能印象深刻。但是希望能够支持更多的音频格式，同时提高处理速度。客户建议增加实时转录功能。',
      },
      {
        id: uuidv4(),
        title: '培训录音 - 技术分享',
        userId: 'test-user-1',
        fullTranscription: '在今天的技术分享中，我们深入讨论了 PostgreSQL 数据库的优化策略，包括索引设计、查询优化和连接池配置。还分享了 Docker 容器化部署的最佳实践。',
      }
    ];

    console.log('🎙️ 创建测试 Whisper 记录...');
    for (const whisper of testWhispers) {
      await prisma.whisper.upsert({
        where: { id: whisper.id },
        update: {},
        create: whisper,
      });

      // 为每个 Whisper 记录创建音频轨道
      await prisma.audioTrack.create({
        data: {
          id: uuidv4(),
          fileUrl: `http://localhost:9000/audio-files/test-audio-${whisper.id}.mp3`,
          partialTranscription: whisper.fullTranscription.substring(0, 100) + '...',
          whisperId: whisper.id,
          language: 'zh-CN',
        },
      });

      // 创建转换结果
      const transformations = [
        {
          typeName: 'summary',
          text: '会议总结：' + whisper.fullTranscription.substring(0, 50) + '...',
        },
        {
          typeName: 'action_items',
          text: '行动项目：1. 优化用户界面 2. 改进后端性能 3. 增加多语言支持',
        }
      ];

      for (const transformation of transformations) {
        await prisma.transformation.create({
          data: {
            id: uuidv4(),
            whisperId: whisper.id,
            isGenerating: false,
            typeName: transformation.typeName,
            text: transformation.text,
          },
        });
      }
    }

    console.log('✅ 测试数据创建完成！');
    console.log(`   创建了 ${testUsers.length} 个测试用户`);
    console.log(`   创建了 ${testWhispers.length} 个 Whisper 记录`);
    console.log(`   每个记录包含音频轨道和转换结果`);

  } catch (error) {
    console.error('❌ 创建测试数据时出错:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function clearTestData() {
  console.log('🧹 清理测试数据...');

  try {
    // 按正确的顺序删除数据（考虑外键约束）
    await prisma.transformation.deleteMany({});
    await prisma.audioTrack.deleteMany({});
    await prisma.whisper.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.account.deleteMany({});
    await prisma.verificationToken.deleteMany({});
    await prisma.user.deleteMany({});

    console.log('✅ 测试数据清理完成！');
  } catch (error) {
    console.error('❌ 清理测试数据时出错:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 命令行参数处理
const args = process.argv.slice(2);
const command = args[0];

if (command === 'create') {
  createTestData().catch(process.exit);
} else if (command === 'clear') {
  clearTestData().catch(process.exit);
} else {
  console.log('用法:');
  console.log('  node test-data.js create  # 创建测试数据');
  console.log('  node test-data.js clear   # 清理测试数据');
  process.exit(1);
}