import json
import os
import hashlib
import secrets
import psycopg2

SALT = 'poehali_msgr_v1'


def hash_password(password: str) -> str:
    return hashlib.sha256((SALT + password).encode()).hexdigest()


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-User-Id',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json',
    }


def make_token(user_id: int, login: str) -> str:
    raw = f"{user_id}:{login}:{secrets.token_hex(16)}"
    return hashlib.sha256(raw.encode()).hexdigest() + f".{user_id}"


def handler(event, context):
    '''Авторизация: вход по логину/паролю и проверка токена.'''
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors_headers(), 'body': ''}

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    body = json.loads(event.get('body') or '{}')
    action = body.get('action', 'login')

    if action == 'login':
        login = (body.get('login') or '').strip()
        password = body.get('password') or ''
        cur.execute(
            "SELECT id, login, display_name, role, status, bio FROM users WHERE login = %s AND password_hash = %s",
            (login, hash_password(password)),
        )
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return {'statusCode': 401, 'headers': cors_headers(),
                    'body': json.dumps({'error': 'Неверный логин или пароль'})}
        if row[4] != 'active':
            cur.close()
            conn.close()
            return {'statusCode': 403, 'headers': cors_headers(),
                    'body': json.dumps({'error': 'Учётная запись заблокирована'})}
        cur.execute("UPDATE users SET last_seen = NOW() WHERE id = %s", (row[0],))
        conn.commit()
        token = make_token(row[0], row[1])
        user = {'id': row[0], 'login': row[1], 'display_name': row[2],
                'role': row[3], 'status': row[4], 'bio': row[5] or ''}
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(),
                'body': json.dumps({'token': token, 'user': user})}

    cur.close()
    conn.close()
    return {'statusCode': 400, 'headers': cors_headers(),
            'body': json.dumps({'error': 'Неизвестное действие'})}
