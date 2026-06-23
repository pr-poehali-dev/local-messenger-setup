import json
import os
import psycopg2


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-User-Id',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json',
    }


def get_uid(headers):
    uid = headers.get('X-User-Id') or headers.get('x-user-id')
    return int(uid) if uid else None


def handler(event, context):
    '''Чаты и сообщения: список диалогов, история, отправка сообщения.'''
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors_headers(), 'body': ''}

    headers = event.get('headers') or {}
    uid = get_uid(headers)
    if not uid:
        return {'statusCode': 401, 'headers': cors_headers(),
                'body': json.dumps({'error': 'Требуется авторизация'})}

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()

    if method == 'GET':
        params = event.get('queryStringParameters') or {}
        conv_id = params.get('conversation_id')
        if conv_id:
            cur.execute(
                "SELECT m.id, m.sender_id, u.display_name, m.body, "
                "to_char(m.created_at, 'HH24:MI') FROM messages m "
                "JOIN users u ON u.id = m.sender_id "
                "WHERE m.conversation_id = %s ORDER BY m.created_at ASC LIMIT 200",
                (int(conv_id),),
            )
            msgs = [
                {'id': r[0], 'sender_id': r[1], 'sender_name': r[2],
                 'body': r[3], 'time': r[4], 'me': r[1] == uid}
                for r in cur.fetchall()
            ]
            cur.close()
            conn.close()
            return {'statusCode': 200, 'headers': cors_headers(),
                    'body': json.dumps({'messages': msgs})}

        cur.execute(
            "SELECT c.id, c.title, c.is_group, "
            "(SELECT body FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1), "
            "(SELECT to_char(created_at, 'HH24:MI') FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1), "
            "(SELECT cm2.user_id FROM conversation_members cm2 WHERE cm2.conversation_id = c.id AND cm2.user_id != %s LIMIT 1) "
            "FROM conversations c "
            "JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = %s "
            "ORDER BY c.created_at DESC",
            (uid, uid),
        )
        convs = [
            {'id': r[0], 'title': r[1], 'is_group': r[2],
             'last': r[3] or 'Нет сообщений', 'time': r[4] or '',
             'other_user_id': r[5]}
            for r in cur.fetchall()
        ]
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(),
                'body': json.dumps({'conversations': convs})}

    body = json.loads(event.get('body') or '{}')
    action = body.get('action')

    if action == 'search_users':
        q = (body.get('q') or '').strip()
        if len(q) < 1:
            cur.close(); conn.close()
            return {'statusCode': 200, 'headers': cors_headers(),
                    'body': json.dumps({'users': []})}
        cur.execute(
            "SELECT id, login, display_name FROM users "
            "WHERE status = 'active' AND id != %s "
            "AND (lower(login) LIKE lower(%s) OR lower(display_name) LIKE lower(%s)) "
            "LIMIT 10",
            (uid, f'%{q}%', f'%{q}%')
        )
        users = [{'id': r[0], 'login': r[1], 'name': r[2]} for r in cur.fetchall()]
        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': cors_headers(),
                'body': json.dumps({'users': users})}

    if action == 'create_dialog':
        target_login = (body.get('target_login') or '').strip()
        if not target_login:
            cur.close(); conn.close()
            return {'statusCode': 400, 'headers': cors_headers(),
                    'body': json.dumps({'error': 'Укажите логин пользователя'})}
        cur.execute("SELECT id, display_name, status FROM users WHERE lower(login) = lower(%s)", (target_login,))
        target = cur.fetchone()
        if not target:
            cur.close(); conn.close()
            return {'statusCode': 404, 'headers': cors_headers(),
                    'body': json.dumps({'error': 'Пользователь не найден'})}
        if target[2] != 'active':
            cur.close(); conn.close()
            return {'statusCode': 403, 'headers': cors_headers(),
                    'body': json.dumps({'error': 'Пользователь недоступен'})}
        if target[0] == uid:
            cur.close(); conn.close()
            return {'statusCode': 400, 'headers': cors_headers(),
                    'body': json.dumps({'error': 'Нельзя создать диалог с собой'})}
        # Проверяем, нет ли уже личного диалога между этими двумя
        cur.execute(
            "SELECT c.id FROM conversations c "
            "JOIN conversation_members cm1 ON cm1.conversation_id = c.id AND cm1.user_id = %s "
            "JOIN conversation_members cm2 ON cm2.conversation_id = c.id AND cm2.user_id = %s "
            "WHERE c.is_group = FALSE",
            (uid, target[0])
        )
        existing = cur.fetchone()
        if existing:
            cur.close(); conn.close()
            return {'statusCode': 200, 'headers': cors_headers(),
                    'body': json.dumps({'id': existing[0], 'already_exists': True})}
        cur.execute("SELECT display_name FROM users WHERE id = %s", (uid,))
        my_name = cur.fetchone()[0]
        title = target[1]
        cur.execute("INSERT INTO conversations (title, is_group) VALUES (%s, FALSE) RETURNING id", (title,))
        conv_id = cur.fetchone()[0]
        cur.execute("INSERT INTO conversation_members (conversation_id, user_id) VALUES (%s, %s)", (conv_id, uid))
        cur.execute("INSERT INTO conversation_members (conversation_id, user_id) VALUES (%s, %s)", (conv_id, target[0]))
        conn.commit()
        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': cors_headers(),
                'body': json.dumps({'id': conv_id, 'title': title, 'ok': True})}

    if action == 'send':
        conv_id = body.get('conversation_id')
        text = (body.get('body') or '').strip()
        if not text or not conv_id:
            cur.close()
            conn.close()
            return {'statusCode': 400, 'headers': cors_headers(),
                    'body': json.dumps({'error': 'Пустое сообщение'})}
        cur.execute(
            "INSERT INTO messages (conversation_id, sender_id, body) VALUES (%s, %s, %s) "
            "RETURNING id, to_char(created_at, 'HH24:MI')",
            (int(conv_id), uid, text),
        )
        r = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(),
                'body': json.dumps({'id': r[0], 'time': r[1], 'ok': True})}

    cur.close()
    conn.close()
    return {'statusCode': 400, 'headers': cors_headers(),
            'body': json.dumps({'error': 'Неизвестное действие'})}