import uuid

from app.models.room_member import RoomMember


def register_and_login(
    client,
    email="ada@example.com",
    username="ada",
    birthday=None,
    profile_photo_url=None,
):
    payload = {
        "email": email,
        "username": username,
        "password": "strong-password",
    }
    if birthday is not None:
        payload["birthday"] = birthday
    if profile_photo_url is not None:
        payload["profile_photo_url"] = profile_photo_url

    user_response = client.post("/api/v1/auth/register", json=payload)
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "strong-password"},
    )
    return user_response.json(), login_response.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_register_accepts_optional_profile_fields_and_me_returns_profile(client):
    _, token = register_and_login(
        client,
        birthday="1990-01-02",
        profile_photo_url="https://example.com/ada.png",
    )

    response = client.get("/api/v1/users/me", headers=auth_headers(token))

    assert response.status_code == 200
    assert response.json() == {
        "id": response.json()["id"],
        "email": "ada@example.com",
        "username": "ada",
        "birthday": "1990-01-02",
        "profile_photo_url": "https://example.com/ada.png",
        "created_at": response.json()["created_at"],
    }


def test_profile_rejects_future_birthday_and_unsafe_photo_url(client):
    _, token = register_and_login(client)

    future_birthday = client.patch(
        "/api/v1/users/me",
        json={"birthday": "2999-01-01"},
        headers=auth_headers(token),
    )
    bad_photo_url = client.patch(
        "/api/v1/users/me",
        json={"profile_photo_url": "javascript:alert(1)"},
        headers=auth_headers(token),
    )
    bad_register_url = client.post(
        "/api/v1/auth/register",
        json={
            "email": "bad-photo@example.com",
            "username": "badphoto",
            "password": "strong-password",
            "profile_photo_url": "data:text/html;base64,abc",
        },
    )

    assert future_birthday.status_code == 422
    assert bad_photo_url.status_code == 422
    assert bad_register_url.status_code == 422


def test_update_profile_enforces_unique_username(client):
    _, token = register_and_login(client)
    register_and_login(client, email="grace@example.com", username="grace")

    response = client.patch(
        "/api/v1/users/me",
        json={"username": "grace"},
        headers=auth_headers(token),
    )

    assert response.status_code == 409


def test_update_profile_returns_updated_profile(client):
    _, token = register_and_login(client)

    response = client.patch(
        "/api/v1/users/me",
        json={
            "username": "ada-lovelace",
            "birthday": "1991-03-04",
            "profile_photo_url": "https://example.com/new.png",
        },
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "ada-lovelace"
    assert data["birthday"] == "1991-03-04"
    assert data["profile_photo_url"] == "https://example.com/new.png"


def test_upload_profile_photo_updates_current_user(client):
    _, token = register_and_login(client)

    response = client.post(
        "/api/v1/users/me/photo",
        files={"photo": ("avatar.png", b"small-image-bytes", "image/png")},
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["profile_photo_url"].startswith("/uploads/profile_photos/")
    assert data["profile_photo_url"].endswith(".png")


def test_people_search_matches_username_and_excludes_current_user(client):
    _, token = register_and_login(client, username="ada")
    register_and_login(client, email="grace@example.com", username="gracehopper")
    register_and_login(client, email="alan@example.com", username="alan")

    response = client.get(
        "/api/v1/users/search?username=grace&limit=10",
        headers=auth_headers(token),
    )

    assert response.status_code == 200
    assert [user["username"] for user in response.json()] == ["gracehopper"]
    assert "email" not in response.json()[0]
    assert "birthday" not in response.json()[0]


def test_people_search_requires_two_characters(client):
    _, token = register_and_login(client, username="ada")

    response = client.get(
        "/api/v1/users/search?username=a&limit=10",
        headers=auth_headers(token),
    )

    assert response.status_code == 422


def test_room_detail_and_members_require_membership(client):
    _, creator_token = register_and_login(client)
    _, outsider_token = register_and_login(client, email="grace@example.com", username="grace")
    room = client.post(
        "/api/v1/rooms",
        json={"name": "general"},
        headers=auth_headers(creator_token),
    ).json()

    detail_response = client.get(
        f"/api/v1/rooms/{room['id']}",
        headers=auth_headers(outsider_token),
    )
    members_response = client.get(
        f"/api/v1/rooms/{room['id']}/members",
        headers=auth_headers(outsider_token),
    )

    assert detail_response.status_code == 403
    assert members_response.status_code == 403


def test_room_detail_returns_members_for_room_member(client):
    creator, creator_token = register_and_login(client)
    joiner, joiner_token = register_and_login(client, email="grace@example.com", username="grace")
    room = client.post(
        "/api/v1/rooms",
        json={"name": "general"},
        headers=auth_headers(creator_token),
    ).json()
    client.post(f"/api/v1/rooms/{room['id']}/join", headers=auth_headers(joiner_token))

    response = client.get(
        f"/api/v1/rooms/{room['id']}",
        headers=auth_headers(creator_token),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == room["id"]
    assert data["member_count"] == 2
    assert data["is_member"] is True
    assert data["is_direct"] is False
    assert {member["user_id"] for member in data["members"]} == {creator["id"], joiner["id"]}

    members_response = client.get(
        f"/api/v1/rooms/{room['id']}/members",
        headers=auth_headers(joiner_token),
    )

    assert members_response.status_code == 200
    assert {member["username"] for member in members_response.json()} == {"ada", "grace"}


def test_room_rename_is_creator_only_and_checks_duplicate_name(client):
    _, creator_token = register_and_login(client)
    _, joiner_token = register_and_login(client, email="grace@example.com", username="grace")
    headers = auth_headers(creator_token)
    room = client.post("/api/v1/rooms", json={"name": "general"}, headers=headers).json()
    client.post("/api/v1/rooms", json={"name": "random"}, headers=headers)
    client.post(f"/api/v1/rooms/{room['id']}/join", headers=auth_headers(joiner_token))

    forbidden = client.patch(
        f"/api/v1/rooms/{room['id']}",
        json={"name": "renamed"},
        headers=auth_headers(joiner_token),
    )
    duplicate = client.patch(
        f"/api/v1/rooms/{room['id']}",
        json={"name": "random"},
        headers=headers,
    )
    renamed = client.patch(
        f"/api/v1/rooms/{room['id']}",
        json={"name": "renamed"},
        headers=headers,
    )

    assert forbidden.status_code == 403
    assert duplicate.status_code == 409
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "renamed"


def test_direct_room_creation_is_idempotent(client, db_session):
    user, token = register_and_login(client)
    target, target_token = register_and_login(client, email="grace@example.com", username="grace")

    first = client.post(
        "/api/v1/rooms/direct",
        json={"user_id": target["id"]},
        headers=auth_headers(token),
    )
    second = client.post(
        "/api/v1/rooms/direct",
        json={"user_id": user["id"]},
        headers=auth_headers(target_token),
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["is_direct"] is True
    assert db_session.query(RoomMember).filter(
        RoomMember.room_id == uuid.UUID(first.json()["id"])
    ).count() == 2


def test_direct_room_is_private_and_not_publicly_joinable(client):
    user, token = register_and_login(client)
    target, target_token = register_and_login(client, email="grace@example.com", username="grace")
    _, outsider_token = register_and_login(client, email="alan@example.com", username="alan")

    direct_room = client.post(
        "/api/v1/rooms/direct",
        json={"user_id": target["id"]},
        headers=auth_headers(token),
    ).json()

    outsider_rooms = client.get("/api/v1/rooms", headers=auth_headers(outsider_token)).json()
    outsider_join = client.post(
        f"/api/v1/rooms/{direct_room['id']}/join",
        headers=auth_headers(outsider_token),
    )
    target_rooms = client.get("/api/v1/rooms", headers=auth_headers(target_token)).json()
    rename = client.patch(
        f"/api/v1/rooms/{direct_room['id']}",
        json={"name": "new-direct-name"},
        headers=auth_headers(token),
    )

    assert all(room["id"] != direct_room["id"] for room in outsider_rooms)
    assert any(room["id"] == direct_room["id"] for room in target_rooms)
    assert outsider_join.status_code == 403
    assert rename.status_code == 403


def test_direct_room_rejects_self_chat(client):
    user, token = register_and_login(client)

    response = client.post(
        "/api/v1/rooms/direct",
        json={"user_id": user["id"]},
        headers=auth_headers(token),
    )

    assert response.status_code == 422
