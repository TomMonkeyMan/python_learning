from fastapi import FastAPI, HTTPException, Response
import sqlite3
from typing import List, Dict
from fastapi import File, UploadFile, Depends, Cookie, HTTPException
from fastapi.responses import FileResponse
import os
import secrets
from pathlib import Path
import urllib.parse


app = FastAPI()
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

VALID_USERS = {"tom", "香啵猪"}
from pydantic import BaseModel

class LoginRequest(BaseModel):
    nickname: str

@app.post("/xbzchat/v1/login_http")
def login_http(request: LoginRequest, response: Response):
    nickname = request.nickname
    if nickname not in VALID_USERS:
        raise HTTPException(status_code=400, detail="Invalid user")
    encoded_nickname = urllib.parse.quote(nickname, safe="")
    response.set_cookie(
        key="auth_user",
        value=encoded_nickname,
        max_age=24 * 3600,
        path="/xbzchat",
        httponly=True,
        secure=False,
        samesite="strict",
    )
    return {"status": "logged in"}

#@app.post("/xbzchat/v1/login_http")
#def login_http(nickname: str, response: Response):
#    if nickname not in VALID_USERS:
#        raise HTTPException(status_code=400, detail="Invalid user")
#    # 设置 Cookie（有效期 1 小时）
#    response.set_cookie(
#        key="auth_user",
#        value=nickname,
#        max_age=24 * 3600,  # 24 hour
#        path="/xbzchat",
#        httponly=True,  # 防 XSS
#        secure=False,  # 开发环境设 False；生产环境 HTTPS 设 True
#        samesite="strict",
#    )
#
#    return {"status": "logged in"}


def get_last_logout_times() -> List[Dict[str, str]]:
    try:
        conn = sqlite3.connect("chat.db")
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT nick_name, MAX(time_stamp)
            FROM users_status
            WHERE status = 'logout'
              AND nick_name IN ('tom', '香啵猪')
            GROUP BY nick_name
        """
        )
        rows = cursor.fetchall()
        conn.close()
        return [{"nick_name": row[0], "last_logout_time": row[1]} for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/xbzchat/v1/last_online_time")
def last_online_time():
    return get_last_logout_times()






def get_current_user(auth_user: str = Cookie(None)) -> str:
    if auth_user is None:
        raise HTTPException(status_code=401, detail="未登录或身份无效")
    
    try:
        decoded = urllib.parse.unquote(auth_user)
    except Exception:
        raise HTTPException(status_code=401, detail="身份信息损坏")

    if decoded not in VALID_USERS:
        raise HTTPException(status_code=401, detail="未登录或身份无效")
    
    return decoded

#def get_current_user(auth_user: str = Cookie(None)) -> str:
#    if auth_user not in VALID_USERS:
#        raise HTTPException(status_code=401, detail="未登录或身份无效")
#    return auth_user


@app.post("/xbzchat/v1/upload_image")
async def upload_image(
    image: UploadFile = File(...), user: str = Depends(get_current_user)
):
    # 安全检查：只允许图片
    if not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="仅支持图片上传")

    # 生成唯一文件名（避免冲突）
    ext = image.filename.split(".")[-1].lower() if "." in image.filename else "jpg"
    safe_ext = ext if ext in {"jpg", "jpeg", "png", "gif", "webp"} else "jpg"
    filename = f"{secrets.token_urlsafe(16)}.{safe_ext}"
    filepath = UPLOAD_DIR / filename

    # 保存文件
    with open(filepath, "wb") as f:
        f.write(await image.read())

    # （可选）记录到数据库：谁上传了什么图？这里简化处理
    return {"image_id": filename}


@app.get("/xbzchat/v1/image/{image_id}")
async def get_image(image_id: str, user: str = Depends(get_current_user)):
    # 简单安全：只允许合法文件名
    if not image_id.replace(".", "").replace("_", "").replace("-", "").isalnum():
        raise HTTPException(status_code=400, detail="非法文件名")

    filepath = UPLOAD_DIR / image_id
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="图片不存在")

    return FileResponse(path = filepath,
                        headers={"Cache-Control": "private, max-age=259200"})
