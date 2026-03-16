from fastapi.testclient import TestClient
from sqlmodel import Session, select
from uuid import uuid4
from datetime import datetime, timezone
from sqlalchemy import inspect, text

from app.main import app
from app.database import engine
from app.models import User, Space, Agent, Report, Upvote, Comment, Reaction
from app.auth.security import create_access_token

client = TestClient(app)


def test_read_root():
    response = client.get("/")
    # If there is a root route, this will pass or return 404 if no root exists.
    # We just ensure the app builds and HTTP works.
    assert response.status_code in [200, 404]


def test_docs():
    response = client.get("/docs")
    assert response.status_code == 200


def test_search_hides_private_content_from_unauthorized_users():
    suffix = uuid4().hex[:8]
    owner_id = None
    outsider_id = None
    private_space_id = None
    public_space_id = None
    private_agent_id = None
    public_agent_id = None
    private_report_id = None
    public_report_id = None

    try:
        with Session(engine) as session:
            owner = User(
                email=f"owner-{suffix}@example.com",
                name=f"Owner {suffix}",
                provider="local",
            )
            outsider = User(
                email=f"outsider-{suffix}@example.com",
                name=f"Outsider {suffix}",
                provider="local",
            )
            session.add(owner)
            session.add(outsider)
            session.commit()
            session.refresh(owner)
            session.refresh(outsider)
            owner_id = owner.id
            outsider_id = outsider.id

            private_space = Space(
                name=f"o/private-{suffix}",
                description=f"private-scope-{suffix}",
                is_private=True,
                owner_id=owner.id,
            )
            public_space = Space(
                name=f"o/public-{suffix}",
                description=f"public-scope-{suffix}",
                is_private=False,
            )
            session.add(private_space)
            session.add(public_space)
            session.commit()
            session.refresh(private_space)
            session.refresh(public_space)
            private_space_id = private_space.id
            public_space_id = public_space.id

            private_agent = Agent(
                name=f"private-agent-{suffix}",
                description=f"private-scope-{suffix}",
                api_key=f"openrep_sk_private_{suffix}",
                owner_id=owner.id,
                is_claimed=True,
                is_private=True,
            )
            public_agent = Agent(
                name=f"public-agent-{suffix}",
                description=f"public-scope-{suffix}",
                api_key=f"openrep_sk_public_{suffix}",
                is_claimed=True,
                is_private=False,
            )
            session.add(private_agent)
            session.add(public_agent)
            session.commit()
            session.refresh(private_agent)
            session.refresh(public_agent)
            private_agent_id = private_agent.id
            public_agent_id = public_agent.id

            private_report = Report(
                title=f"Private Scope {suffix}",
                summary=f"private-scope-{suffix}",
                tags="[]",
                slug=f"private-scope-{suffix}",
                html_body="<h2>Private</h2>",
                content_type="report",
                agent_id=private_agent.id,
                space_id=private_space.id,
            )
            public_report = Report(
                title=f"Public Scope {suffix}",
                summary=f"public-scope-{suffix}",
                tags="[]",
                slug=f"public-scope-{suffix}",
                html_body="<h2>Public</h2>",
                content_type="report",
                agent_id=public_agent.id,
                space_id=public_space.id,
            )
            session.add(private_report)
            session.add(public_report)
            session.commit()
            private_report_id = private_report.id
            public_report_id = public_report.id

        anon_private = client.get(f"/api/v1/search/?q=private-scope-{suffix}")
        assert anon_private.status_code == 200
        assert anon_private.json()["results"] == []

        owner_token = create_access_token(data={"sub": owner_id})
        owner_private = client.get(
            f"/api/v1/search/?q=private-scope-{suffix}",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert owner_private.status_code == 200
        owner_result_types = {item["type"] for item in owner_private.json()["results"]}
        assert {"report", "space", "agent"}.issubset(owner_result_types)

        outsider_token = create_access_token(data={"sub": outsider_id})
        outsider_private = client.get(
            f"/api/v1/search/?q=private-scope-{suffix}",
            headers={"Authorization": f"Bearer {outsider_token}"},
        )
        assert outsider_private.status_code == 200
        assert outsider_private.json()["results"] == []

        anon_public = client.get(f"/api/v1/search/?q=public-scope-{suffix}")
        assert anon_public.status_code == 200
        public_result_types = {item["type"] for item in anon_public.json()["results"]}
        assert {"report", "space", "agent"}.issubset(public_result_types)
    finally:
        with Session(engine) as session:
            if private_report_id:
                obj = session.get(Report, private_report_id)
                if obj:
                    session.delete(obj)
            if public_report_id:
                obj = session.get(Report, public_report_id)
                if obj:
                    session.delete(obj)
            if private_agent_id:
                obj = session.get(Agent, private_agent_id)
                if obj:
                    session.delete(obj)
            if public_agent_id:
                obj = session.get(Agent, public_agent_id)
                if obj:
                    session.delete(obj)
            if private_space_id:
                obj = session.get(Space, private_space_id)
                if obj:
                    session.delete(obj)
            if public_space_id:
                obj = session.get(Space, public_space_id)
                if obj:
                    session.delete(obj)
            if owner_id:
                obj = session.get(User, owner_id)
                if obj:
                    session.delete(obj)
            if outsider_id:
                obj = session.get(User, outsider_id)
                if obj:
                    session.delete(obj)
            session.commit()


def test_register_for_me_and_existing_agent_reconnect_endpoints():
    suffix = uuid4().hex[:8]
    user_email = f"reconnect-{suffix}@example.com"
    password = "pass1234"

    register_res = client.post(
        "/api/v1/auth/register",
        json={"name": f"Reconnect {suffix}", "email": user_email, "password": password},
    )
    assert register_res.status_code == 200

    token_res = client.post(
        "/api/v1/auth/token",
        data={"username": user_email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert token_res.status_code == 200
    user_token = token_res.json()["access_token"]

    create_res = client.post(
        "/api/v1/agents/register-for-me",
        json={"name": f"reconnect-agent-{suffix}", "description": "reconnect test"},
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert create_res.status_code == 201
    created_agent = create_res.json()["agent"]
    assert created_agent["api_key"].startswith("openrep_")

    my_agents_res = client.get(
        "/api/v1/agents/my-agents",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert my_agents_res.status_code == 200
    matched = next(
        (item for item in my_agents_res.json() if item["id"] == created_agent["id"]),
        None,
    )
    assert matched is not None
    assert matched["api_key"] == created_agent["api_key"]
    assert matched["api_key_hint"]

    verify_key_res = client.get(
        "/api/v1/agents/me",
        headers={"Authorization": f"Bearer {created_agent['api_key']}"},
    )
    assert verify_key_res.status_code == 200
    assert verify_key_res.json()["id"] == created_agent["id"]


def test_space_management_permissions_and_edge_cases():
    suffix = uuid4().hex[:8]
    owner_id = None
    admin_id = None
    outsider_id = None
    private_space_id = None
    public_space_id = None

    try:
        with Session(engine) as session:
            owner = User(
                email=f"space-owner-{suffix}@example.com",
                name=f"Owner {suffix}",
                provider="local",
            )
            admin = User(
                email=f"space-admin-{suffix}@example.com",
                name=f"Admin {suffix}",
                provider="local",
                role="ADMIN",
            )
            outsider = User(
                email=f"space-outsider-{suffix}@example.com",
                name=f"Outsider {suffix}",
                provider="local",
            )
            session.add(owner)
            session.add(admin)
            session.add(outsider)
            session.commit()
            session.refresh(owner)
            session.refresh(admin)
            session.refresh(outsider)
            owner_id = owner.id
            admin_id = admin.id
            outsider_id = outsider.id

            private_space = Space(
                name=f"o/private-manage-{suffix}",
                description="private management checks",
                is_private=True,
                owner_id=owner.id,
            )
            public_space = Space(
                name=f"o/public-manage-{suffix}",
                description="public management checks",
                is_private=False,
                owner_id=owner.id,
            )
            session.add(private_space)
            session.add(public_space)
            session.commit()
            session.refresh(private_space)
            session.refresh(public_space)
            private_space_id = private_space.id
            public_space_id = public_space.id

        owner_token = create_access_token(data={"sub": owner_id})
        admin_token = create_access_token(data={"sub": admin_id})
        outsider_token = create_access_token(data={"sub": outsider_id})

        outsider_access_res = client.get(
            f"/api/v1/spaces/{private_space_id}/access",
            headers={"Authorization": f"Bearer {outsider_token}"},
        )
        assert outsider_access_res.status_code == 403

        owner_invite_res = client.post(
            f"/api/v1/spaces/{private_space_id}/invite",
            json={"user_email": f"space-outsider-{suffix}@example.com"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert owner_invite_res.status_code == 200
        assert owner_invite_res.json()["user_id"] == outsider_id

        owner_revoke_owner_res = client.delete(
            f"/api/v1/spaces/{private_space_id}/access/{owner_id}",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert owner_revoke_owner_res.status_code == 400

        outsider_revoke_res = client.delete(
            f"/api/v1/spaces/{private_space_id}/access/{outsider_id}",
            headers={"Authorization": f"Bearer {outsider_token}"},
        )
        assert outsider_revoke_res.status_code == 403

        admin_revoke_res = client.delete(
            f"/api/v1/spaces/{private_space_id}/access/{outsider_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert admin_revoke_res.status_code == 204

        repeat_revoke_res = client.delete(
            f"/api/v1/spaces/{private_space_id}/access/{outsider_id}",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert repeat_revoke_res.status_code == 404

        public_invite_res = client.post(
            f"/api/v1/spaces/{public_space_id}/invite",
            json={"user_email": f"space-outsider-{suffix}@example.com"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert public_invite_res.status_code == 400
    finally:
        with Session(engine) as session:
            if private_space_id:
                obj = session.get(Space, private_space_id)
                if obj:
                    session.delete(obj)
            if public_space_id:
                obj = session.get(Space, public_space_id)
                if obj:
                    session.delete(obj)
            if owner_id:
                obj = session.get(User, owner_id)
                if obj:
                    session.delete(obj)
            if admin_id:
                obj = session.get(User, admin_id)
                if obj:
                    session.delete(obj)
            if outsider_id:
                obj = session.get(User, outsider_id)
                if obj:
                    session.delete(obj)
            session.commit()


def test_space_governance_events_are_recorded_and_listable():
    suffix = uuid4().hex[:8]
    owner_id = None
    admin_id = None
    member_id = None
    space_id = None

    try:
        with Session(engine) as session:
            owner = User(
                email=f"gov-owner-{suffix}@example.com",
                name=f"Gov Owner {suffix}",
                provider="local",
            )
            admin = User(
                email=f"gov-admin-{suffix}@example.com",
                name=f"Gov Admin {suffix}",
                provider="local",
                role="ADMIN",
            )
            member = User(
                email=f"gov-member-{suffix}@example.com",
                name=f"Gov Member {suffix}",
                provider="local",
            )
            session.add(owner)
            session.add(admin)
            session.add(member)
            session.commit()
            session.refresh(owner)
            session.refresh(admin)
            session.refresh(member)
            owner_id = owner.id
            admin_id = admin.id
            member_id = member.id

            space = Space(
                name=f"o/gov-{suffix}",
                description="governance events",
                is_private=True,
                owner_id=owner.id,
            )
            session.add(space)
            session.commit()
            session.refresh(space)
            space_id = space.id

        owner_token = create_access_token(data={"sub": owner_id})
        admin_token = create_access_token(data={"sub": admin_id})
        member_token = create_access_token(data={"sub": member_id})

        invite_res = client.post(
            f"/api/v1/spaces/{space_id}/invite",
            json={"user_email": f"gov-member-{suffix}@example.com"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert invite_res.status_code == 200

        update_res = client.patch(
            f"/api/v1/spaces/{space_id}",
            json={"description": "governance events updated"},
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert update_res.status_code == 200
        assert update_res.json()["description"] == "governance events updated"

        revoke_res = client.delete(
            f"/api/v1/spaces/{space_id}/access/{member_id}",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert revoke_res.status_code == 204

        owner_events_res = client.get(
            f"/api/v1/spaces/{space_id}/governance-events",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert owner_events_res.status_code == 200
        owner_actions = {event["action"] for event in owner_events_res.json()}
        assert {"member_invited", "space_updated", "member_revoked"}.issubset(
            owner_actions
        )

        non_admin_recent_res = client.get(
            "/api/v1/spaces/governance-events/recent",
            headers={"Authorization": f"Bearer {member_token}"},
        )
        assert non_admin_recent_res.status_code == 403

        delete_res = client.delete(
            f"/api/v1/spaces/{space_id}",
            headers={"Authorization": f"Bearer {owner_token}"},
        )
        assert delete_res.status_code == 204
        space_id = None

        admin_recent_res = client.get(
            "/api/v1/spaces/governance-events/recent?limit=100",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert admin_recent_res.status_code == 200
        recent_actions = {
            event["action"] for event in admin_recent_res.json() if event["space_id"]
        }
        assert "space_deleted" in recent_actions
    finally:
        with Session(engine) as session:
            if space_id:
                obj = session.get(Space, space_id)
                if obj:
                    session.delete(obj)
            if owner_id:
                obj = session.get(User, owner_id)
                if obj:
                    session.delete(obj)
            if admin_id:
                obj = session.get(User, admin_id)
                if obj:
                    session.delete(obj)
            if member_id:
                obj = session.get(User, member_id)
                if obj:
                    session.delete(obj)
            session.commit()


def test_report_delete_permissions_for_admin_space_owner_and_agent_owner():
    suffix = uuid4().hex[:8]
    space_owner_id = None
    agent_owner_id = None
    outsider_id = None
    admin_id = None
    space_id = None
    agent_id = None
    report_one_id = None
    report_two_id = None

    try:
        with Session(engine) as session:
            space_owner = User(
                email=f"space-owner-del-{suffix}@example.com",
                name=f"Space Owner {suffix}",
                provider="local",
            )
            agent_owner = User(
                email=f"agent-owner-del-{suffix}@example.com",
                name=f"Agent Owner {suffix}",
                provider="local",
            )
            outsider = User(
                email=f"outsider-del-{suffix}@example.com",
                name=f"Outsider {suffix}",
                provider="local",
            )
            admin = User(
                email=f"admin-del-{suffix}@example.com",
                name=f"Admin {suffix}",
                provider="local",
                role="ADMIN",
            )
            session.add(space_owner)
            session.add(agent_owner)
            session.add(outsider)
            session.add(admin)
            session.commit()
            session.refresh(space_owner)
            session.refresh(agent_owner)
            session.refresh(outsider)
            session.refresh(admin)

            space_owner_id = space_owner.id
            agent_owner_id = agent_owner.id
            outsider_id = outsider.id
            admin_id = admin.id

            space = Space(
                name=f"o/delete-scope-{suffix}",
                description="delete permissions",
                is_private=False,
                owner_id=space_owner.id,
            )
            session.add(space)
            session.commit()
            session.refresh(space)
            space_id = space.id

            agent = Agent(
                name=f"delete-agent-{suffix}",
                description="delete permissions",
                api_key=f"openrep_delete_{suffix}",
                owner_id=agent_owner.id,
                is_claimed=True,
                is_private=False,
            )
            session.add(agent)
            session.commit()
            session.refresh(agent)
            agent_id = agent.id

            report_columns = {c["name"] for c in inspect(engine).get_columns("report")}
            report_has_legacy_tags = "tags" in report_columns
            report_one_id = str(uuid4())
            report_two_id = str(uuid4())

            if report_has_legacy_tags:
                session.execute(
                    text("""
                    INSERT INTO report (id, title, summary, tags, slug, html_body, content_type, agent_id, space_id, created_at)
                    VALUES (:id, :title, :summary, :tags, :slug, :html_body, :content_type, :agent_id, :space_id, :created_at)
                """),
                    {
                        "id": report_one_id,
                        "title": f"Delete One {suffix}",
                        "summary": "delete permissions one",
                        "tags": "[]",
                        "slug": f"delete-one-{suffix}",
                        "html_body": "<h2>Delete One</h2>",
                        "content_type": "report",
                        "agent_id": agent.id,
                        "space_id": space.id,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    },
                )
                session.execute(
                    text("""
                    INSERT INTO report (id, title, summary, tags, slug, html_body, content_type, agent_id, space_id, created_at)
                    VALUES (:id, :title, :summary, :tags, :slug, :html_body, :content_type, :agent_id, :space_id, :created_at)
                """),
                    {
                        "id": report_two_id,
                        "title": f"Delete Two {suffix}",
                        "summary": "delete permissions two",
                        "tags": "[]",
                        "slug": f"delete-two-{suffix}",
                        "html_body": "<h2>Delete Two</h2>",
                        "content_type": "report",
                        "agent_id": agent.id,
                        "space_id": space.id,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    },
                )
            else:
                report_one = Report(
                    id=report_one_id,
                    title=f"Delete One {suffix}",
                    summary="delete permissions one",
                    slug=f"delete-one-{suffix}",
                    html_body="<h2>Delete One</h2>",
                    content_type="report",
                    agent_id=agent.id,
                    space_id=space.id,
                )
                report_two = Report(
                    id=report_two_id,
                    title=f"Delete Two {suffix}",
                    summary="delete permissions two",
                    slug=f"delete-two-{suffix}",
                    html_body="<h2>Delete Two</h2>",
                    content_type="report",
                    agent_id=agent.id,
                    space_id=space.id,
                )
                session.add(report_one)
                session.add(report_two)
            session.commit()

        outsider_token = create_access_token(data={"sub": outsider_id})
        space_owner_token = create_access_token(data={"sub": space_owner_id})
        agent_owner_token = create_access_token(data={"sub": agent_owner_id})
        admin_token = create_access_token(data={"sub": admin_id})

        outsider_delete = client.delete(
            f"/api/v1/reports/{report_one_id}",
            headers={"Authorization": f"Bearer {outsider_token}"},
        )
        assert outsider_delete.status_code == 403

        agent_owner_delete = client.delete(
            f"/api/v1/reports/{report_one_id}",
            headers={"Authorization": f"Bearer {agent_owner_token}"},
        )
        assert agent_owner_delete.status_code == 204
        report_one_id = None

        space_owner_delete = client.delete(
            f"/api/v1/reports/{report_two_id}",
            headers={"Authorization": f"Bearer {space_owner_token}"},
        )
        assert space_owner_delete.status_code == 204
        report_two_id = None

        # Admin can still delete by slug when report id is not used.
        with Session(engine) as session:
            report_three_slug = f"delete-three-{suffix}"
            report_columns = {c["name"] for c in inspect(engine).get_columns("report")}
            report_has_legacy_tags = "tags" in report_columns
            if report_has_legacy_tags:
                session.execute(
                    text("""
                    INSERT INTO report (id, title, summary, tags, slug, html_body, content_type, agent_id, space_id, created_at)
                    VALUES (:id, :title, :summary, :tags, :slug, :html_body, :content_type, :agent_id, :space_id, :created_at)
                """),
                    {
                        "id": str(uuid4()),
                        "title": f"Delete Three {suffix}",
                        "summary": "delete permissions three",
                        "tags": "[]",
                        "slug": report_three_slug,
                        "html_body": "<h2>Delete Three</h2>",
                        "content_type": "report",
                        "agent_id": agent_id,
                        "space_id": space_id,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    },
                )
            else:
                report_three = Report(
                    title=f"Delete Three {suffix}",
                    summary="delete permissions three",
                    slug=report_three_slug,
                    html_body="<h2>Delete Three</h2>",
                    content_type="report",
                    agent_id=agent_id,
                    space_id=space_id,
                )
                session.add(report_three)
            session.commit()

        admin_delete = client.delete(
            f"/api/v1/reports/{report_three_slug}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert admin_delete.status_code == 204
    finally:
        with Session(engine) as session:
            if report_one_id:
                obj = session.get(Report, report_one_id)
                if obj:
                    session.delete(obj)
            if report_two_id:
                obj = session.get(Report, report_two_id)
                if obj:
                    session.delete(obj)
            if agent_id:
                obj = session.get(Agent, agent_id)
                if obj:
                    session.delete(obj)
            if space_id:
                obj = session.get(Space, space_id)
                if obj:
                    session.delete(obj)
            if space_owner_id:
                obj = session.get(User, space_owner_id)
                if obj:
                    session.delete(obj)
            if agent_owner_id:
                obj = session.get(User, agent_owner_id)
                if obj:
                    session.delete(obj)
            if outsider_id:
                obj = session.get(User, outsider_id)
                if obj:
                    session.delete(obj)
            if admin_id:
                obj = session.get(User, admin_id)
                if obj:
                    session.delete(obj)
            session.commit()


def test_reports_include_user_vote_state_for_authenticated_user():
    suffix = uuid4().hex[:8]
    user_id = None
    space_id = None
    agent_id = None
    report_id = None
    report_slug = f"user-vote-{suffix}"

    try:
        register_res = client.post(
            "/api/v1/auth/register",
            json={
                "name": f"Vote User {suffix}",
                "email": f"vote-{suffix}@example.com",
                "password": "pass1234",
            },
        )
        assert register_res.status_code == 200
        user_id = register_res.json()["id"]

        token_res = client.post(
            "/api/v1/auth/token",
            data={"username": f"vote-{suffix}@example.com", "password": "pass1234"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert token_res.status_code == 200
        token = token_res.json()["access_token"]

        with Session(engine) as session:
            user = session.get(User, user_id)
            space = Space(
                name=f"o/vote-{suffix}",
                description="vote state test",
                is_private=False,
                owner_id=user.id,
            )
            agent = Agent(
                name=f"vote-agent-{suffix}",
                description="vote state test agent",
                api_key=f"openrep_vote_{suffix}",
                owner_id=user.id,
                is_claimed=True,
                is_private=False,
            )
            session.add(space)
            session.add(agent)
            session.commit()
            session.refresh(space)
            session.refresh(agent)
            space_id = space.id
            agent_id = agent.id

            report = Report(
                title=f"Vote State {suffix}",
                summary="vote state test report",
                tags="[]",
                slug=report_slug,
                html_body="<h2>Vote State</h2>",
                content_type="report",
                agent_id=agent.id,
                space_id=space.id,
            )
            session.add(report)
            session.commit()
            session.refresh(report)
            report_id = report.id

        upvote_res = client.post(
            f"/api/v1/reports/{report_id}/upvote",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert upvote_res.status_code == 200
        assert upvote_res.json()["user_vote"] == 1

        list_res = client.get(
            f"/api/v1/reports/?space={f'o/vote-{suffix}'}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert list_res.status_code == 200
        target = next(
            (item for item in list_res.json() if item["id"] == report_id), None
        )
        assert target is not None
        assert target["user_vote"] == 1

        detail_res = client.get(
            f"/api/v1/reports/{report_slug}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert detail_res.status_code == 200
        assert detail_res.json()["user_vote"] == 1
    finally:
        with Session(engine) as session:
            if report_id:
                votes = session.exec(
                    select(Upvote).where(Upvote.report_id == report_id)
                ).all()
                for vote in votes:
                    session.delete(vote)
            if report_id:
                obj = session.get(Report, report_id)
                if obj:
                    session.delete(obj)
            if agent_id:
                obj = session.get(Agent, agent_id)
                if obj:
                    session.delete(obj)
            if space_id:
                obj = session.get(Space, space_id)
                if obj:
                    session.delete(obj)
            if user_id:
                obj = session.get(User, user_id)
                if obj:
                    session.delete(obj)
            session.commit()


def test_authoring_coach_evaluate_returns_machine_readable_feedback_for_agent():
    suffix = uuid4().hex[:8]
    agent_id = None

    try:
        with Session(engine) as session:
            agent = Agent(
                name=f"coach-agent-{suffix}",
                description="authoring coach test",
                api_key=f"openrep_coach_{suffix}",
                is_claimed=True,
            )
            session.add(agent)
            session.commit()
            session.refresh(agent)
            agent_id = agent.id
            api_key = agent.api_key

        payload = {
            "title": "Short",
            "summary": "brief",
            "tags": [],
            "html_body": "<h2>Draft</h2><p>Tiny.</p>",
            "space_name": "o/does-not-matter-for-coach",
            "content_type": "report",
        }
        res = client.post(
            "/api/v1/reports/coach/evaluate",
            json=payload,
            headers={"Authorization": f"Bearer {api_key}"},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["readiness_status"] in {"blocked", "needs_work", "ready"}
        assert isinstance(body["overall_score"], int)
        assert isinstance(body["issues"], list)
        assert "mode" in body
        if body["issues"]:
            first = body["issues"][0]
            assert "rule_id" in first
            assert "severity" in first
            assert "suggestion" in first
    finally:
        with Session(engine) as session:
            if agent_id:
                obj = session.get(Agent, agent_id)
                if obj:
                    session.delete(obj)
            session.commit()


def test_authoring_coach_enforce_mode_blocks_publish(monkeypatch):
    suffix = uuid4().hex[:8]
    user_id = None
    space_id = None
    agent_id = None
    report_id = None

    monkeypatch.setenv("AUTHORING_COACH_MODE", "enforce")

    try:
        with Session(engine) as session:
            user = User(
                email=f"coach-owner-{suffix}@example.com",
                name=f"Coach Owner {suffix}",
                provider="local",
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            user_id = user.id

            space = Space(
                name=f"o/coach-{suffix}",
                description="coach mode space",
                is_private=False,
                owner_id=user.id,
            )
            session.add(space)
            session.commit()
            session.refresh(space)
            space_id = space.id

            agent = Agent(
                name=f"coach-publisher-{suffix}",
                description="coach publisher",
                api_key=f"openrep_enforce_{suffix}",
                owner_id=user.id,
                is_claimed=True,
                is_private=False,
            )
            session.add(agent)
            session.commit()
            session.refresh(agent)
            agent_id = agent.id

            api_key = agent.api_key
            space_name = space.name

        # Valid HTML, but blocked by coach due to short title/content.
        publish_payload = {
            "title": "tiny",
            "summary": "short",
            "tags": [],
            "html_body": "<h2>Hello</h2><p>Small draft.</p>",
            "space_name": space_name,
            "content_type": "report",
        }
        publish_res = client.post(
            "/api/v1/reports/",
            json=publish_payload,
            headers={"Authorization": f"Bearer {api_key}"},
        )
        assert publish_res.status_code == 422
        detail = publish_res.json()["detail"]
        assert detail["coach_blocked"] is True
        assert detail["authoring_coach"]["readiness_status"] == "blocked"
    finally:
        monkeypatch.delenv("AUTHORING_COACH_MODE", raising=False)
        with Session(engine) as session:
            if report_id:
                obj = session.get(Report, report_id)
                if obj:
                    session.delete(obj)
            if agent_id:
                obj = session.get(Agent, agent_id)
                if obj:
                    session.delete(obj)
            if space_id:
                obj = session.get(Space, space_id)
                if obj:
                    session.delete(obj)
            if user_id:
                obj = session.get(User, user_id)
                if obj:
                    session.delete(obj)
            session.commit()


def test_authoring_coach_enforce_mode_blocks_user_upload(monkeypatch):
    suffix = uuid4().hex[:8]
    user_id = None
    space_id = None
    agent_id = None

    monkeypatch.setenv("AUTHORING_COACH_MODE", "enforce")

    try:
        register_res = client.post(
            "/api/v1/auth/register",
            json={
                "name": f"Upload Coach {suffix}",
                "email": f"upload-coach-{suffix}@example.com",
                "password": "pass1234",
            },
        )
        assert register_res.status_code == 200
        user_id = register_res.json()["id"]

        token_res = client.post(
            "/api/v1/auth/token",
            data={
                "username": f"upload-coach-{suffix}@example.com",
                "password": "pass1234",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert token_res.status_code == 200
        user_token = token_res.json()["access_token"]

        space_res = client.post(
            "/api/v1/spaces/",
            json={
                "name": f"o/upload-coach-{suffix}",
                "description": "coach upload checks",
                "is_private": False,
            },
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert space_res.status_code == 201
        space_id = space_res.json()["id"]

        agent_res = client.post(
            "/api/v1/agents/register-for-me",
            json={
                "name": f"upload-coach-agent-{suffix}",
                "description": "coach upload test",
            },
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert agent_res.status_code == 201
        agent_id = agent_res.json()["agent"]["id"]

        upload_res = client.post(
            "/api/v1/reports/upload",
            json={
                "title": "tiny",
                "summary": "short",
                "tags": [],
                "html_body": "<h2>Hello</h2><p>Small draft.</p>",
                "space_name": f"o/upload-coach-{suffix}",
                "agent_id": agent_id,
                "content_type": "report",
            },
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert upload_res.status_code == 422
        detail = upload_res.json()["detail"]
        assert detail["coach_blocked"] is True
        assert detail["authoring_coach"]["readiness_status"] == "blocked"
    finally:
        monkeypatch.delenv("AUTHORING_COACH_MODE", raising=False)
        with Session(engine) as session:
            if agent_id:
                obj = session.get(Agent, agent_id)
                if obj:
                    session.delete(obj)
            if space_id:
                obj = session.get(Space, space_id)
                if obj:
                    session.delete(obj)
            if user_id:
                obj = session.get(User, user_id)
                if obj:
                    session.delete(obj)
            session.commit()


def test_comment_reactions_toggle_and_list():
    suffix = uuid4().hex[:8]
    user_id = None
    space_id = None
    agent_id = None
    report_id = None
    comment_id = None
    report_slug = f"reaction-flow-{suffix}"

    try:
        register_res = client.post(
            "/api/v1/auth/register",
            json={
                "name": f"Reaction User {suffix}",
                "email": f"reaction-{suffix}@example.com",
                "password": "pass1234",
            },
        )
        assert register_res.status_code == 200
        user_id = register_res.json()["id"]

        token_res = client.post(
            "/api/v1/auth/token",
            data={"username": f"reaction-{suffix}@example.com", "password": "pass1234"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert token_res.status_code == 200
        user_token = token_res.json()["access_token"]

        with Session(engine) as session:
            user = session.get(User, user_id)
            space = Space(
                name=f"o/reactions-{suffix}",
                description="reaction checks",
                is_private=False,
                owner_id=user.id,
            )
            agent = Agent(
                name=f"reaction-agent-{suffix}",
                description="reaction checks",
                api_key=f"openrep_reactions_{suffix}",
                owner_id=user.id,
                is_claimed=True,
                is_private=False,
            )
            report = Report(
                title=f"Reactions {suffix}",
                summary="reaction report",
                slug=report_slug,
                html_body="<h1>Reaction Check</h1><p>This report validates comment reaction persistence with deterministic counts and toggle state.</p><p><a href='https://example.com'>evidence</a></p>",
                content_type="report",
                agent_id=agent.id,
                space_id=space.id,
            )
            session.add(space)
            session.add(agent)
            session.commit()
            session.refresh(space)
            session.refresh(agent)
            space_id = space.id
            agent_id = agent.id

            session.add(report)
            session.commit()
            session.refresh(report)
            report_id = report.id

        comment_res = client.post(
            f"/api/v1/reports/{report_id}/comments",
            json={"text": "Looks good. Adding a reaction."},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert comment_res.status_code == 201
        comment_id = comment_res.json()["id"]

        react_res = client.post(
            f"/api/v1/reports/{report_id}/comments/{comment_id}/reactions",
            json={"emoji": "👍"},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert react_res.status_code == 200
        assert react_res.json()["reacted"] is True
        assert react_res.json()["total_count"] == 1

        list_res = client.get(
            f"/api/v1/reports/{report_id}/comments",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert list_res.status_code == 200
        items = list_res.json()
        assert len(items) == 1
        assert items[0]["reactions"][0]["emoji"] == "👍"
        assert items[0]["reactions"][0]["count"] == 1
        assert items[0]["reactions"][0]["reacted"] is True

        unreact_res = client.post(
            f"/api/v1/reports/{report_id}/comments/{comment_id}/reactions",
            json={"emoji": "👍"},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert unreact_res.status_code == 200
        assert unreact_res.json()["reacted"] is False
        assert unreact_res.json()["total_count"] == 0
    finally:
        with Session(engine) as session:
            if comment_id:
                reactions = session.exec(
                    select(Reaction).where(Reaction.comment_id == comment_id)
                ).all()
                for reaction in reactions:
                    session.delete(reaction)
                comment = session.get(Comment, comment_id)
                if comment:
                    session.delete(comment)
            if report_id:
                obj = session.get(Report, report_id)
                if obj:
                    session.delete(obj)
            if agent_id:
                obj = session.get(Agent, agent_id)
                if obj:
                    session.delete(obj)
            if space_id:
                obj = session.get(Space, space_id)
                if obj:
                    session.delete(obj)
            if user_id:
                obj = session.get(User, user_id)
                if obj:
                    session.delete(obj)
            session.commit()
