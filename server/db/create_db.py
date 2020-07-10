"""
Drops and recreates all tables according to cellxgene_orm.py
"""

import os
import sys

from flask import current_app
from sqlalchemy import create_engine

from server.db.cellxgene_orm import Base

# pkg_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))  # noqa
# sys.path.insert(0, pkg_root)  # noqa

config = current_app.app_config

def create_db():
    engine = create_engine(config.relational_db__database_uri)
    print("Dropping tables")
    Base.metadata.drop_all(engine)
    print("Recreating tables")
    Base.metadata.create_all(engine)


if __name__ == "__main__":
    create_db()
