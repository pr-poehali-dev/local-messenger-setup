import json
import os
import hashlib
import base64
import psycopg2

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-User-Id',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json',
    }


def get_actor(cur, headers):
    uid = headers.get('X-User-Id') or headers.get('x-user-id')
    if not uid:
        # Пробуем извлечь user_id из токена вида sha256hex.{user_id}
        token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
        if token and '.' in token:
            try:
                uid = token.rsplit('.', 1)[1]
            except Exception:
                return None
    if not uid:
        return None
    cur.execute("SELECT id, login, role FROM users WHERE id = %s", (int(uid),))
    return cur.fetchone()


def log_audit(cur, admin_login, action, target, action_type):
    cur.execute(
        "INSERT INTO audit_log (admin_login, action, target, action_type) VALUES (%s, %s, %s, %s)",
        (admin_login, action, target, action_type),
    )


def handler(event, context):
    '''Управление пользователями: список, создание (только админ), смена пароля, блокировка, профиль.'''
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors_headers(), 'body': ''}

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    headers = event.get('headers') or {}
    actor = get_actor(cur, headers)

    if not actor:
        cur.close()
        conn.close()
        return {'statusCode': 401, 'headers': cors_headers(),
                'body': json.dumps({'error': 'Требуется авторизация'})}

    actor_id, actor_login, actor_role = actor

    if method == 'GET':
        cur.execute(
            "SELECT id, login, display_name, role, status, bio, "
            "to_char(created_at, 'DD.MM.YYYY'), to_char(last_seen, 'DD.MM HH24:MI') "
            "FROM users ORDER BY created_at DESC"
        )
        users = [
            {'id': r[0], 'login': r[1], 'display_name': r[2], 'role': r[3],
             'status': r[4], 'bio': r[5] or '', 'created_at': r[6], 'last_seen': r[7]}
            for r in cur.fetchall()
        ]
        cur.execute(
            "SELECT id, admin_login, action, target, action_type, "
            "to_char(created_at, 'DD.MM HH24:MI') FROM audit_log ORDER BY created_at DESC LIMIT 30"
        )
        audit = [
            {'id': r[0], 'admin': r[1], 'action': r[2], 'target': r[3],
             'type': r[4], 'time': r[5]}
            for r in cur.fetchall()
        ]
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(),
                'body': json.dumps({'users': users, 'audit': audit})}

    try:
        raw_body = event.get('body') or '{}'
        if event.get('isBase64Encoded'):
            raw_body = base64.b64decode(raw_body).decode('utf-8')
        body = json.loads(raw_body)
    except Exception:
        cur.close(); conn.close()
        return {'statusCode': 400, 'headers': cors_headers(),
                'body': json.dumps({'error': 'Неверный формат запроса'})}
    action = body.get('action')

    if action == 'create':
        if actor_role != 'admin':
            cur.close()
            conn.close()
            return {'statusCode': 403, 'headers': cors_headers(),
                    'body': json.dumps({'error': 'Только администратор может создавать аккаунты'})}
        login = (body.get('login') or '').strip()
        name = (body.get('display_name') or '').strip()
        password = body.get('password') or ''
        role = body.get('role') or 'user'
        if not login or not password or not name:
            cur.close()
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(),
                    'body': json.dumps({'error': 'Заполните логин, имя и пароль'})}
        cur.execute("SELECT 1 FROM users WHERE login = %s", (login,))
        if cur.fetchone():
            cur.close()
            conn.close()
            return {'statusCode': 409, 'headers': cors_headers(),
                    'body': json.dumps({'error': 'Логин уже занят'})}
        cur.execute(
            "INSERT INTO users (login, display_name, password_hash, role) VALUES (%s, %s, %s, %s) RETURNING id",
            (login, name, hash_password(password), role),
        )
        new_id = cur.fetchone()[0]
        log_audit(cur, actor_login, 'Создана учётная запись', login, 'create')
        conn.commit()
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(),
                'body': json.dumps({'id': new_id, 'ok': True})}

    if action == 'change_password':
        new_pass = body.get('new_password') or ''
        if len(new_pass) < 4:
            cur.close()
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(),
                    'body': json.dumps({'error': 'Пароль слишком короткий'})}
        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s",
                    (hash_password(new_pass), actor_id))
        conn.commit()
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(),
                'body': json.dumps({'ok': True})}

    if action == 'update_profile':
        name = (body.get('display_name') or '').strip()
        bio = (body.get('bio') or '').strip()
        cur.execute("UPDATE users SET display_name = %s, bio = %s WHERE id = %s",
                    (name, bio, actor_id))
        conn.commit()
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(),
                'body': json.dumps({'ok': True})}

    if action == 'reset_password':
        if actor_role != 'admin':
            cur.close(); conn.close()
            return {'statusCode': 403, 'headers': cors_headers(),
                    'body': json.dumps({'error': 'Недостаточно прав'})}
        target_id = body.get('user_id')
        new_pass = body.get('new_password') or ''
        if len(new_pass) < 4:
            cur.close(); conn.close()
            return {'statusCode': 400, 'headers': cors_headers(),
                    'body': json.dumps({'error': 'Пароль слишком короткий'})}
        cur.execute("SELECT login FROM users WHERE id = %s", (target_id,))
        trow = cur.fetchone()
        if not trow:
            cur.close(); conn.close()
            return {'statusCode': 404, 'headers': cors_headers(),
                    'body': json.dumps({'error': 'Пользователь не найден'})}
        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s",
                    (hash_password(new_pass), target_id))
        log_audit(cur, actor_login, 'Сброс пароля', trow[0], 'edit')
        conn.commit()
        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': cors_headers(),
                'body': json.dumps({'ok': True})}

    if action == 'set_status':
        if actor_role != 'admin':
            cur.close()
            conn.close()
            return {'statusCode': 403, 'headers': cors_headers(),
                    'body': json.dumps({'error': 'Недостаточно прав'})}
        target_id = body.get('user_id')
        status = body.get('status')
        cur.execute("SELECT login FROM users WHERE id = %s", (target_id,))
        trow = cur.fetchone()
        target_login = trow[0] if trow else str(target_id)
        cur.execute("UPDATE users SET status = %s WHERE id = %s", (status, target_id))
        act = 'Заблокирован аккаунт' if status == 'blocked' else 'Разблокирован аккаунт'
        log_audit(cur, actor_login, act, target_login, 'block' if status == 'blocked' else 'edit')
        conn.commit()
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(),
                'body': json.dumps({'ok': True})}

    cur.close()
    conn.close()
    return {'statusCode': 400, 'headers': cors_headers(),
            'body': json.dumps({'error': 'Неизвестное действие'})}