def register_payload(email="ada@example.com", username="ada"):
    return {
        "email": email,
        "username": username,
        "password": "strong-password",
    }


def test_register_success(client):
    response = client.post("/api/v1/auth/register", json=register_payload())

    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "ada@example.com"
    assert data["username"] == "ada"
    assert "id" in data
    assert "password" not in data


def test_duplicate_email_returns_409(client):
    client.post("/api/v1/auth/register", json=register_payload())

    response = client.post(
        "/api/v1/auth/register",
        json=register_payload(username="ada2"),
    )

    assert response.status_code == 409


def test_duplicate_username_returns_409(client):
    client.post("/api/v1/auth/register", json=register_payload())

    response = client.post(
        "/api/v1/auth/register",
        json=register_payload(email="ada2@example.com"),
    )

    assert response.status_code == 409


def test_login_success_returns_token_pair(client):
    client.post("/api/v1/auth/register", json=register_payload())

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "ada@example.com", "password": "strong-password"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["access_token"]
    assert data["refresh_token"]


def test_bad_login_returns_401(client):
    client.post("/api/v1/auth/register", json=register_payload())

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "ada@example.com", "password": "wrong-password"},
    )

    assert response.status_code == 401


def test_refresh_success_returns_access_token(client):
    client.post("/api/v1/auth/register", json=register_payload())
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "ada@example.com", "password": "strong-password"},
    )

    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": login_response.json()["refresh_token"]},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["access_token"]


def test_refresh_rejects_invalid_token(client):
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "not-a-token"},
    )

    assert response.status_code == 401
