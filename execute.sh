# npm i

# 获取脚本所在目录的绝对路径
SCRIPT_DIR=$(readlink -f "$1")

# 获取传递的文件的绝对路径
ABSOLUTE_FILE="$SCRIPT_DIR"

echo "待分析文件的绝对路径是：$ABSOLUTE_FILE"
sudo node main.js "$1" "$2"