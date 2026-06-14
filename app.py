# =============================================
#  STUDIO BLACK – app.py
#  Backend Flask com MySQL + serve frontend
# =============================================

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from db import get_connection
import logging
import os

app = Flask(__name__, static_folder='', static_url_path='')
CORS(app)

logging.basicConfig(level=logging.INFO)


# ──────────────────────────────────────────
#  FRONTEND – Servir arquivos estáticos
# ──────────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/admin')
def admin():
    return send_from_directory('.', 'admin.html')

@app.route('/cancelar')
def cancelar_page():
    return send_from_directory('.', 'cancelar.html')

@app.route('/cancelar.html')
def cancelar_html():
    return send_from_directory('.', 'cancelar.html')


# ──────────────────────────────────────────
#  GET /horarios
#  Retorna horários JÁ ocupados para
#  um barbeiro em uma data específica.
#  Query params: barbeiro, data (YYYY-MM-DD)
# ──────────────────────────────────────────
@app.route('/horarios', methods=['GET'])
def get_horarios():
    barbeiro = request.args.get('barbeiro', '').strip()
    data     = request.args.get('data', '').strip()

    if not barbeiro or not data:
        return jsonify({'erro': 'Parâmetros "barbeiro" e "data" são obrigatórios.'}), 400

    conn = get_connection()
    if conn is None:
        return jsonify({'erro': 'Falha ao conectar ao banco de dados.'}), 500

    try:
        cursor = conn.cursor()
        cursor.execute(
            'SELECT horario FROM agendamentos WHERE barbeiro = %s AND data = %s',
            (barbeiro, data)
        )
        rows = cursor.fetchall()
        ocupados = []
        for row in rows:
            h = row[0]
            if hasattr(h, 'seconds'):
                total = h.seconds
                hh = total // 3600
                mm = (total % 3600) // 60
                ocupados.append(f'{hh:02d}:{mm:02d}:00')
            else:
                ocupados.append(str(h))
        return jsonify({'ocupados': ocupados}), 200
    except Exception as e:
        logging.error(f'Erro ao buscar horários: {e}')
        return jsonify({'erro': 'Erro interno ao buscar horários.'}), 500
    finally:
        conn.close()


# ──────────────────────────────────────────
#  POST /agendar
#  Salva um agendamento se não houver conflito.
#  Body JSON: barbeiro, servico, data, horario
# ──────────────────────────────────────────
@app.route('/agendar', methods=['POST'])
def agendar():
    dados = request.get_json()
    if not dados:
        return jsonify({'erro': 'Corpo da requisição inválido.'}), 400

    barbeiro = dados.get('barbeiro', '').strip()
    servico  = dados.get('servico', '').strip()
    data     = dados.get('data', '').strip()
    horario  = dados.get('horario', '').strip()
    nome     = dados.get('nome', '').strip()
    telefone = dados.get('telefone', '').strip()

    if not all([barbeiro, servico, data, horario]):
        return jsonify({'erro': 'Todos os campos são obrigatórios: barbeiro, servico, data, horario.'}), 400

    conn = get_connection()
    if conn is None:
        return jsonify({'erro': 'Falha ao conectar ao banco de dados.'}), 500

    try:
        cursor = conn.cursor()
        cursor.execute(
            'SELECT id FROM agendamentos WHERE barbeiro = %s AND data = %s AND horario = %s',
            (barbeiro, data, horario)
        )
        existente = cursor.fetchone()

        if existente:
            return jsonify({'erro': 'Este horário já está reservado para este barbeiro. Escolha outro horário.'}), 409

        cursor.execute(
            'INSERT INTO agendamentos (barbeiro, servico, data, horario, nome, telefone) VALUES (%s, %s, %s, %s, %s, %s)',
            (barbeiro, servico, data, horario, nome, telefone)
        )
        conn.commit()

        agendamento_id = cursor.lastrowid
        logging.info(f'Agendamento salvo: {barbeiro} | {servico} | {data} | {horario} | {nome}')
        return jsonify({'mensagem': 'Agendamento realizado com sucesso!', 'id': agendamento_id}), 201

    except Exception as e:
        conn.rollback()
        logging.error(f'Erro ao agendar: {e}')
        return jsonify({'erro': 'Erro interno ao salvar o agendamento.'}), 500
    finally:
        conn.close()


# ──────────────────────────────────────────
#  Rota de saúde (health check)
# ──────────────────────────────────────────
@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'app': 'Studio Black API'}), 200


# ──────────────────────────────────────────
#  GET /admin/agendamentos
# ──────────────────────────────────────────
@app.route('/admin/agendamentos', methods=['GET'])
def admin_agendamentos():
    barbeiro = request.args.get('barbeiro', '').strip()
    data     = request.args.get('data', '').strip()

    if not barbeiro or not data:
        return jsonify({'erro': 'Parâmetros obrigatórios: barbeiro, data.'}), 400

    conn = get_connection()
    if conn is None:
        return jsonify({'erro': 'Falha ao conectar ao banco.'}), 500

    try:
        cursor = conn.cursor(dictionary=True)
        sql = (
            "SELECT id, barbeiro, servico, data, "
            "CAST(horario AS CHAR) as horario, nome, telefone "
            "FROM agendamentos "
            "WHERE barbeiro = %s AND data = %s "
            "ORDER BY horario ASC"
        )
        cursor.execute(sql, (barbeiro, data))
        rows = cursor.fetchall()
        for r in rows:
            if hasattr(r['data'], 'isoformat'):
                r['data'] = r['data'].isoformat()
        return jsonify(rows), 200
    except Exception as e:
        logging.error(f'Erro admin/agendamentos: {e}')
        return jsonify({'erro': 'Erro interno.'}), 500
    finally:
        conn.close()


# ──────────────────────────────────────────
#  GET /admin/historico
# ──────────────────────────────────────────
@app.route('/admin/historico', methods=['GET'])
def admin_historico():
    barbeiro    = request.args.get('barbeiro', '').strip()
    data_filtro = request.args.get('data', '').strip()

    if not barbeiro:
        return jsonify({'erro': 'Parâmetro obrigatório: barbeiro.'}), 400

    conn = get_connection()
    if conn is None:
        return jsonify({'erro': 'Falha ao conectar ao banco.'}), 500

    try:
        cursor = conn.cursor(dictionary=True)
        if data_filtro:
            sql = (
                "SELECT id, barbeiro, servico, data, "
                "CAST(horario AS CHAR) as horario, nome, telefone "
                "FROM agendamentos "
                "WHERE barbeiro = %s AND data = %s "
                "ORDER BY data DESC, horario ASC"
            )
            cursor.execute(sql, (barbeiro, data_filtro))
        else:
            sql = (
                "SELECT id, barbeiro, servico, data, "
                "CAST(horario AS CHAR) as horario, nome, telefone "
                "FROM agendamentos "
                "WHERE barbeiro = %s "
                "ORDER BY data DESC, horario ASC "
                "LIMIT 200"
            )
            cursor.execute(sql, (barbeiro,))
        rows = cursor.fetchall()
        for r in rows:
            if hasattr(r['data'], 'isoformat'):
                r['data'] = r['data'].isoformat()
        return jsonify(rows), 200
    except Exception as e:
        logging.error(f'Erro admin/historico: {e}')
        return jsonify({'erro': 'Erro interno.'}), 500
    finally:
        conn.close()


# ──────────────────────────────────────────
#  DELETE /admin/cancelar/<id>
# ──────────────────────────────────────────
@app.route('/admin/cancelar/<int:agendamento_id>', methods=['DELETE'])
def admin_cancelar(agendamento_id):
    conn = get_connection()
    if conn is None:
        return jsonify({'erro': 'Falha ao conectar ao banco.'}), 500
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT * FROM agendamentos WHERE id = %s', (agendamento_id,))
        ag = cursor.fetchone()
        if not ag:
            return jsonify({'erro': 'Agendamento não encontrado.'}), 404

        cursor.execute('DELETE FROM agendamentos WHERE id = %s', (agendamento_id,))
        conn.commit()

        if hasattr(ag['data'], 'isoformat'):
            ag['data'] = ag['data'].isoformat()
        horario = ag['horario']
        if hasattr(horario, 'seconds'):
            total = horario.seconds
            hh = total // 3600
            mm = (total % 3600) // 60
            ag['horario'] = f'{hh:02d}:{mm:02d}:00'
        else:
            ag['horario'] = str(horario)

        logging.info(f'Agendamento {agendamento_id} cancelado pelo admin.')
        return jsonify({'mensagem': 'Cancelado com sucesso.', 'agendamento': ag}), 200
    except Exception as e:
        conn.rollback()
        logging.error(f'Erro ao cancelar: {e}')
        return jsonify({'erro': 'Erro interno ao cancelar.'}), 500
    finally:
        conn.close()


# ──────────────────────────────────────────
#  GET /cancelar/<id>  – cliente ver agendamento
# ──────────────────────────────────────────
@app.route('/cancelar/<int:agendamento_id>', methods=['GET'])
def cliente_ver_cancelamento(agendamento_id):
    conn = get_connection()
    if conn is None:
        return jsonify({'erro': 'Falha ao conectar ao banco.'}), 500
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT * FROM agendamentos WHERE id = %s', (agendamento_id,))
        ag = cursor.fetchone()
        if not ag:
            return jsonify({'erro': 'Agendamento não encontrado ou já cancelado.'}), 404
        if hasattr(ag['data'], 'isoformat'):
            ag['data'] = ag['data'].isoformat()
        horario = ag['horario']
        if hasattr(horario, 'seconds'):
            total = horario.seconds
            hh = total // 3600
            mm = (total % 3600) // 60
            ag['horario'] = f'{hh:02d}:{mm:02d}:00'
        else:
            ag['horario'] = str(horario)
        return jsonify(ag), 200
    except Exception as e:
        return jsonify({'erro': 'Erro interno.'}), 500
    finally:
        conn.close()


# ──────────────────────────────────────────
#  DELETE /cancelar/<id>  – cliente confirmar
# ──────────────────────────────────────────
@app.route('/cancelar/<int:agendamento_id>', methods=['DELETE'])
def cliente_cancelar(agendamento_id):
    conn = get_connection()
    if conn is None:
        return jsonify({'erro': 'Falha ao conectar ao banco.'}), 500
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT * FROM agendamentos WHERE id = %s', (agendamento_id,))
        ag = cursor.fetchone()
        if not ag:
            return jsonify({'erro': 'Agendamento não encontrado ou já cancelado.'}), 404
        cursor.execute('DELETE FROM agendamentos WHERE id = %s', (agendamento_id,))
        conn.commit()
        logging.info(f'Agendamento {agendamento_id} cancelado pelo cliente.')
        return jsonify({'mensagem': 'Agendamento cancelado com sucesso!'}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({'erro': 'Erro interno.'}), 500
    finally:
        conn.close()


# ──────────────────────────────────────────
#  GET /bloqueios
# ──────────────────────────────────────────
@app.route('/bloqueios', methods=['GET'])
def get_bloqueios():
    barbeiro = request.args.get('barbeiro', '').strip()
    data     = request.args.get('data', '').strip()

    if not barbeiro or not data:
        return jsonify({'erro': 'Parâmetros obrigatórios: barbeiro, data.'}), 400

    conn = get_connection()
    if conn is None:
        return jsonify({'erro': 'Falha ao conectar ao banco.'}), 500

    try:
        cursor = conn.cursor()
        cursor.execute(
            'SELECT horario FROM horarios_bloqueados WHERE barbeiro = %s AND data = %s',
            (barbeiro, data)
        )
        rows = cursor.fetchall()
        bloqueados = []
        for row in rows:
            h = row[0]
            if hasattr(h, 'seconds'):
                total = h.seconds
                hh = total // 3600
                mm = (total % 3600) // 60
                bloqueados.append(f'{hh:02d}:{mm:02d}:00')
            else:
                bloqueados.append(str(h))
        return jsonify({'bloqueados': bloqueados}), 200
    except Exception as e:
        logging.error(f'Erro ao buscar bloqueios: {e}')
        return jsonify({'erro': 'Erro interno.'}), 500
    finally:
        conn.close()


# ──────────────────────────────────────────
#  POST /admin/bloquear
# ──────────────────────────────────────────
@app.route('/admin/bloquear', methods=['POST'])
def admin_bloquear():
    dados = request.get_json()
    if not dados:
        return jsonify({'erro': 'Corpo inválido.'}), 400

    barbeiro = dados.get('barbeiro', '').strip()
    data     = dados.get('data', '').strip()
    horario  = dados.get('horario', '').strip()

    if not all([barbeiro, data, horario]):
        return jsonify({'erro': 'Campos obrigatórios: barbeiro, data, horario.'}), 400

    conn = get_connection()
    if conn is None:
        return jsonify({'erro': 'Falha ao conectar ao banco.'}), 500

    try:
        cursor = conn.cursor()
        cursor.execute(
            'SELECT id FROM agendamentos WHERE barbeiro = %s AND data = %s AND horario = %s',
            (barbeiro, data, horario)
        )
        if cursor.fetchone():
            return jsonify({'erro': 'Já existe um agendamento neste horário.'}), 409

        cursor.execute(
            'SELECT id FROM horarios_bloqueados WHERE barbeiro = %s AND data = %s AND horario = %s',
            (barbeiro, data, horario)
        )
        if cursor.fetchone():
            return jsonify({'erro': 'Horário já está bloqueado.'}), 409

        cursor.execute(
            'INSERT INTO horarios_bloqueados (barbeiro, data, horario) VALUES (%s, %s, %s)',
            (barbeiro, data, horario)
        )
        conn.commit()
        logging.info(f'Horário bloqueado: {barbeiro} | {data} | {horario}')
        return jsonify({'mensagem': 'Horário bloqueado com sucesso.'}), 201
    except Exception as e:
        conn.rollback()
        logging.error(f'Erro ao bloquear: {e}')
        return jsonify({'erro': 'Erro interno.'}), 500
    finally:
        conn.close()


# ──────────────────────────────────────────
#  DELETE /admin/bloquear
# ──────────────────────────────────────────
@app.route('/admin/bloquear', methods=['DELETE'])
def admin_desbloquear():
    dados = request.get_json()
    if not dados:
        return jsonify({'erro': 'Corpo inválido.'}), 400

    barbeiro = dados.get('barbeiro', '').strip()
    data     = dados.get('data', '').strip()
    horario  = dados.get('horario', '').strip()

    conn = get_connection()
    if conn is None:
        return jsonify({'erro': 'Falha ao conectar ao banco.'}), 500

    try:
        cursor = conn.cursor()
        cursor.execute(
            'DELETE FROM horarios_bloqueados WHERE barbeiro = %s AND data = %s AND horario = %s',
            (barbeiro, data, horario)
        )
        conn.commit()
        return jsonify({'mensagem': 'Bloqueio removido com sucesso.'}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({'erro': 'Erro interno.'}), 500
    finally:
        conn.close()


# ──────────────────────────────────────────
#  GET /admin/bloqueios
# ──────────────────────────────────────────
@app.route('/admin/bloqueios', methods=['GET'])
def admin_listar_bloqueios():
    barbeiro = request.args.get('barbeiro', '').strip()
    data     = request.args.get('data', '').strip()

    if not barbeiro or not data:
        return jsonify({'erro': 'Parâmetros obrigatórios: barbeiro, data.'}), 400

    conn = get_connection()
    if conn is None:
        return jsonify({'erro': 'Falha ao conectar ao banco.'}), 500

    try:
        cursor = conn.cursor()
        cursor.execute(
            'SELECT horario FROM horarios_bloqueados WHERE barbeiro = %s AND data = %s ORDER BY horario ASC',
            (barbeiro, data)
        )
        rows = cursor.fetchall()
        bloqueados = []
        for row in rows:
            h = row[0]
            if hasattr(h, 'seconds'):
                total = h.seconds
                hh = total // 3600
                mm = (total % 3600) // 60
                bloqueados.append(f'{hh:02d}:{mm:02d}:00')
            else:
                bloqueados.append(str(h))
        return jsonify({'bloqueados': bloqueados}), 200
    except Exception as e:
        return jsonify({'erro': 'Erro interno.'}), 500
    finally:
        conn.close()


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
