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
            'INSERT INTO agendamentos (barbeiro, servico, data, horario) VALUES (%s, %s, %s, %s)',
            (barbeiro, servico, data, horario)
        )
        conn.commit()

        logging.info(f'Agendamento salvo: {barbeiro} | {servico} | {data} | {horario}')
        return jsonify({'mensagem': 'Agendamento realizado com sucesso!'}), 201

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


if __name__ == '__main__':
    app.run(debug=True, port=5000)
