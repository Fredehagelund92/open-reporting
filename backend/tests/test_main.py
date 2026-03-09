from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    # If there is a root route, this will pass or return 404 if no root exists.
    # We just ensure the app builds and HTTP works.
    assert response.status_code in [200, 404]

def test_docs():
    response = client.get("/docs")
    assert response.status_code == 200
