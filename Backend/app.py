# =============================================
#  STUDIO BLACK – app.py
#  Backend Flask com MySQL
# =============================================

from flask import Flask, request, jsonify
from flask_cors import CORS
from db import get_connection
import logging

app = Flask(__name__)
CORS(app)  # Permite requisições do frontend

logging.basicConfig(level=logging.INFO)

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
        # Converte timedelta/time para string "HH:MM:SS"
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

        # Verificar conflito
        cursor.execute(
            'SELECT id FROM agendamentos WHERE barbeiro = %s AND data = %s AND horario = %s',
            (barbeiro, data, horario)
        )
        existente = cursor.fetchone()

        if existente:
            return jsonify({'erro': 'Este horário já está reservado para este barbeiro. Escolha outro horário.'}), 409

        # Inserir agendamento
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
#  Retorna agendamentos de um barbeiro em uma data.
#  Query params: barbeiro, data (YYYY-MM-DD)
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
        # Converter data para string
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
#  Retorna todos os agendamentos de um barbeiro,
#  opcionalmente filtrado por data.
#  Query params: barbeiro, data (opcional)
# ──────────────────────────────────────────
@app.route('/admin/historico', methods=['GET'])
def admin_historico():
    barbeiro   = request.args.get('barbeiro', '').strip()
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
#  Cancela (deleta) um agendamento pelo ID.
#  Usado pelo barbeiro no painel admin.
# ──────────────────────────────────────────
@app.route('/admin/cancelar/<int:agendamento_id>', methods=['DELETE'])
def admin_cancelar(agendamento_id):
    conn = get_connection()
    if conn is None:
        return jsonify({'erro': 'Falha ao conectar ao banco.'}), 500
    try:
        cursor = conn.cursor(dictionary=True)
        # Buscar agendamento antes de deletar (para retornar dados pro WhatsApp)
        cursor.execute(
            'SELECT * FROM agendamentos WHERE id = %s',
            (agendamento_id,)
        )
        ag = cursor.fetchone()
        if not ag:
            return jsonify({'erro': 'Agendamento não encontrado.'}), 404

        cursor.execute('DELETE FROM agendamentos WHERE id = %s', (agendamento_id,))
        conn.commit()

        # Converter data para string
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
#  GET /cancelar/<id>
#  Página de cancelamento pelo cliente.
#  Retorna dados do agendamento para confirmar.
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
#  DELETE /cancelar/<id>
#  Confirma cancelamento pelo cliente.
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
#  Retorna horários bloqueados pelo barbeiro
#  em uma data específica.
#  Query params: barbeiro, data (YYYY-MM-DD)
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
#  Bloqueia um horário para um barbeiro.
#  Body JSON: barbeiro, data, horario
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
        # Verificar se já existe agendamento nesse horário
        cursor.execute(
            'SELECT id FROM agendamentos WHERE barbeiro = %s AND data = %s AND horario = %s',
            (barbeiro, data, horario)
        )
        if cursor.fetchone():
            return jsonify({'erro': 'Já existe um agendamento neste horário.'}), 409

        # Verificar se já está bloqueado
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
#  Remove bloqueio de um horário.
#  Body JSON: barbeiro, data, horario
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
#  Lista todos os bloqueios de um barbeiro
#  em uma data. Query params: barbeiro, data
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
    import os
    port = int(os.getenv('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)