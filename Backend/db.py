# =============================================
#  STUDIO BLACK – db.py
#  Conexão e inicialização do banco MySQL
# =============================================

import os
import mysql.connector
import logging

DB_CONFIG = {
    'host':     os.getenv('DB_HOST', 'localhost'),
    'port':     int(os.getenv('DB_PORT', 3306)),
    'user':     os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', '193473202@Ta'),
    'database': os.getenv('DB_NAME', 'studio_black'),
    'charset':  'utf8mb4',
}


def get_connection():
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except mysql.connector.Error as e:
        logging.error(f'Erro ao conectar ao MySQL: {e}')
        return None


def inicializar_banco():
    try:
        cfg_sem_db = {k: v for k, v in DB_CONFIG.items() if k != 'database'}
        conn = mysql.connector.connect(**cfg_sem_db)
        cursor = conn.cursor()

        cursor.execute(
            f"CREATE DATABASE IF NOT EXISTS `{DB_CONFIG['database']}` "
            "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
        cursor.execute(f"USE `{DB_CONFIG['database']}`")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agendamentos (
                id        INT AUTO_INCREMENT PRIMARY KEY,
                barbeiro  VARCHAR(100)  NOT NULL,
                servico   VARCHAR(150)  NOT NULL,
                data      DATE          NOT NULL,
                horario   TIME          NOT NULL,
                nome      VARCHAR(100)  DEFAULT '',
                telefone  VARCHAR(30)   DEFAULT '',
                criado_em TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unico_agendamento (barbeiro, data, horario)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS horarios_bloqueados (
                id        INT AUTO_INCREMENT PRIMARY KEY,
                barbeiro  VARCHAR(100) NOT NULL,
                data      DATE         NOT NULL,
                horario   TIME         NOT NULL,
                UNIQUE KEY uq_bloqueio (barbeiro, data, horario)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)

        conn.commit()
        try:
            cursor.execute("ALTER TABLE agendamentos ADD COLUMN nome VARCHAR(100) DEFAULT ''")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE agendamentos ADD COLUMN telefone VARCHAR(30) DEFAULT ''")
        except Exception:
            pass
        conn.commit()
        logging.info('Banco de dados inicializado com sucesso.')
    except mysql.connector.Error as e:
        logging.error(f'Erro ao inicializar banco: {e}')
    finally:
        try:
            conn.close()
        except Exception:
            pass


inicializar_banco()