import os
import re
import json
import math
from datetime import datetime
from typing import List, Dict


def read_file_contents(path: str) -> str:
    try:
        with open(path, "r", errors="ignore") as f:
            return f.read()
    except Exception:
        return ""

def get_file_metadata(path: str) -> Dict:
    stats = os.stat(path)
    return {
        "filename": os.path.basename(path),
        "path": os.path.abspath(path),
        "size": stats.st_size,
        "modified": datetime.fromtimestamp(stats.st_mtime).isoformat(),
    }

def simple_search(root: str, term: str) -> List[Dict]:
    results = []
    pattern = re.compile(re.escape(term), re.IGNORECASE)
    for dirpath, _, files in os.walk(root):
        for name in files:
            filepath = os.path.join(dirpath, name)
            meta = get_file_metadata(filepath)

            if pattern.search(name):
                meta["match_type"] = "filename"
                results.append(meta)
                continue

            if pattern.search(json.dumps(meta)):
                meta["match_type"] = "metadata"
                results.append(meta)
                continue

            content = read_file_contents(filepath)
            if pattern.search(content):
                meta["match_type"] = "content"
                meta["text_snippet"] = content[:200].replace("\n", " ")
                results.append(meta)
    return results


def tokenize(text: str) -> List[str]:
    return re.findall(r'\b\w+\b', text.lower())

def compute_tf(tokens: List[str]) -> Dict[str, float]:
    tf = {}
    for token in tokens:
        tf[token] = tf.get(token, 0) + 1
    total = len(tokens)
    for token in tf:
        tf[token] /= total
    return tf

def compute_idf(docs_tokens: List[List[str]]) -> Dict[str, float]:
    N = len(docs_tokens)
    idf = {}
    all_tokens = set(token for doc in docs_tokens for token in doc)
    for token in all_tokens:
        count = sum(1 for doc in docs_tokens if token in doc)
        idf[token] = math.log((N + 1) / (count + 1)) + 1
    return idf

def cosine_similarity(vec1: Dict[str, float], vec2: Dict[str, float], idf: Dict[str, float]) -> float:
    all_words = set(vec1.keys()).union(vec2.keys())
    v1 = [vec1.get(w, 0) * idf.get(w, 0) for w in all_words]
    v2 = [vec2.get(w, 0) * idf.get(w, 0) for w in all_words]
    dot = sum(a*b for a, b in zip(v1, v2))
    norm1 = math.sqrt(sum(a*a for a in v1))
    norm2 = math.sqrt(sum(b*b for b in v2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)

class SemanticSearch:
    def __init__(self):
        self.documents = []
        self.docs_tokens = []
        self.idf = {}

    def index_files(self, root: str):
        for dirpath, _, files in os.walk(root):
            for name in files:
                path = os.path.join(dirpath, name)
                text = read_file_contents(path)
                if text.strip():
                    self.documents.append({"path": path, "text": text})
                    self.docs_tokens.append(tokenize(text))
        if self.docs_tokens:
            self.idf = compute_idf(self.docs_tokens)

    def search(self, query: str, top_k: int = 5) -> List[Dict]:
        q_tokens = tokenize(query)
        q_tf = compute_tf(q_tokens)
        sims = [cosine_similarity(q_tf, compute_tf(doc_tokens), self.idf)
                for doc_tokens in self.docs_tokens]
        top_indices = sorted(range(len(sims)), key=lambda i: sims[i], reverse=True)[:top_k]
        results = []
        for i in top_indices:
            doc = self.documents[i]
            snippet = doc["text"][:200].replace("\n", " ")
            results.append({
                "path": doc["path"],
                "score": sims[i],
                "text_snippet": snippet,
                "match_type": "semantic"
            })
        return results


def main():
    root = input("Enter directory path: ").strip()
    term = input("Enter search term: ").strip()
    mode = input("Search mode (simple/semantic): ").strip().lower()

    if mode == "semantic":
        ss = SemanticSearch()
        ss.index_files(root)
        results = ss.search(term)
    else:
        results = simple_search(root, term)

    # Print results as JSON
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    main()
