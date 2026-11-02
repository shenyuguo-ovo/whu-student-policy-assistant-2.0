# -*- coding: utf-8 -*-
"""
学生事务政策智能咨询与办事指引助手 —— 检索问答原型
====================================================

功能：
1. 加载 knowledge_base/ 下的结构化政策文件（Markdown）；
2. 对学生自然语言提问进行意图识别与关键词检索（字符 n-gram TF-IDF + 余弦相似度）；
3. 组装个性化回答：政策解释、办理流程、材料清单、注意事项、政策来源；
4. 支持 CLI 交互模式与单次提问模式（--q）。

仅依赖 Python 标准库，无第三方依赖。
用法：
    python policy_agent.py                 # 交互模式
    python policy_agent.py --q "大二学生如何申请国家奖学金？"
"""

import argparse
import math
import os
import re
import sys
from collections import Counter

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 项目根目录
KB_DIR = os.path.join(BASE_DIR, "knowledge_base")
TOP_K = 2          # 返回相似度最高的政策条数
MIN_SCORE = 0.03   # 相似度阈值，低于该值视为未命中

# ---------------- 知识库解析 ----------------

SECTIONS = ["申请条件", "办理流程", "申请材料", "注意事项", "政策来源",
            "测评构成", "加分标准", "奖学金等级与金额", "奖励标准",
            "评选项目", "评选条件", "竞赛级别认定", "常见事务一览", "培养方案查询"]

CATEGORY_KEYWORDS = {
    "奖学金": ["奖学金", "国奖", "励志", "助学金", "奖金"],
    "综合测评": ["综合测评", "测评", "加分", "绩点折算", "排名"],
    "竞赛认定": ["竞赛", "比赛", "获奖认定", "创新学分", "挑战杯", "建模"],
    "评奖评优": ["评优", "三好", "优秀学生干部", "优秀毕业生", "荣誉", "先进班集体"],
    "学籍管理": ["学籍", "缓考", "补考", "重修", "转专业", "休学", "复学",
               "培养方案", "毕业审核", "学业预警", "留级", "学分"],
    "推免": ["保研", "推免", "推荐免试", "夏令营", "科研", "论文"],

}


def parse_policy_file(path):
    """解析一份政策 Markdown 文件，返回结构化 dict。"""
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()

    policy = {
        "file": os.path.basename(path),
        "title": "",
        "meta": {},
        "sections": {},   # {节名: 正文}
        "chunks": [],     # [(节名, 正文)] 用于检索
    }

    lines = text.splitlines()
    cur_section = None
    buf = []

    def flush():
        if cur_section and buf:
            body = "\n".join(buf).strip()
            policy["sections"][cur_section] = body
            policy["chunks"].append((cur_section, body))

    for line in lines:
        line = line.rstrip()
        if line.startswith("# ") and not policy["title"]:
            policy["title"] = line[2:].strip()
        elif re.match(r"^[\u4e00-\u9fa5]+：", line) and cur_section is None:
            # 元数据行，如 "分类：奖学金"
            k, _, v = line.partition("：")
            policy["meta"][k.strip()] = v.strip()
        elif line.startswith("## "):
            flush()
            buf = []
            cur_section = line[3:].strip()
        else:
            buf.append(line)
    flush()
    return policy


def load_knowledge_base(kb_dir=KB_DIR):
    """加载知识库目录下所有 .md 政策文件。"""
    if not os.path.isdir(kb_dir):
        print(f"错误：知识库目录不存在：{kb_dir}", file=sys.stderr)
        sys.exit(1)
    policies = []
    for root, dirs, files in os.walk(kb_dir):
        for name in sorted(files):
            if name.endswith(".md"):
                policies.append(parse_policy_file(os.path.join(root, name)))
    if not policies:
        print("错误：知识库为空（未找到 .md 文件）", file=sys.stderr)
        sys.exit(1)
    return policies


# ---------------- 检索：字符 n-gram TF-IDF ----------------

def ngrams(text, n=2):
    """中文按字符 bigram、英文按单词提取特征。"""
    feats = []
    for w in re.findall(r"[a-zA-Z]+", text.lower()):
        if len(w) > 1:
            feats.append(w)
    han = re.sub(r"[^\u4e00-\u9fa5]", "", text)
    if len(han) == 1:
        feats.append(han)
    feats += [han[i:i + n] for i in range(len(han) - n + 1)]
    return feats


class TfidfIndex:
    """对政策块（chunk）建立 TF-IDF 索引并支持余弦相似度检索。"""

    def __init__(self):
        self.docs = []        # [(policy, section, body)]
        self.df = Counter()
        self.doc_vectors = []

    def add(self, policy, section, body):
        tf = Counter(ngrams(f"{policy['title']} {section} {body}"))
        self.docs.append((policy, section, body, tf))
        for term in tf:
            self.df[term] += 1

    def build(self):
        self.N = len(self.docs)
        self.idf = {t: math.log(self.N / c) + 1.0 for t, c in self.df.items()}
        self.doc_vectors = [self._vector(tf) for _, _, _, tf in self.docs]

    def _vector(self, tf):
        return {t: (1 + math.log(c)) * self.idf.get(t, 1.0) for t, c in tf.items()}

    @staticmethod
    def _cosine(v1, v2):
        common = set(v1) & set(v2)
        dot = sum(v1[t] * v2[t] for t in common)
        n1 = math.sqrt(sum(x * x for x in v1.values()))
        n2 = math.sqrt(sum(x * x for x in v2.values()))
        return dot / (n1 * n2) if n1 and n2 else 0.0

    def search(self, query, top_k=TOP_K, category=None):
        qv = self._vector(Counter(ngrams(query)))
        scored = [(self._cosine(qv, dv), i) for i, dv in enumerate(self.doc_vectors)]
        if category:
            scored = [(s, i) for s, i in scored
                      if self.docs[i][0]["meta"].get("分类") == category]
        scored.sort(reverse=True)
        return [(score, self.docs[i][:3]) for score, i in scored[:top_k] if score >= MIN_SCORE]


# ---------------- 查询理解 ----------------

def detect_category(query):
    """根据关键词猜测事项类别。"""
    scores = Counter()
    for cat, kws in CATEGORY_KEYWORDS.items():
        for kw in kws:
            if kw in query:
                scores[cat] += 1
    return scores.most_common(1)[0][0] if scores else None


def extract_profile(query):
    """抽取学生画像信息（年级等）。"""
    profile = {}
    m = re.search(r"(大[一二三四]|研[一二三]|大一|研一)", query)
    if m:
        profile["年级"] = m.group(1)
    m = re.search(r"([\u4e00-\u9fa5]{2,6})专业", query)
    if m and not re.search(r"(转|换|申请|调|想|问|咨询|了解)$", m.group(1)):
        stem = re.sub(r"^(我是|我是|就读于|就读|读|在|于)", "", m.group(1))
        if len(stem) >= 2:
            profile["专业"] = stem + "专业"
    return profile


# ---------------- 回答组装 ----------------

SECTION_LABELS = {
    "申请条件": "📌 申请条件",
    "评选条件": "📌 申请条件",
    "奖学金等级与金额": "💰 等级与金额",
    "奖励标准": "💰 奖励标准",
    "办理流程": "🗂 办理流程",
    "常见事务一览": "🗂 常见事务一览",
    "申请材料": "📋 材料清单",
    "注意事项": "⚠️ 注意事项",
    "政策来源": "📚 政策来源",
}

# 回答时优先展示的章节顺序
ANSWER_ORDER = ["申请条件", "评选条件", "奖学金等级与金额", "奖励标准",
                "办理流程", "常见事务一览", "申请材料", "注意事项", "政策来源"]


def compose_answer(query, hits, profile):
    """将检索命中的政策块组装成面向学生的回答。"""
    if not hits:
        return ("抱歉，暂时没有在知识库中找到与您问题相关的政策。\n"
                "建议：换一个关键词（如\"奖学金\"\"转专业\"\"竞赛加分\"），"
                "或直接咨询学院学生工作办公室。")

    out = []
    if profile:
        out.append("已识别您的身份信息：" + "，".join(f"{k}={v}" for k, v in profile.items()))
        out.append("")

    seen_policies = []
    for score, (policy, section, body) in hits:
        title = policy["title"].replace("（示例数据）", "")
        if title in seen_policies:
            # 同一政策的其他检索块不再重复展示
            continue
        seen_policies.append(title)
        cat = policy["meta"].get("分类", "")
        out.append(f"◆ 相关政策：《{title}》  [类别：{cat}，匹配度 {score:.0%}]")
        out.append("")

        # 展示该政策下与回答相关的核心章节
        for sec in ANSWER_ORDER:
            if sec in policy["sections"]:
                label = SECTION_LABELS.get(sec, sec)
                out.append(label)
                out.append(policy["sections"][sec])
                out.append("")

    if seen_policies:
        out.append("💡 温馨提示：以上内容由 AI 根据公开政策文件整理，仅供参考，")
        out.append("   实际办理请以学校/学院最新官方通知为准；如仍有疑问，请联系发榜负责老师或学院学工办。")
    return "\n".join(out)


# ---------------- 主流程 ----------------

def build_index(policies):
    index = TfidfIndex()
    for p in policies:
        for sec, body in p["chunks"]:
            index.add(p, sec, body)
    index.build()
    return index


def answer_query(index, policies, query):
    """完整问答管线：意图识别 → 检索 → 组装回答。"""
    profile = extract_profile(query)
    cat = detect_category(query)

    hits = []
    if cat:
        # 优先在识别出的政策类别内检索，避免弱相关干扰
        hits = index.search(query, category=cat)
    if not hits:
        hits = index.search(query)
    if not hits and cat:
        # 类别命中但块检索未命中时，取该类别政策的首个块兜底
        for p in policies:
            if p["meta"].get("分类") == cat:
                hits = [(0.0, (p, p["chunks"][0][0], p["chunks"][0][1]))]
                break
    return compose_answer(query, hits, profile)


def main():
    parser = argparse.ArgumentParser(description="学生事务政策智能咨询助手（原型）")
    parser.add_argument("--q", type=str, help="单次提问模式")
    parser.add_argument("--kb", type=str, default=KB_DIR, help="知识库目录")
    args = parser.parse_args()

    policies = load_knowledge_base(args.kb)
    index = build_index(policies)
    print(f"[知识库已加载：{len(policies)} 份政策文件，{len(index.docs)} 个检索块]\n")

    if args.q:
        print(answer_query(index, policies, args.q))
        return

    print("=" * 56)
    print("   学生事务政策智能咨询与办事指引助手（输入 q 退出）")
    print("   可询问：奖学金申请 / 综合测评加分 / 竞赛认定 /")
    print("           评奖评优 / 转专业 / 缓考补考 / 培养方案 等")
    print("=" * 56)
    while True:
        try:
            query = input("\n学生> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n再见！")
            break
        if not query:
            continue
        if query.lower() in {"q", "quit", "exit", "退出"}:
            print("再见！")
            break
        print()
        print(answer_query(index, policies, query))


if __name__ == "__main__":
    main()
