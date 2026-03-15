import httpx
import logging
from typing import List, Optional
from app.core.config import settings
from app.models import Report, Agent, Space, User

logger = logging.getLogger(__name__)

class SlackProvider:
    async def send_report_notification(
        self, 
        webhook_url: str, 
        report: Report, 
        agent: Agent, 
        space: Space
    ):
        """Sends a rich Slack notification using Block Kit."""
        # Frontend paths: /o/:space_name/:report_slug
        # Normalized space name (remove o/ prefix if present for the path)
        space_path = space.name.replace("o/", "") if space.name.startswith("o/") else space.name
        
        report_url = f"{settings.VITE_FRONTEND_BASE_URL}/{space.name}/{report.slug}"
        agent_url = f"{settings.VITE_FRONTEND_BASE_URL}/assistant/{agent.name}"
        space_url = f"{settings.VITE_FRONTEND_BASE_URL}/{space.name}"
        
        # Using a deterministic avatar for the agent
        avatar_url = f"https://api.dicebear.com/7.x/bottts/svg?seed={agent.name}"
        
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🚀 New Report Published",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*<{agent_url}|{agent.name}>* just shared a new insight in *<{space_url}|{space.name}>*"
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Title*: {report.title}\n*Summary*: {report.summary}"
                },
                "accessory": {
                    "type": "image",
                    "image_url": avatar_url,
                    "alt_text": agent.name
                }
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "View Report",
                            "emoji": True
                        },
                        "url": report_url,
                        "style": "primary"
                    }
                ]
            }
        ]
        
        payload = {"blocks": blocks}
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(webhook_url, json=payload)
                response.raise_for_status()
                logger.info(f"Slack notification sent to {webhook_url}")
            except Exception as e:
                logger.error(f"Failed to send Slack notification: {e}")

async def notify_subscribers(report_id: str):
    """
    Finds users who should be notified about this report and sends alerts.
    """
    from sqlmodel import Session, select
    from app.database import engine
    from app.models import Report, Subscription, NotificationPreference
    
    with Session(engine) as session:
        report = session.get(Report, report_id)
        if not report:
            logger.error(f"Report {report_id} not found during notification dispatch")
            return
            
        # 1. Get all explicit subscribers to this space or agent
        stmt = select(Subscription).where(
            (Subscription.target_id == report.space_id) | 
            (Subscription.target_id == report.agent_id)
        )
        subscriptions = session.exec(stmt).all()
        user_ids = {s.user_id for s in subscriptions}
        
        # 2. Also notify users who have favorited this space
        stmt_fav = select(Favorite).where(
            Favorite.target_type == "space",
            Favorite.target_id == report.space_id
        )
        favorites = session.exec(stmt_fav).all()
        for f in favorites:
            user_ids.add(f.user_id)
            
        # 3. Also notify the space owner
        if report.space.owner_id:
            user_ids.add(report.space.owner_id)
            
        if not user_ids:
            logger.debug(f"No recipients found for report {report.id}")
            return

        # Find notification preferences for these users
        stmt = select(NotificationPreference).where(
            NotificationPreference.user_id.in_(list(user_ids)),
            NotificationPreference.enabled == True
        )
        prefs = session.exec(stmt).all()
        
        slack_provider = SlackProvider()
        
        for pref in prefs:
            events = pref.events or []
            if "report_published" not in events:
                continue
                
            if pref.channel == "slack" and pref.webhook_url:
                await slack_provider.send_report_notification(
                    pref.webhook_url, report, report.agent, report.space
                )
