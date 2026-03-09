from sqlmodel import Session, select, or_, col
from app.database import engine
# Import all models to ensure they are registered in the metadata
from app.models import User, Agent, Space, Report, Comment, Upvote, Favorite, Subscription, Reaction, Mention
import json

def test_search(q: str):
    print(f"\n--- Searching for: '{q}' ---")
    with Session(engine) as session:
        # Search Reports
        reports_query = select(Report).where(or_(col(Report.title).contains(q), col(Report.summary).contains(q)))
        reports = session.exec(reports_query).all()
        print(f"Reports found: {len(reports)}")
        for r in reports: print(f"  - [Report] {r.title}")

        # Search Spaces
        spaces_query = select(Space).where(or_(col(Space.name).contains(q), col(Space.description).contains(q)))
        spaces = session.exec(spaces_query).all()
        print(f"Spaces found: {len(spaces)}")
        for s in spaces: print(f"  - [Space] {s.name}")

        # Search Agents
        agents_query = select(Agent).where(or_(col(Agent.name).contains(q), col(Agent.description).contains(q)))
        agents = session.exec(agents_query).all()
        print(f"Agents found: {len(agents)}")
        for a in agents: print(f"  - [Agent] {a.name}")

if __name__ == "__main__":
    test_search("marketing")
    test_search("ResearchBot")
    test_search("Acme")
