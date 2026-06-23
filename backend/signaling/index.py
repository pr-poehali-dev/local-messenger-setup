import json
import os
import time
import psycopg2


def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-User-Id',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json',
    }


def get_uid(headers):
    uid = headers.get('X-User-Id') or headers.get('x-user-id')
    return int(uid) if uid else None


def handler(event, context):
    """Сигнальный сервер для WebRTC звонков: offer/answer/ice обмен через БД."""
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

    # Очищаем устаревшие сигналы (старше 2 минут)
    cur.execute("DELETE FROM signaling WHERE created_at < NOW() - INTERVAL '2 minutes'")
    conn.commit()

    params = event.get('queryStringParameters') or {}

    if method == 'GET':
        conv_id = params.get('conversation_id')
        since = params.get('since', '0')
        if not conv_id:
            cur.close(); conn.close()
            return {'statusCode': 400, 'headers': cors_headers(),
                    'body': json.dumps({'error': 'conversation_id required'})}
        cur.execute(
            "SELECT id, sender_id, type, payload, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') "
            "FROM signaling WHERE conversation_id = %s AND recipient_id = %s AND id > %s "
            "ORDER BY id ASC LIMIT 20",
            (int(conv_id), uid, int(since))
        )
        signals = [
            {'id': r[0], 'sender_id': r[1], 'type': r[2],
             'payload': json.loads(r[3]), 'time': r[4]}
            for r in cur.fetchall()
        ]
        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': cors_headers(),
                'body': json.dumps({'signals': signals})}

    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        conv_id = body.get('conversation_id')
        recipient_id = body.get('recipient_id')
        sig_type = body.get('type')
        payload = body.get('payload', {})

        if not all([conv_id, recipient_id, sig_type]):
            cur.close(); conn.close()
            return {'statusCode': 400, 'headers': cors_headers(),
                    'body': json.dumps({'error': 'conversation_id, recipient_id, type required'})}

        cur.execute(
            "INSERT INTO signaling (conversation_id, sender_id, recipient_id, type, payload) "
            "VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (int(conv_id), uid, int(recipient_id), sig_type, json.dumps(payload))
        )
        sig_id = cur.fetchone()[0]
        conn.commit()
        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': cors_headers(),
                'body': json.dumps({'id': sig_id, 'ok': True})}

    cur.close(); conn.close()
    return {'statusCode': 405, 'headers': cors_headers(),
            'body': json.dumps({'error': 'Method not allowed'})}
