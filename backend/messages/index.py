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
            "(SELECT to_char(created_at, 'HH24:MI') FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) "
            "FROM conversations c "
            "JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = %s "
            "ORDER BY c.created_at DESC",
            (uid,),
        )
        convs = [
            {'id': r[0], 'title': r[1], 'is_group': r[2],
             'last': r[3] or 'Нет сообщений', 'time': r[4] or ''}
            for r in cur.fetchall()
        ]
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': cors_headers(),
                'body': json.dumps({'conversations': convs})}

    body = json.loads(event.get('body') or '{}')
    action = body.get('action')

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
