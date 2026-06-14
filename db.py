# =============================================
#  STUDIO BLACK – db.py
#  Conexão e inicialização do banco MySQL
# =============================================

import mysql.connector
import logging


# ── Configurações de conexão ──
# Altere conforme seu ambiente MySQL
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port':     3306,
    'user':     'root',          # Seu usuário MySQL
    'password': '193473202@Ta',     # Sua senha MySQL
    'database': 'studio_black',
    'charset':  'utf8mb4',
}


def get_connection():
    """
    Retorna uma conexão ativa com o banco de dados MySQL.
    Retorna None em caso de falha, para ser tratado pelo chamador.
    """
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except mysql.connector.Error as e:
        logging.error(f'Erro ao conectar ao MySQL: {e}')
        return None


def inicializar_banco():
    """
    Cria o banco de dados e a tabela de agendamentos
    se ainda não existirem. Chamado na primeira execução.
    """
    try:
        # Conecta sem selecionar banco para criá-lo
        cfg_sem_db = {k: v for k, v in DB_CONFIG.items() if k != 'database'}
        conn = mysql.connector.connect(**cfg_sem_db)
        cursor = conn.cursor()

        # Criar banco
        cursor.execute(
            f"CREATE DATABASE IF NOT EXISTS `{DB_CONFIG['database']}` "
            "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
        cursor.execute(f"USE `{DB_CONFIG['database']}`")

        # Criar tabela de agendamentos
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

        # Criar tabela de horários bloqueados
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
        # Adicionar colunas nome/telefone se ainda não existirem (migração)
        try:
            cursor.execute("ALTER TABLE agendamentos ADD COLUMN nome VARCHAR(100) DEFAULT ''")
        except Exception:
            pass
        try:
            cursor.execute("ALTER TABLE agendamentos ADD COLUMN telefone VARCHAR(30) DEFAULT ''")
        except Exception:
            pass
        conn.commit()
        logging.info('Banco de dados e tabela inicializados com sucesso.')
    except mysql.connector.Error as e:
        logging.error(f'Erro ao inicializar banco: {e}')
    finally:
        try:
            conn.close()
        except Exception:
            pass


# Inicializar banco ao importar o módulo
inicializar_banco()
