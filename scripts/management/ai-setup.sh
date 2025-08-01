#!/bin/bash

# Whisper App AI模型配置和下载脚本
# 用于下载、配置和管理本地AI模型

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MODELS_DIR="$PROJECT_ROOT/models"
LOG_FILE="$PROJECT_ROOT/logs/ai-setup.log"

# 创建目录
mkdir -p "$MODELS_DIR/whisper" "$MODELS_DIR/llm" "$(dirname "$LOG_FILE")"

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1" >> "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $1" >> "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARNING] $1" >> "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1" >> "$LOG_FILE"
}

# AI模型配置
WHISPER_MODELS=(
    "tiny:39MB:最小模型，速度最快，准确性一般"
    "base:74MB:基础模型，平衡速度和准确性"
    "small:244MB:小型模型，准确性较好"
    "medium:769MB:中型模型，准确性高"
    "large:1550MB:大型模型，准确性最高"
)

LLM_MODELS=(
    "microsoft/DialoGPT-small:117MB:对话模型，适合简单对话"
    "microsoft/DialoGPT-medium:345MB:对话模型，平衡性能"
    "microsoft/DialoGPT-large:774MB:对话模型，高质量输出"
    "distilbert-base-uncased:268MB:轻量级BERT模型"
    "bert-base-uncased:440MB:标准BERT模型"
)

# 显示帮助信息
show_help() {
    echo "AI模型配置工具"
    echo ""
    echo "用法: $0 <命令> [选项]"
    echo ""
    echo "命令:"
    echo "  list        列出可用模型"
    echo "  install     安装模型"
    echo "  remove      删除模型"
    echo "  status      查看模型状态"
    echo "  test        测试模型"
    echo "  setup       交互式设置"
    echo ""
    echo "选项:"
    echo "  --model <name>    指定模型名称"
    echo "  --type <type>     指定模型类型 (whisper/llm)"
    echo "  --force           强制操作"
    echo "  --help            显示帮助信息"
}

# 检查Python环境
check_python_environment() {
    log_info "检查Python环境..."
    
    if ! command -v python3 > /dev/null; then
        log_error "Python3未安装"
        return 1
    fi
    
    local python_version=$(python3 --version | cut -d' ' -f2)
    log_success "Python版本: $python_version"
    
    # 检查pip
    if ! command -v pip3 > /dev/null; then
        log_error "pip3未安装"
        return 1
    fi
    
    # 检查虚拟环境
    if [ ! -d "$PROJECT_ROOT/venv" ]; then
        log_info "创建Python虚拟环境..."
        python3 -m venv "$PROJECT_ROOT/venv"
    fi
    
    # 激活虚拟环境
    source "$PROJECT_ROOT/venv/bin/activate"
    
    # 安装基础依赖
    log_info "安装Python依赖..."
    pip install --upgrade pip
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
    pip install transformers
    pip install openai-whisper
    pip install requests
    pip install flask
    
    log_success "Python环境配置完成"
}

# 列出可用模型
list_models() {
    echo ""
    echo -e "${GREEN}可用的Whisper模型:${NC}"
    echo "名称       大小      描述"
    echo "----------------------------------------"
    
    for model in "${WHISPER_MODELS[@]}"; do
        IFS=':' read -r name size desc <<< "$model"
        printf "%-10s %-8s %s\n" "$name" "$size" "$desc"
    done
    
    echo ""
    echo -e "${GREEN}可用的LLM模型:${NC}"
    echo "名称                    大小      描述"
    echo "----------------------------------------"
    
    for model in "${LLM_MODELS[@]}"; do
        IFS=':' read -r name size desc <<< "$model"
        printf "%-22s %-8s %s\n" "$name" "$size" "$desc"
    done
    
    echo ""
    echo -e "${GREEN}已安装的模型:${NC}"
    show_installed_models
}

# 显示已安装的模型
show_installed_models() {
    local whisper_models=$(find "$MODELS_DIR/whisper" -name "*.pt" 2>/dev/null | wc -l)
    local llm_models=$(find "$MODELS_DIR/llm" -type d -mindepth 1 2>/dev/null | wc -l)
    
    echo "Whisper模型: $whisper_models 个"
    echo "LLM模型: $llm_models 个"
    
    if [ "$whisper_models" -gt 0 ]; then
        echo "  Whisper模型列表:"
        find "$MODELS_DIR/whisper" -name "*.pt" -exec basename {} .pt \; 2>/dev/null | sed 's/^/    - /'
    fi
    
    if [ "$llm_models" -gt 0 ]; then
        echo "  LLM模型列表:"
        find "$MODELS_DIR/llm" -type d -mindepth 1 -exec basename {} \; 2>/dev/null | sed 's/^/    - /'
    fi
}

# 安装Whisper模型
install_whisper_model() {
    local model_name=$1
    
    log_info "安装Whisper模型: $model_name"
    
    # 检查模型是否存在
    local model_found=false
    for model in "${WHISPER_MODELS[@]}"; do
        IFS=':' read -r name size desc <<< "$model"
        if [ "$name" = "$model_name" ]; then
            model_found=true
            break
        fi
    done
    
    if [ "$model_found" = false ]; then
        log_error "未知的Whisper模型: $model_name"
        return 1
    fi
    
    # 检查是否已安装
    if [ -f "$MODELS_DIR/whisper/${model_name}.pt" ]; then
        log_warning "模型已存在: $model_name"
        return 0
    fi
    
    # 创建Python脚本下载模型
    cat > /tmp/download_whisper.py << EOF
import whisper
import os

model_name = "$model_name"
models_dir = "$MODELS_DIR/whisper"

print(f"下载Whisper模型: {model_name}")
model = whisper.load_model(model_name, download_root=models_dir)
print(f"模型下载完成: {model_name}")
EOF
    
    # 激活虚拟环境并运行下载脚本
    source "$PROJECT_ROOT/venv/bin/activate"
    python /tmp/download_whisper.py
    
    if [ $? -eq 0 ]; then
        log_success "Whisper模型安装成功: $model_name"
    else
        log_error "Whisper模型安装失败: $model_name"
        return 1
    fi
    
    rm -f /tmp/download_whisper.py
}

# 安装LLM模型
install_llm_model() {
    local model_name=$1
    
    log_info "安装LLM模型: $model_name"
    
    # 检查模型是否存在
    local model_found=false
    for model in "${LLM_MODELS[@]}"; do
        IFS=':' read -r name size desc <<< "$model"
        if [ "$name" = "$model_name" ]; then
            model_found=true
            break
        fi
    done
    
    if [ "$model_found" = false ]; then
        log_error "未知的LLM模型: $model_name"
        return 1
    fi
    
    # 检查是否已安装
    local model_dir="$MODELS_DIR/llm/$(basename "$model_name")"
    if [ -d "$model_dir" ]; then
        log_warning "模型已存在: $model_name"
        return 0
    fi
    
    # 创建Python脚本下载模型
    cat > /tmp/download_llm.py << EOF
from transformers import AutoTokenizer, AutoModel
import os

model_name = "$model_name"
models_dir = "$MODELS_DIR/llm"
model_dir = os.path.join(models_dir, os.path.basename(model_name))

print(f"下载LLM模型: {model_name}")
try:
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModel.from_pretrained(model_name)
    
    # 保存到本地
    tokenizer.save_pretrained(model_dir)
    model.save_pretrained(model_dir)
    
    print(f"模型下载完成: {model_name}")
    print(f"保存位置: {model_dir}")
except Exception as e:
    print(f"下载失败: {e}")
    exit(1)
EOF
    
    # 激活虚拟环境并运行下载脚本
    source "$PROJECT_ROOT/venv/bin/activate"
    python /tmp/download_llm.py
    
    if [ $? -eq 0 ]; then
        log_success "LLM模型安装成功: $model_name"
    else
        log_error "LLM模型安装失败: $model_name"
        return 1
    fi
    
    rm -f /tmp/download_llm.py
}

# 删除模型
remove_model() {
    local model_type=$1
    local model_name=$2
    
    log_info "删除模型: $model_type/$model_name"
    
    case $model_type in
        "whisper")
            local model_file="$MODELS_DIR/whisper/${model_name}.pt"
            if [ -f "$model_file" ]; then
                rm -f "$model_file"
                log_success "Whisper模型已删除: $model_name"
            else
                log_warning "Whisper模型不存在: $model_name"
            fi
            ;;
        "llm")
            local model_dir="$MODELS_DIR/llm/$model_name"
            if [ -d "$model_dir" ]; then
                rm -rf "$model_dir"
                log_success "LLM模型已删除: $model_name"
            else
                log_warning "LLM模型不存在: $model_name"
            fi
            ;;
        *)
            log_error "未知的模型类型: $model_type"
            return 1
            ;;
    esac
}

# 测试Whisper模型
test_whisper_model() {
    local model_name=$1
    
    log_info "测试Whisper模型: $model_name"
    
    # 创建测试脚本
    cat > /tmp/test_whisper.py << EOF
import whisper
import numpy as np

model_name = "$model_name"
models_dir = "$MODELS_DIR/whisper"

try:
    print(f"加载Whisper模型: {model_name}")
    model = whisper.load_model(model_name, download_root=models_dir)
    
    # 创建测试音频数据 (1秒的正弦波)
    sample_rate = 16000
    duration = 1.0
    frequency = 440.0  # A4音符
    
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    audio = np.sin(frequency * 2 * np.pi * t).astype(np.float32)
    
    print("执行转录测试...")
    result = model.transcribe(audio)
    
    print(f"模型测试成功: {model_name}")
    print(f"测试结果: {result.get('text', 'No text detected')}")
    
except Exception as e:
    print(f"模型测试失败: {e}")
    exit(1)
EOF
    
    source "$PROJECT_ROOT/venv/bin/activate"
    python /tmp/test_whisper.py
    
    if [ $? -eq 0 ]; then
        log_success "Whisper模型测试通过: $model_name"
    else
        log_error "Whisper模型测试失败: $model_name"
        return 1
    fi
    
    rm -f /tmp/test_whisper.py
}

# 测试LLM模型
test_llm_model() {
    local model_name=$1
    
    log_info "测试LLM模型: $model_name"
    
    # 创建测试脚本
    cat > /tmp/test_llm.py << EOF
from transformers import AutoTokenizer, AutoModel
import os

model_name = "$model_name"
models_dir = "$MODELS_DIR/llm"
model_dir = os.path.join(models_dir, os.path.basename(model_name))

try:
    print(f"加载LLM模型: {model_name}")
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModel.from_pretrained(model_dir)
    
    # 测试tokenizer
    test_text = "Hello, how are you?"
    tokens = tokenizer.encode(test_text, return_tensors='pt')
    
    print(f"模型测试成功: {model_name}")
    print(f"测试文本: {test_text}")
    print(f"Token数量: {tokens.shape[1]}")
    
except Exception as e:
    print(f"模型测试失败: {e}")
    exit(1)
EOF
    
    source "$PROJECT_ROOT/venv/bin/activate"
    python /tmp/test_llm.py
    
    if [ $? -eq 0 ]; then
        log_success "LLM模型测试通过: $model_name"
    else
        log_error "LLM模型测试失败: $model_name"
        return 1
    fi
    
    rm -f /tmp/test_llm.py
}

# 创建模型服务器
create_model_servers() {
    log_info "创建AI模型服务器..."
    
    # 创建Whisper服务器
    cat > "$PROJECT_ROOT/scripts/whisper-server.py" << 'EOF'
#!/usr/bin/env python3
import whisper
import tempfile
import os
import json
from flask import Flask, request, jsonify
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# 配置
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'models', 'whisper')
DEFAULT_MODEL = os.environ.get('LOCAL_WHISPER_MODEL', 'base')

# 加载模型
model = None

def load_model(model_name=DEFAULT_MODEL):
    global model
    try:
        logging.info(f"Loading Whisper model: {model_name}")
        model = whisper.load_model(model_name, download_root=MODELS_DIR)
        logging.info(f"Model loaded successfully: {model_name}")
        return True
    except Exception as e:
        logging.error(f"Failed to load model {model_name}: {e}")
        return False

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "model_loaded": model is not None})

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    if model is None:
        return jsonify({"error": "Model not loaded"}), 500
    
    try:
        # 获取音频文件
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file provided"}), 400
        
        audio_file = request.files['audio']
        language = request.form.get('language', 'auto')
        
        # 保存临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
            audio_file.save(tmp_file.name)
            
            # 执行转录
            options = {"language": None if language == 'auto' else language}
            result = model.transcribe(tmp_file.name, **options)
            
            # 清理临时文件
            os.unlink(tmp_file.name)
            
            return jsonify({
                "text": result["text"],
                "language": result.get("language"),
                "segments": result.get("segments", [])
            })
    
    except Exception as e:
        logging.error(f"Transcription error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    if load_model():
        port = int(os.environ.get('LOCAL_WHISPER_PORT', 8002))
        app.run(host='0.0.0.0', port=port, debug=False)
    else:
        logging.error("Failed to start Whisper server")
        exit(1)
EOF
    
    # 创建LLM服务器
    cat > "$PROJECT_ROOT/scripts/llm-server.py" << 'EOF'
#!/usr/bin/env python3
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
import os
import json
from flask import Flask, request, jsonify
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# 配置
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'models', 'llm')
DEFAULT_MODEL = os.environ.get('LOCAL_LLM_MODEL', 'microsoft/DialoGPT-medium')

# 加载模型
tokenizer = None
model = None
generator = None

def load_model(model_name=DEFAULT_MODEL):
    global tokenizer, model, generator
    try:
        logging.info(f"Loading LLM model: {model_name}")
        model_dir = os.path.join(MODELS_DIR, os.path.basename(model_name))
        
        if os.path.exists(model_dir):
            # 从本地加载
            tokenizer = AutoTokenizer.from_pretrained(model_dir)
            model = AutoModelForCausalLM.from_pretrained(model_dir)
        else:
            # 从Hugging Face加载
            tokenizer = AutoTokenizer.from_pretrained(model_name)
            model = AutoModelForCausalLM.from_pretrained(model_name)
        
        # 创建生成器
        generator = pipeline('text-generation', model=model, tokenizer=tokenizer)
        
        logging.info(f"Model loaded successfully: {model_name}")
        return True
    except Exception as e:
        logging.error(f"Failed to load model {model_name}: {e}")
        return False

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "model_loaded": model is not None})

@app.route('/generate', methods=['POST'])
def generate_text():
    if generator is None:
        return jsonify({"error": "Model not loaded"}), 500
    
    try:
        data = request.get_json()
        if not data or 'prompt' not in data:
            return jsonify({"error": "No prompt provided"}), 400
        
        prompt = data['prompt']
        max_length = data.get('max_length', 100)
        temperature = data.get('temperature', 0.7)
        
        # 生成文本
        result = generator(
            prompt,
            max_length=max_length,
            temperature=temperature,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
        
        return jsonify({
            "generated_text": result[0]['generated_text'],
            "prompt": prompt
        })
    
    except Exception as e:
        logging.error(f"Generation error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    if load_model():
        port = int(os.environ.get('LOCAL_LLM_PORT', 8001))
        app.run(host='0.0.0.0', port=port, debug=False)
    else:
        logging.error("Failed to start LLM server")
        exit(1)
EOF
    
    # 设置执行权限
    chmod +x "$PROJECT_ROOT/scripts/whisper-server.py"
    chmod +x "$PROJECT_ROOT/scripts/llm-server.py"
    
    log_success "AI模型服务器创建完成"
}

# 交互式设置
interactive_setup() {
    log_info "开始交互式AI模型设置..."
    
    # 检查Python环境
    if ! check_python_environment; then
        log_error "Python环境检查失败，请手动安装Python3和pip"
        return 1
    fi
    
    echo ""
    echo "=== Whisper模型设置 ==="
    echo "建议选择以下模型之一:"
    echo "  - base: 平衡性能和准确性 (推荐)"
    echo "  - small: 更高准确性，较慢"
    echo "  - tiny: 最快速度，准确性一般"
    echo ""
    
    read -p "选择Whisper模型 (base/small/tiny) [base]: " whisper_choice
    whisper_choice=${whisper_choice:-base}
    
    if install_whisper_model "$whisper_choice"; then
        test_whisper_model "$whisper_choice"
    fi
    
    echo ""
    echo "=== LLM模型设置 ==="
    echo "建议选择以下模型之一:"
    echo "  - microsoft/DialoGPT-medium: 对话模型 (推荐)"
    echo "  - microsoft/DialoGPT-small: 轻量级对话模型"
    echo "  - distilbert-base-uncased: 文本理解模型"
    echo ""
    
    read -p "选择LLM模型 (DialoGPT-medium/DialoGPT-small/distilbert-base-uncased) [DialoGPT-medium]: " llm_choice
    case ${llm_choice:-DialoGPT-medium} in
        "DialoGPT-medium")
            llm_model="microsoft/DialoGPT-medium"
            ;;
        "DialoGPT-small")
            llm_model="microsoft/DialoGPT-small"
            ;;
        "distilbert-base-uncased")
            llm_model="distilbert-base-uncased"
            ;;
        *)
            llm_model="microsoft/DialoGPT-medium"
            ;;
    esac
    
    if install_llm_model "$llm_model"; then
        test_llm_model "$llm_model"
    fi
    
    # 创建模型服务器
    create_model_servers
    
    echo ""
    log_success "AI模型设置完成！"
    echo ""
    echo "下一步:"
    echo "  1. 启动Whisper服务器: python scripts/whisper-server.py"
    echo "  2. 启动LLM服务器: python scripts/llm-server.py"
    echo "  3. 或使用服务管理脚本自动启动所有服务"
}

# 主函数
main() {
    local command=${1:-"setup"}
    local model_type=""
    local model_name=""
    local force=false
    
    # 解析参数
    shift
    while [[ $# -gt 0 ]]; do
        case $1 in
            --model)
                model_name="$2"
                shift 2
                ;;
            --type)
                model_type="$2"
                shift 2
                ;;
            --force)
                force=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                break
                ;;
        esac
    done
    
    # 执行命令
    case $command in
        "list")
            list_models
            ;;
        "install")
            if [ -z "$model_name" ] || [ -z "$model_type" ]; then
                log_error "请指定模型名称和类型"
                echo "示例: $0 install --type whisper --model base"
                exit 1
            fi
            
            check_python_environment
            
            if [ "$model_type" = "whisper" ]; then
                install_whisper_model "$model_name"
            elif [ "$model_type" = "llm" ]; then
                install_llm_model "$model_name"
            else
                log_error "无效的模型类型: $model_type"
                exit 1
            fi
            ;;
        "remove")
            if [ -z "$model_name" ] || [ -z "$model_type" ]; then
                log_error "请指定模型名称和类型"
                exit 1
            fi
            remove_model "$model_type" "$model_name"
            ;;
        "test")
            if [ -z "$model_name" ] || [ -z "$model_type" ]; then
                log_error "请指定模型名称和类型"
                exit 1
            fi
            
            check_python_environment
            
            if [ "$model_type" = "whisper" ]; then
                test_whisper_model "$model_name"
            elif [ "$model_type" = "llm" ]; then
                test_llm_model "$model_name"
            else
                log_error "无效的模型类型: $model_type"
                exit 1
            fi
            ;;
        "status")
            show_installed_models
            ;;
        "setup")
            interactive_setup
            ;;
        *)
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"