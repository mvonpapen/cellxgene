"""
Drops and recreates all tables according to cellxgene_orm.py
"""

from sqlalchemy import create_engine

from server.db.cellxgene_orm import Base


def create_db(database_uri):
    engine = create_engine(database_uri)
    print("Dropping tables")
    Base.metadata.drop_all(engine)
    print("Recreating tables")
    Base.metadata.create_all(engine)


if __name__ == "__main__":
    create_db()
