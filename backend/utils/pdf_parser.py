"""PDF 解析工具"""

import fitz  # PyMuPDF
from fastapi import HTTPException


def parse_pdf_content(pdf_bytes: bytes) -> str:
    """解析 PDF 文件内容为文本"""
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text = "".join([p.get_text() for p in doc])
        doc.close()
        return text
    except Exception as e:
        print(f"PDF 解析失败: {e}")
        raise HTTPException(status_code=400, detail="PDF解析失败")
