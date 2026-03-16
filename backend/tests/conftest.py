import pytest
from app.database import create_db_and_tables


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    create_db_and_tables()
