# 武汉大学学生事务智能咨询助手（本地原型 V2.1）

## 运行方式（Windows + VS Code）

1. **先完整解压 ZIP**，不要从 ZIP 预览页或临时目录运行代码。
2. 在 VS Code 中选择“文件 → 打开文件夹”，打开解压后的 `student-affairs-policy-assistant` 文件夹。
3. 终端进入 `backend` 文件夹：

   ```powershell
   cd backend
   python server.py
   ```

4. 终端看到“服务器已启动：http://127.0.0.1:8000”后保持该终端运行。
5. 在 VS Code 左侧打开 `frontend/index.html`，右键选择 **Open with Live Server**。
6. 在浏览器输入问题并点击“查询”。也可以先访问 `http://127.0.0.1:8000/health` 检查后端。

## 项目结构

- `frontend/`：网页界面
- `backend/server.py`：本地 HTTP API，处理 OPTIONS 跨域预检与 POST 问答请求
- `scripts/policy_agent.py`：关键词/TF-IDF 政策检索代码
- `knowledge_base/`：Markdown 知识库

## 重要说明

当前知识库文件含有“示例数据”及示例来源占位内容，用于验证技术流程，并非已经核验的武汉大学最新官方政策原文。正式展示前，请用从学校/学院官网收集并核实的原始文件替换或校订这些示例内容。

本版本仅使用 Python 标准库，不需要额外安装 FastAPI 等依赖。
