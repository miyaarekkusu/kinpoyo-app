import os

import pyodbc
from dotenv import load_dotenv

load_dotenv()

_SERVER = os.getenv("AZURE_SQL_SERVER")
_DATABASE = os.getenv("AZURE_SQL_DATABASE")
_USER = os.getenv("AZURE_SQL_USER")
_PASSWORD = os.getenv("AZURE_SQL_PASSWORD")


def get_connection():
    if not all([_SERVER, _DATABASE, _USER, _PASSWORD]):
        raise RuntimeError(
            "Azure SQL credentials are not set. Copy .env.example to .env and fill in values."
        )

    connection_string = (
        "Driver={ODBC Driver 18 for SQL Server};"
        f"Server=tcp:{_SERVER},1433;"
        f"Database={_DATABASE};"
        f"Uid={_USER};"
        f"Pwd={_PASSWORD};"
        "Encrypt=yes;"
        "TrustServerCertificate=no;"
        "Connection Timeout=30;"
    )
    return pyodbc.connect(connection_string)


def init_schema():
    """Create tables if they do not exist yet."""
    ddl = """
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RecordingSession' AND xtype='U')
    CREATE TABLE RecordingSession (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        exercise_name   NVARCHAR(100) NOT NULL,
        recorded_at     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        fps             FLOAT         NULL,
        total_frames    INT           NULL,
        start_frame     INT           NULL,
        end_frame       INT           NULL
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='FrameSample' AND xtype='U')
    CREATE TABLE FrameSample (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        session_id      INT           NOT NULL,
        frame_number    INT           NOT NULL,
        image           VARBINARY(MAX) NULL,
        pose_landmarks  NVARCHAR(MAX) NULL,
        created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_FrameSample_Session FOREIGN KEY (session_id)
            REFERENCES RecordingSession(id) ON DELETE CASCADE
    );
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        for statement in ddl.split(";"):
            stmt = statement.strip()
            if stmt:
                cursor.execute(stmt)
        conn.commit()
