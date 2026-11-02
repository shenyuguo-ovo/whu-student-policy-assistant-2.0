# -*- coding: utf-8 -*-
"""学生事务智能咨询助手的本地 HTTP 后端。"""
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import json
import sys

# 根据当前文件的位置计算项目路径，不依赖启动命令所在目录。
PROJECT_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = PROJECT_DIR / "scripts"
KNOWLEDGE_BASE_DIR = PROJECT_DIR / "knowledge_base"

if not SCRIPTS_DIR.is_dir():
    raise FileNotFoundError(
        f"没有找到 scripts 文件夹：{SCRIPTS_DIR}\n"
        "请将 ZIP 完整解压，并从项目根目录中的 backend/server.py 启动。"
    )
if not KNOWLEDGE_BASE_DIR.is_dir():
    raise FileNotFoundError(
        f"没有找到 knowledge_base 文件夹：{KNOWLEDGE_BASE_DIR}\n"
        "请确认项目文件夹结构完整。"
    )

sys.path.insert(0, str(SCRIPTS_DIR))

# 注意：原始 policy_agent.py 的 answer_query 需要 index、policies、query 三个参数，
# 不能直接写成 answer_query(question)。这里在启动时建立索引，然后统一封装接口。
from policy_agent import load_knowledge_base, build_index, answer_query

policies = load_knowledge_base(str(KNOWLEDGE_BASE_DIR))
index = build_index(policies)


def answer_question(question: str) -> str:
    """接收一个问题并返回检索回答，供网页接口调用。"""
    return answer_query(index, policies, question)


class Handler(BaseHTTPRequestHandler):
    def end_headers(self):
        # 允许本地 Live Server 页面请求后端。
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def send_json(self, status_code: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        # 浏览器真正发 POST 前可能先发送 OPTIONS 预检请求。
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path in ("/", "/health"):
            self.send_json(200, {
                "status": "ok",
                "message": "学生事务政策助手后端运行正常",
                "policy_files": len(policies),
                "search_chunks": len(index.docs),
            })
        else:
            self.send_json(404, {"error": "接口不存在"})

    def do_POST(self):
        if self.path != "/ask":
            self.send_json(404, {"error": "接口不存在，请使用 /ask"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0:
                self.send_json(400, {"error": "请求内容为空"})
                return

            body = json.loads(self.rfile.read(length).decode("utf-8"))
            question = str(body.get("question", "")).strip()
            if not question:
                self.send_json(400, {"error": "请先输入问题"})
                return

            answer = answer_question(question)
            self.send_json(200, {"answer": answer})

        except json.JSONDecodeError:
            self.send_json(400, {"error": "请求不是有效的 JSON"})
        except Exception as exc:
            print(f"处理 /ask 时发生错误：{exc}", file=sys.stderr)
            self.send_json(500, {"error": f"后端处理失败：{exc}"})

    def log_message(self, fmt, *args):
        print("[HTTP] " + (fmt % args))


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", 8000), Handler)
    print(f"项目目录：{PROJECT_DIR}")
    print(f"知识库加载完成：{len(policies)} 份文件，{len(index.docs)} 个检索块")
    print("服务器已启动：http://127.0.0.1:8000")
    print("健康检查：http://127.0.0.1:8000/health")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务器已停止。")
    finally:
        server.server_close()
