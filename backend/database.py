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

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Tag' AND xtype='U')
    CREATE TABLE Tag (
        id                INT IDENTITY(1,1) PRIMARY KEY,
        name              NVARCHAR(100) NOT NULL UNIQUE,
        description       NVARCHAR(500) NULL,
        monitored_joints  NVARCHAR(MAX) NULL,
        created_at        DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
    );

    IF COL_LENGTH('Tag', 'monitored_joints') IS NULL
    ALTER TABLE Tag ADD monitored_joints NVARCHAR(MAX) NULL;

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AnalysisResult' AND xtype='U')
    CREATE TABLE AnalysisResult (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        tag_id          INT           NOT NULL,
        summary_json    NVARCHAR(MAX) NOT NULL,
        created_at      DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_AR_Tag FOREIGN KEY (tag_id)
            REFERENCES Tag(id) ON DELETE CASCADE
    );

    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AnalysisInputSession' AND xtype='U')
    CREATE TABLE AnalysisInputSession (
        analysis_id     INT NOT NULL,
        session_id      INT NOT NULL,
        PRIMARY KEY (analysis_id, session_id),
        CONSTRAINT FK_AIS_Analysis FOREIGN KEY (analysis_id)
            REFERENCES AnalysisResult(id) ON DELETE CASCADE
    );
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        for statement in ddl.split(";"):
            stmt = statement.strip()
            if stmt:
                cursor.execute(stmt)
        conn.commit()
