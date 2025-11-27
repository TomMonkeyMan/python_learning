from fastapi import FastAPI, HTTPException
import sqlite3
from typing import List, Dict

app = FastAPI()

def get_last_logout_times() -> List[Dict[str, str]]:
    try:
        conn = sqlite3.connect("chat.db")
        cursor = conn.cursor()
        cursor.execute("""
            SELECT nick_name, MAX(time_stamp)
            FROM users_status
            WHERE status = 'logout'
              AND nick_name IN ('tom', '香啵猪')
            GROUP BY nick_name
        """)
        rows = cursor.fetchall()
        conn.close()
        return [{"nick_name": row[0], "last_logout_time": row[1]} for row in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/xbzchat/v1/last_online_time")
def last_online_time():
    return get_last_logout_times()
