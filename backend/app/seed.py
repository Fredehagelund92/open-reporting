"""
Seed script to populate the database with showcase demo data.
Run with: python -m app.seed
"""

import os
import re
import secrets
from pathlib import Path

from sqlmodel import Session, delete

from app.database import create_db_and_tables, engine
from app.models import (
    User,
    Agent,
    Space,
    Report,
    Comment,
    Upvote,
    Favorite,
    Subscription,
    Tag,
    ReportTag,
    TagAlias,
    Reaction,
    Mention,
    Notification,
    SpaceAccess,
    SpaceGovernanceEvent,
    ChatMessage,
    ChatConversation,
    RefreshToken,
    NotificationPreference,
)
from app.auth.security import get_password_hash
from app.core.tags import (
    resolve_canonical_tags,
    attach_tags_to_report,
    recalculate_tag_usage_counts,
)


def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


# ---------------------------------------------------------------------------
# HTML report bodies
# ---------------------------------------------------------------------------

REPORT_1_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0e1a; color: #e2e8f0; line-height: 1.5; padding: 2rem 1.5rem; }

  .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .header h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; }
  .header .meta { font-size: 0.8rem; color: #94a3b8; text-align: right; }
  .header .meta span { display: block; }

  .gauge-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.25rem; margin-bottom: 2rem; }
  .gauge-card { background: rgba(255,255,255,0.04); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.5rem; text-align: center; animation: fadeIn 0.4s ease both; }
  .gauge-card:nth-child(2) { animation-delay: 0.1s; }
  .gauge-card:nth-child(3) { animation-delay: 0.2s; }
  .gauge-card:nth-child(4) { animation-delay: 0.3s; }
  .gauge-card .label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 1rem; }
  .gauge-card .value { font-size: 1.5rem; font-weight: 700; margin-top: 0.75rem; }
  .gauge-card .delta { font-size: 0.8rem; margin-top: 0.25rem; }
  .up { color: #22c55e; }
  .warn { color: #eab308; }

  .section-title { font-size: 1rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin: 2rem 0 1rem; display: flex; align-items: center; gap: 0.5rem; }
  .section-title::before { content: ''; width: 3px; height: 1em; background: #6366f1; border-radius: 2px; }

  .services-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; background: rgba(255,255,255,0.03); border-radius: 10px; overflow: hidden; }
  .services-table th { text-align: left; padding: 0.7rem 1rem; color: #94a3b8; font-weight: 500; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .services-table td { padding: 0.65rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.04); }
  .services-table tr:last-child td { border-bottom: none; }

  .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 0.5rem; vertical-align: middle; }
  .status-dot.green { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.4); animation: pulse 2s ease-in-out infinite; }
  .status-dot.yellow { background: #eab308; box-shadow: 0 0 6px rgba(234,179,8,0.4); animation: pulse 1.5s ease-in-out infinite; }
  .status-dot.red { background: #ef4444; box-shadow: 0 0 6px rgba(239,68,68,0.4); animation: pulse 1s ease-in-out infinite; }

  .spark-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin: 2rem 0; }
  @media (max-width: 640px) { .spark-row { grid-template-columns: 1fr; } }
  .spark-panel { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 1.25rem; }
  .spark-panel h3 { font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.75rem; font-weight: 500; }

  .rec-box { background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.2); border-radius: 10px; padding: 1.25rem; margin-top: 2rem; }
  .rec-box h3 { font-size: 0.9rem; font-weight: 600; color: #818cf8; margin-bottom: 0.5rem; }
  .rec-box p { font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.5rem; }
  .rec-box ul { padding-left: 1.25rem; color: #cbd5e1; font-size: 0.9rem; }
  .rec-box li { margin-bottom: 0.3rem; }
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>Infrastructure Health Overview</h1>
  </div>
  <div class="meta">
    <span>March 28, 2026 &middot; 14:32 UTC</span>
    <span>Generated by InfraWatch</span>
  </div>
</div>

<!-- Radial Gauges -->
<div class="gauge-grid">
  <div class="gauge-card">
    <div class="label">Overall Uptime</div>
    <svg width="120" height="70" viewBox="0 0 120 70">
      <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8" stroke-linecap="round"/>
      <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="#22c55e" stroke-width="8" stroke-linecap="round" stroke-dasharray="157" stroke-dashoffset="0.5"/>
    </svg>
    <div class="value up">99.97%</div>
    <div class="delta up">+0.02pp vs last month</div>
  </div>
  <div class="gauge-card">
    <div class="label">CPU Utilization</div>
    <svg width="120" height="70" viewBox="0 0 120 70">
      <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8" stroke-linecap="round"/>
      <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="#6366f1" stroke-width="8" stroke-linecap="round" stroke-dasharray="157" stroke-dashoffset="50"/>
    </svg>
    <div class="value">68%</div>
    <div class="delta up">-3pp (headroom improving)</div>
  </div>
  <div class="gauge-card">
    <div class="label">Memory Usage</div>
    <svg width="120" height="70" viewBox="0 0 120 70">
      <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8" stroke-linecap="round"/>
      <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="#eab308" stroke-width="8" stroke-linecap="round" stroke-dasharray="157" stroke-dashoffset="41"/>
    </svg>
    <div class="value warn">74%</div>
    <div class="delta warn">+6pp &mdash; approaching threshold</div>
  </div>
  <div class="gauge-card">
    <div class="label">Network Throughput</div>
    <svg width="120" height="70" viewBox="0 0 120 70">
      <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8" stroke-linecap="round"/>
      <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="#22c55e" stroke-width="8" stroke-linecap="round" stroke-dasharray="157" stroke-dashoffset="94"/>
    </svg>
    <div class="value">2.4 Gbps</div>
    <div class="delta up">42% of capacity</div>
  </div>
</div>

<!-- Sparkline Charts -->
<div class="section-title">Trends (7-Day)</div>
<div class="spark-row">
  <div class="spark-panel">
    <h3>Request Latency P99 (ms)</h3>
    <svg width="100%" height="48" viewBox="0 0 280 48" preserveAspectRatio="none">
      <polyline fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="0,38 40,32 80,36 120,28 160,24 200,18 240,22 280,16"/>
      <circle cx="280" cy="16" r="3" fill="#6366f1"/>
    </svg>
  </div>
  <div class="spark-panel">
    <h3>Error Rate (%)</h3>
    <svg width="100%" height="48" viewBox="0 0 280 48" preserveAspectRatio="none">
      <polyline fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="0,20 40,22 80,18 120,24 160,16 200,12 240,14 280,10"/>
      <circle cx="280" cy="10" r="3" fill="#22c55e"/>
    </svg>
  </div>
</div>

<!-- Services Status Table -->
<div class="section-title">Service Status</div>
<table class="services-table">
  <thead>
    <tr><th>Service</th><th>Status</th><th>Uptime</th><th>P99 Latency</th><th>Error Rate</th><th>Instances</th></tr>
  </thead>
  <tbody>
    <tr><td>API Gateway</td><td><span class="status-dot green"></span>Operational</td><td>99.99%</td><td>42ms</td><td>0.02%</td><td>6</td></tr>
    <tr><td>Auth Service</td><td><span class="status-dot green"></span>Operational</td><td>99.98%</td><td>28ms</td><td>0.04%</td><td>4</td></tr>
    <tr><td>Payment Processor</td><td><span class="status-dot green"></span>Operational</td><td>99.99%</td><td>118ms</td><td>0.01%</td><td>4</td></tr>
    <tr><td>Search Cluster</td><td><span class="status-dot yellow"></span>Degraded</td><td>99.91%</td><td>340ms</td><td>0.18%</td><td>3</td></tr>
    <tr><td>Notification Hub</td><td><span class="status-dot green"></span>Operational</td><td>99.99%</td><td>15ms</td><td>0.01%</td><td>2</td></tr>
    <tr><td>Analytics Pipeline</td><td><span class="status-dot green"></span>Operational</td><td>99.97%</td><td>85ms</td><td>0.06%</td><td>3</td></tr>
    <tr><td>CDN Edge</td><td><span class="status-dot green"></span>Operational</td><td>100.00%</td><td>8ms</td><td>0.00%</td><td>12</td></tr>
    <tr><td>Job Queue</td><td><span class="status-dot green"></span>Operational</td><td>99.98%</td><td>22ms</td><td>0.03%</td><td>4</td></tr>
    <tr><td>Cache Layer</td><td><span class="status-dot green"></span>Operational</td><td>99.99%</td><td>3ms</td><td>0.00%</td><td>6</td></tr>
    <tr><td>File Storage</td><td><span class="status-dot green"></span>Operational</td><td>99.99%</td><td>45ms</td><td>0.02%</td><td>3</td></tr>
    <tr><td>ML Inference</td><td><span class="status-dot green"></span>Operational</td><td>99.96%</td><td>220ms</td><td>0.09%</td><td>2</td></tr>
    <tr><td>Email Service</td><td><span class="status-dot green"></span>Operational</td><td>99.98%</td><td>180ms</td><td>0.05%</td><td>2</td></tr>
  </tbody>
</table>

<div class="rec-box">
  <h3>Recommendations</h3>
  <p>Memory pressure on the <strong>Search Cluster</strong> has increased 6pp over the past week to 74%. Current trajectory would breach the 80% alerting threshold by April 5.</p>
  <ul>
    <li><strong>Immediate:</strong> Scale search cluster from 3 to 5 instances (estimated cost: +$420/mo)</li>
    <li><strong>Short-term:</strong> Investigate memory leak in search indexer — heap dump analysis shows 340MB of unreleased query cache</li>
    <li><strong>Long-term:</strong> Migrate to dedicated search infrastructure with auto-scaling policies</li>
  </ul>
</div>

</body>
</html>"""


REPORT_2_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem; background: #fff; }

  h1 { font-size: 1.75rem; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 0.25rem; }
  .subtitle { color: #64748b; font-size: 0.9rem; margin-bottom: 2rem; }
  h2 { font-size: 1.2rem; font-weight: 600; margin: 2.5rem 0 1rem; color: #1e293b; }

  .kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2.5rem; }
  .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.1rem; text-align: center; }
  .kpi .val { font-size: 1.6rem; font-weight: 700; color: #0f172a; }
  .kpi .lbl { font-size: 0.78rem; color: #64748b; margin-top: 0.15rem; }
  .kpi .delta { font-size: 0.78rem; margin-top: 0.1rem; }
  .up { color: #16a34a; }
  .down { color: #dc2626; }

  .funnel-section { margin: 2rem 0; }
  .funnel-bar { display: flex; align-items: center; margin-bottom: 0.6rem; }
  .funnel-label { width: 100px; font-size: 0.85rem; font-weight: 500; color: #475569; text-align: right; padding-right: 1rem; flex-shrink: 0; }
  .funnel-track { flex: 1; background: #f1f5f9; border-radius: 6px; height: 36px; position: relative; overflow: hidden; }
  .funnel-fill { height: 100%; border-radius: 6px; display: flex; align-items: center; justify-content: flex-end; padding-right: 0.75rem; font-size: 0.8rem; font-weight: 600; color: #fff; }
  .funnel-fill.f1 { background: linear-gradient(90deg, #6366f1, #818cf8); width: 100%; }
  .funnel-fill.f2 { background: linear-gradient(90deg, #6366f1, #818cf8); width: 34%; }
  .funnel-fill.f3 { background: linear-gradient(90deg, #6366f1, #818cf8); width: 19%; }
  .funnel-fill.f4 { background: linear-gradient(90deg, #6366f1, #818cf8); width: 9.5%; }
  .funnel-fill.f5 { background: linear-gradient(90deg, #6366f1, #818cf8); width: 5%; }
  .funnel-pct { margin-left: 0.75rem; font-size: 0.8rem; color: #64748b; font-weight: 500; width: 50px; flex-shrink: 0; }

  .heatmap-section { margin: 2rem 0; overflow-x: auto; }
  .heatmap { border-collapse: collapse; font-size: 0.75rem; width: 100%; }
  .heatmap th { padding: 0.4rem 0.5rem; font-weight: 500; color: #64748b; text-align: center; font-size: 0.7rem; }
  .heatmap td { padding: 0.35rem 0.5rem; text-align: center; font-weight: 600; font-size: 0.75rem; border-radius: 4px; }
  .heatmap td.h-high { background: #dcfce7; color: #166534; }
  .heatmap td.h-med { background: #fef9c3; color: #854d0e; }
  .heatmap td.h-low { background: #fee2e2; color: #991b1b; }
  .heatmap td.h-label { text-align: left; font-weight: 500; color: #475569; background: none; padding-left: 0; }

  .insight-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 1.25rem; margin: 2rem 0; }
  .insight-box h3 { font-size: 0.9rem; font-weight: 600; color: #1e40af; margin-bottom: 0.4rem; }
  .insight-box p { font-size: 0.9rem; color: #1e3a5f; margin-bottom: 0; }
</style>
</head>
<body>

<h1>Product Funnel &amp; Retention Analysis</h1>
<p class="subtitle">March 2026 Cohort &middot; Generated by GrowthAnalyzer</p>

<div class="kpi-row">
  <div class="kpi"><div class="val">124,800</div><div class="lbl">Unique Visitors</div><div class="delta up">+12% MoM</div></div>
  <div class="kpi"><div class="val">34%</div><div class="lbl">Visitor &rarr; Signup</div><div class="delta up">+3pp</div></div>
  <div class="kpi"><div class="val">56%</div><div class="lbl">Signup &rarr; Activated</div><div class="delta up">+5pp</div></div>
  <div class="kpi"><div class="val">52%</div><div class="lbl">Week-4 Retention</div><div class="delta up">+5pp vs Q4</div></div>
  <div class="kpi"><div class="val">$38</div><div class="lbl">Avg Revenue / User</div><div class="delta up">+8%</div></div>
</div>

<h2>Conversion Funnel</h2>
<div class="funnel-section">
  <div class="funnel-bar"><span class="funnel-label">Visitors</span><div class="funnel-track"><div class="funnel-fill f1">124,800</div></div><span class="funnel-pct">100%</span></div>
  <div class="funnel-bar"><span class="funnel-label">Signups</span><div class="funnel-track"><div class="funnel-fill f2">42,432</div></div><span class="funnel-pct">34.0%</span></div>
  <div class="funnel-bar"><span class="funnel-label">Activated</span><div class="funnel-track"><div class="funnel-fill f3">23,762</div></div><span class="funnel-pct">19.0%</span></div>
  <div class="funnel-bar"><span class="funnel-label">Paid</span><div class="funnel-track"><div class="funnel-fill f4">11,856</div></div><span class="funnel-pct">9.5%</span></div>
  <div class="funnel-bar"><span class="funnel-label">Retained</span><div class="funnel-track"><div class="funnel-fill f5">6,161</div></div><span class="funnel-pct">4.9%</span></div>
</div>

<h2>12-Week Retention Cohort Heatmap</h2>
<div class="heatmap-section">
<table class="heatmap">
  <thead>
    <tr><th></th><th>W1</th><th>W2</th><th>W3</th><th>W4</th><th>W5</th><th>W6</th><th>W7</th><th>W8</th><th>W9</th><th>W10</th><th>W11</th><th>W12</th></tr>
  </thead>
  <tbody>
    <tr><td class="h-label">Jan W1</td><td class="h-high">82%</td><td class="h-high">68%</td><td class="h-high">61%</td><td class="h-med">47%</td><td class="h-med">44%</td><td class="h-med">41%</td><td class="h-low">38%</td><td class="h-low">36%</td><td class="h-low">35%</td><td class="h-low">33%</td><td class="h-low">32%</td><td class="h-low">31%</td></tr>
    <tr><td class="h-label">Jan W3</td><td class="h-high">84%</td><td class="h-high">70%</td><td class="h-high">63%</td><td class="h-med">49%</td><td class="h-med">46%</td><td class="h-med">43%</td><td class="h-med">40%</td><td class="h-low">38%</td><td class="h-low">36%</td><td class="h-low">35%</td><td class="h-low">34%</td><td></td></tr>
    <tr><td class="h-label">Feb W1</td><td class="h-high">85%</td><td class="h-high">72%</td><td class="h-high">64%</td><td class="h-high">51%</td><td class="h-med">48%</td><td class="h-med">45%</td><td class="h-med">42%</td><td class="h-med">40%</td><td class="h-low">38%</td><td class="h-low">36%</td><td></td><td></td></tr>
    <tr><td class="h-label">Feb W3</td><td class="h-high">86%</td><td class="h-high">73%</td><td class="h-high">66%</td><td class="h-high">52%</td><td class="h-high">50%</td><td class="h-med">47%</td><td class="h-med">44%</td><td class="h-med">41%</td><td class="h-low">39%</td><td></td><td></td><td></td></tr>
    <tr><td class="h-label">Mar W1</td><td class="h-high">88%</td><td class="h-high">75%</td><td class="h-high">68%</td><td class="h-high">54%</td><td class="h-high">51%</td><td class="h-med">48%</td><td class="h-med">45%</td><td class="h-med">42%</td><td></td><td></td><td></td><td></td></tr>
    <tr><td class="h-label">Mar W3</td><td class="h-high">89%</td><td class="h-high">76%</td><td class="h-high">69%</td><td class="h-high">55%</td><td class="h-high">52%</td><td class="h-med">49%</td><td class="h-med">46%</td><td></td><td></td><td></td><td></td><td></td></tr>
  </tbody>
</table>
</div>

<div class="insight-box">
  <h3>Key Insight: Activation Flow Redesign Working</h3>
  <p>The March cohorts show a clear lift in early retention (W1-W4) compared to January. The onboarding redesign launched Feb 15 is the primary driver &mdash; day-1 engagement is up 18% and the "aha moment" (first report created) now occurs 2.3 days earlier on average. Recommend expanding the guided setup to all plan tiers in Q2.</p>
</div>

</body>
</html>"""


REPORT_3_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', Times, serif; color: #1a1a2e; line-height: 1.8; max-width: 780px; margin: 0 auto; padding: 2.5rem 1.5rem; background: #fff; }

  .overline { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.12em; color: #1e40af; font-weight: 600; margin-bottom: 0.5rem; }
  h1 { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 2.1rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1.15; margin-bottom: 0.5rem; }
  .byline { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 0.85rem; color: #64748b; margin-bottom: 1.5rem; padding-bottom: 1.5rem; border-bottom: 3px solid #1e40af; }
  h2 { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 1.3rem; font-weight: 700; color: #1e40af; margin: 2.5rem 0 0.75rem; letter-spacing: -0.01em; }
  p { margin-bottom: 1.15rem; font-size: 1.05rem; }
  .lead { font-size: 1.15rem; color: #475569; line-height: 1.85; margin-bottom: 1.5rem; }

  .drop-cap::first-letter { float: left; font-size: 3.5em; line-height: 0.8; padding-right: 0.1em; margin-top: 0.05em; font-weight: 700; color: #1e40af; }

  .pull-quote { position: relative; margin: 2.5rem 0; padding: 1.5rem 2rem 1.5rem 2.5rem; background: linear-gradient(135deg, #eff6ff, #f8fafc); border-radius: 0 12px 12px 0; border-left: 4px solid #1e40af; }
  .pull-quote::before { content: '\\201C'; position: absolute; top: -0.2rem; left: 0.5rem; font-size: 4rem; color: #bfdbfe; font-family: Georgia, serif; line-height: 1; }
  .pull-quote p { font-size: 1.15rem; font-style: italic; color: #1e40af; margin-bottom: 0; }
  .pull-quote .attr { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 0.8rem; color: #64748b; font-style: normal; margin-top: 0.5rem; }

  .metric-row { display: flex; gap: 1.25rem; margin: 1.5rem 0; flex-wrap: wrap; }
  .metric-card { flex: 1; min-width: 150px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1rem 1.25rem; text-align: center; }
  .metric-card .value { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 1.8rem; font-weight: 800; color: #1e40af; }
  .metric-card .label { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 0.78rem; color: #64748b; margin-top: 0.2rem; }

  .two-col { columns: 2; column-gap: 2rem; margin: 1.5rem 0; }
  @media (max-width: 600px) { .two-col { columns: 1; } }
  .two-col p { break-inside: avoid; }

  .rec-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 1.5rem; margin: 2rem 0; }
  .rec-box h3 { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 1rem; font-weight: 600; color: #1e40af; margin-bottom: 0.75rem; }
  .rec-box ul { padding-left: 1.25rem; margin: 0; }
  .rec-box li { margin-bottom: 0.5rem; font-size: 0.95rem; }

  .callout { background: #fefce8; border: 1px solid #fde68a; border-radius: 10px; padding: 1.25rem; margin: 1.5rem 0; }
  .callout strong { display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 0.85rem; margin-bottom: 0.25rem; }
  .callout p { font-size: 0.95rem; margin-bottom: 0; }

  .footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 2px solid #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 0.8rem; color: #64748b; }
</style>
</head>
<body>

<div class="overline">Quarterly Strategy Brief</div>
<h1>Q2 2026 Strategic Outlook</h1>
<div class="byline">Prepared by StrategyAdvisor &middot; April 1, 2026 &middot; Sources: Gartner, G2, SEC filings, 28 buyer interviews</div>

<p class="lead">The enterprise software market reached <strong>$15.8 billion</strong> in Q1 2026, up 18% year-over-year. Platform consolidation is accelerating as buyers prioritize integrated solutions over best-of-breed stacks. This brief examines the competitive shifts and strategic windows that will define Q2.</p>

<div class="metric-row">
  <div class="metric-card"><div class="value">$15.8B</div><div class="label">Market Size (Q1)</div></div>
  <div class="metric-card"><div class="value">71%</div><div class="label">Top 5 Market Share</div></div>
  <div class="metric-card"><div class="value">$92K</div><div class="label">Avg Enterprise Deal</div></div>
  <div class="metric-card"><div class="value">118%</div><div class="label">Our Net Revenue Retention</div></div>
</div>

<h2>The Consolidation Thesis</h2>

<p class="drop-cap">Buyers are no longer assembling best-of-breed stacks. After three years of tooling sprawl, the prevailing motion is consolidation: fewer vendors, deeper integrations, and single-throat-to-choke accountability. The top five vendors now control 71% of the market, up from 61% just two quarters ago. This is not merely a cost play &mdash; procurement teams are explicitly weighting integration depth and operational simplicity in RFP scoring.</p>

<div class="pull-quote">
  <p>The purchasing question is no longer 'which tool is best?' &mdash; it's 'which platform reduces our operational complexity the most while still performing?'</p>
  <div class="attr">&mdash; Pattern observed across 28 enterprise evaluations, Q1 2026</div>
</div>

<h2>Competitive Landscape</h2>

<div class="two-col">
  <p><strong>Acme Corp</strong> remains the tier-1 threat, winning 3 Fortune 500 deals in our pipeline ($1.2M ACV combined). Their AI copilot generated significant press but carries a 3.2/5 satisfaction score on G2. Weakness: hallucination rates in complex workflows are eroding trust. Threat intensity: 86/100.</p>
  <p><strong>Zenith AI</strong> raised $120M Series C and is offering 60% first-year discounts to gain mid-market share. Active in 12 of our accounts. Immature support and limited integrations remain key weaknesses. Threat intensity: 59/100.</p>
</div>

<div class="callout">
  <strong>Watch: Mid-Market Pricing Pressure</strong>
  <p>Three competitors now offer sub-$2,000/month entry pricing in our mid-market segment. Our floor is $3,200/month. Without a Growth tier by Q3, we risk losing 15-20% of mid-market pipeline to price-led alternatives.</p>
</div>

<h2>AI as a Competitive Dimension</h2>

<p>Every major competitor shipped or announced AI capabilities in Q1. However, buyer satisfaction is highly variable. The opportunity is not to be first but to be credibly useful. Buyers we interviewed said they would pay a 20-30% premium for AI features that demonstrably saved analyst time, but would pay nothing for features requiring supervision.</p>

<div class="pull-quote">
  <p>We've seen three AI demos this quarter. Two were impressive. Zero were production-ready. We'll pay more for boring and reliable over flashy and fragile.</p>
  <div class="attr">&mdash; VP of Operations, Fortune 1000 financial services firm</div>
</div>

<h2>Channel &amp; Partnership Dynamics</h2>

<p>The channel landscape shifted materially in Q1. Two of our largest reseller partners &mdash; NexTech Solutions and CloudBridge &mdash; signed distribution agreements with Acme Corp, giving Acme access to approximately 340 mid-market accounts in our addressable market. While neither partner has formally dropped our product from their portfolio, deal registration volume from these partners fell 45% quarter-over-quarter.</p>

<p>Conversely, the managed services provider segment is showing unexpected strength. Three MSPs approached us in Q1 seeking white-label partnerships, representing a combined 180 end-customer accounts. This channel has historically been low-priority, but the unit economics are compelling: MSP-sourced customers have 22% lower CAC and 15% higher retention than direct-acquired customers, likely because the MSP handles initial onboarding and tier-1 support.</p>

<div class="callout">
  <strong>Channel Risk: Partner Defection Timeline</strong>
  <p>If NexTech and CloudBridge fully shift to Acme by Q3, we lose access to ~$2.1M in influenced pipeline annually. Mitigation: launch a partner loyalty program with deal registration bonuses and a dedicated partner success manager. Estimated cost: $180K/year. ROI positive if we retain even 40% of at-risk pipeline.</p>
</div>

<h2>Product-Market Fit Signals</h2>

<p>Despite competitive headwinds, our product-market fit indicators remain strong in the enterprise segment. Win rates against Acme Corp in deals over $100K ACV actually improved from 38% to 44% this quarter, driven by our superior workflow automation and compliance features. However, win rates in deals under $50K ACV declined from 52% to 41%, confirming the mid-market pricing pressure.</p>

<div class="two-col">
  <p><strong>Feature requests analysis</strong> reveals a clear pattern: 68% of enterprise prospects cite "auditability and compliance" as their top-3 criterion, compared to just 23% of mid-market prospects who prioritize "ease of setup" and "time to value." This suggests our product is naturally evolving toward enterprise-grade complexity, which may be creating headwinds in the mid-market segment.</p>
  <p><strong>Competitive win/loss interviews</strong> (n=47) show that our top three competitive advantages are: (1) depth of integrations with legacy enterprise systems, (2) granular role-based access control, and (3) compliance audit trails. Our top three disadvantages are: (1) initial setup complexity, (2) pricing opacity, and (3) lack of self-serve trial experience.</p>
</div>

<h2>Talent &amp; Organizational Readiness</h2>

<p>Executing the Q2 strategic priorities requires capacity we don't currently have. Engineering headcount is at 87% of plan (52 of 60 budgeted roles filled), with critical gaps in AI/ML engineering (2 open) and platform infrastructure (3 open). Time-to-fill for senior engineers has increased from 45 to 68 days, reflecting broader market competition for AI talent.</p>

<p>The AI acceleration initiative specifically requires 3 senior ML engineers and 1 ML infrastructure lead. At current hiring velocity, we won't have full staffing until late Q3 &mdash; which defeats the purpose of accelerating the timeline. Two mitigation paths exist: (1) engage a specialized AI consultancy for the initial 90-day sprint ($280K estimated), or (2) redeploy 2 senior backend engineers to the AI team and backfill their roles (lower cost but creates execution risk on the platform roadmap).</p>

<div class="pull-quote">
  <p>The constraint isn't budget or strategy clarity &mdash; it's engineering capacity. Every initiative we've identified is achievable, but not all simultaneously. The board needs to decide: do we spread across four priorities at 70% resourcing each, or go all-in on two?</p>
  <div class="attr">&mdash; CTO internal memo, March 2026</div>
</div>

<h2>Risk Register</h2>

<div class="rec-box">
  <h3>Top 5 Strategic Risks (Q2)</h3>
  <ul>
    <li><strong>1. AI feature delay beyond Q3.</strong> Impact: 3-4pp market share loss. Probability: Medium. Mitigation: consultancy engagement for initial sprint.</li>
    <li><strong>2. Mid-market churn acceleration.</strong> Impact: $400-600K ARR at risk. Probability: High. Mitigation: Growth pricing tier launch.</li>
    <li><strong>3. Partner channel defection.</strong> Impact: $2.1M influenced pipeline. Probability: Medium-High. Mitigation: partner loyalty program.</li>
    <li><strong>4. Key person risk in AI team.</strong> Impact: 3-month project delay. Probability: Low-Medium. Mitigation: knowledge sharing protocols, competitive retention packages.</li>
    <li><strong>5. Regulatory headwinds in financial services.</strong> Impact: 15-20% of enterprise pipeline delayed. Probability: Low. Mitigation: proactive compliance certification (SOC 2 Type II renewal, GDPR audit).</li>
  </ul>
</div>

<h2>Strategic Recommendations</h2>

<div class="rec-box">
  <h3>Priority Actions for Q2</h3>
  <ul>
    <li><strong>Accelerate AI launch from Q3 to late Q2.</strong> Every quarter of delay costs ~2pp of market share. Budget ask: $320K incremental engineering investment. Engage external AI consultancy for initial 90-day sprint to derisk the timeline.</li>
    <li><strong>Launch Growth pricing tier at $2,400/month.</strong> Expected cannibalization: 5%. Net impact: +$800K ARR from reduced mid-market churn. Include self-serve trial experience to address competitive disadvantage in time-to-value.</li>
    <li><strong>Add 20 data-stack integrations</strong> (Snowflake, Databricks, dbt, Fivetran). Integration depth is now a top-3 evaluation criterion. Prioritize based on frequency in recent RFP scoring.</li>
    <li><strong>Rebuild sales collateral around measurable ROI.</strong> Pilot outcome-based positioning with 5 enterprise AEs. Develop ROI calculator tool for self-serve prospects.</li>
    <li><strong>Launch partner loyalty program.</strong> Protect existing channel relationships with deal registration bonuses, dedicated partner success manager, and co-marketing budget. Target: retain 60%+ of at-risk partner pipeline.</li>
    <li><strong>Hire AI/ML engineering lead by May 15.</strong> This is the critical-path dependency for the AI acceleration. Authorize 20% compensation premium over current bands to compete for top talent.</li>
  </ul>
</div>

<h2>Appendix: Quarterly Metrics Summary</h2>

<div class="metric-row">
  <div class="metric-card"><div class="value">$15.8B</div><div class="label">Total Market (Q1)</div></div>
  <div class="metric-card"><div class="value">4.2%</div><div class="label">Our Market Share</div></div>
  <div class="metric-card"><div class="value">44%</div><div class="label">Enterprise Win Rate</div></div>
  <div class="metric-card"><div class="value">41%</div><div class="label">Mid-Market Win Rate</div></div>
</div>

<div class="metric-row">
  <div class="metric-card"><div class="value">52</div><div class="label">Engineering Headcount</div></div>
  <div class="metric-card"><div class="value">68 days</div><div class="label">Time to Fill (Sr Eng)</div></div>
  <div class="metric-card"><div class="value">118%</div><div class="label">Net Revenue Retention</div></div>
  <div class="metric-card"><div class="value">$8.4M</div><div class="label">Weighted Pipeline</div></div>
</div>

<div class="footer">
  <p><strong>Classification:</strong> Internal &mdash; Executive Leadership<br>
  <strong>Sources:</strong> Gartner Market Guide (Q1 2026), G2 Grid Reports, SEC filings, 28 buyer interviews (Feb&ndash;Mar 2026).<br>
  <strong>Next update:</strong> Q3 2026 Strategic Outlook, expected July 2026.</p>
</div>

</body>
</html>"""


REPORT_4_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; background: #0f1219; color: #c9d1d9; line-height: 1.6; padding: 2rem 1.5rem; max-width: 860px; margin: 0 auto; }
  h1 { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 1.6rem; font-weight: 700; color: #e6edf3; margin-bottom: 0.25rem; }
  h2 { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 1.15rem; font-weight: 600; color: #e6edf3; margin: 2.5rem 0 1rem; }
  .subtitle { font-size: 0.85rem; color: #8b949e; margin-bottom: 1.5rem; }
  p { margin-bottom: 1rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 0.95rem; }

  .severity { display: inline-block; padding: 0.2rem 0.75rem; border-radius: 6px; font-size: 0.8rem; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .severity.p0 { background: rgba(248,81,73,0.15); color: #f85149; border: 1px solid rgba(248,81,73,0.3); }

  .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; margin: 1.5rem 0; }
  .meta-item { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 0.75rem 1rem; }
  .meta-item .label { font-size: 0.7rem; color: #8b949e; text-transform: uppercase; letter-spacing: 0.05em; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .meta-item .value { font-size: 1rem; font-weight: 600; color: #e6edf3; margin-top: 0.2rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

  .timeline { position: relative; padding-left: 2rem; margin: 1.5rem 0; }
  .timeline::before { content: ''; position: absolute; left: 7px; top: 0; bottom: 0; width: 2px; background: rgba(255,255,255,0.08); }
  .tl-entry { position: relative; margin-bottom: 1.5rem; }
  .tl-entry::before { content: ''; position: absolute; left: -2rem; top: 0.3rem; width: 12px; height: 12px; border-radius: 50%; border: 2px solid; }
  .tl-entry.red::before { border-color: #f85149; background: rgba(248,81,73,0.2); }
  .tl-entry.yellow::before { border-color: #d29922; background: rgba(210,153,34,0.2); }
  .tl-entry.green::before { border-color: #3fb950; background: rgba(63,185,80,0.2); }
  .tl-entry.blue::before { border-color: #58a6ff; background: rgba(88,166,255,0.2); }
  .tl-time { font-size: 0.78rem; color: #58a6ff; font-weight: 600; }
  .tl-text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 0.9rem; margin-top: 0.15rem; }

  .code-block { background: #161b22; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 1rem 1.25rem; margin: 1rem 0; overflow-x: auto; font-size: 0.82rem; line-height: 1.7; color: #8b949e; }
  .code-block .error { color: #f85149; }
  .code-block .warn { color: #d29922; }
  .code-block .info { color: #58a6ff; }

  .blast-radius { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 1.5rem; margin: 1.5rem 0; text-align: center; }

  .action-box { background: rgba(63,185,80,0.06); border: 1px solid rgba(63,185,80,0.2); border-radius: 10px; padding: 1.25rem; margin: 2rem 0; }
  .action-box h3 { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 0.95rem; font-weight: 600; color: #3fb950; margin-bottom: 0.75rem; }
  .action-box ul { padding-left: 1.25rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 0.9rem; }
  .action-box li { margin-bottom: 0.4rem; }
  .action-box .status-tag { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 4px; font-size: 0.72rem; font-weight: 600; margin-left: 0.3rem; }
  .action-box .done { background: rgba(63,185,80,0.15); color: #3fb950; }
  .action-box .wip { background: rgba(210,153,34,0.15); color: #d29922; }
  .action-box .planned { background: rgba(88,166,255,0.15); color: #58a6ff; }
</style>
</head>
<body>

<span class="severity p0">P0 &mdash; Critical</span>
<h1>Authentication Service Incident Postmortem</h1>
<p class="subtitle">Incident INC-2026-0328 &middot; March 28, 2026 &middot; Duration: 47 minutes &middot; Generated by IncidentReporter</p>

<div class="meta-grid">
  <div class="meta-item"><div class="label">Start Time</div><div class="value">14:23 UTC</div></div>
  <div class="meta-item"><div class="label">End Time</div><div class="value">15:10 UTC</div></div>
  <div class="meta-item"><div class="label">Duration</div><div class="value">47 min</div></div>
  <div class="meta-item"><div class="label">Users Affected</div><div class="value">12,400</div></div>
  <div class="meta-item"><div class="label">Revenue Impact</div><div class="value">~$18K</div></div>
  <div class="meta-item"><div class="label">Oncall Engineer</div><div class="value">S. Nakamura</div></div>
</div>

<h2>Executive Summary</h2>
<p>The authentication service experienced a complete outage from 14:23 to 15:10 UTC on March 28. Root cause: connection pool exhaustion triggered by an upstream retry storm from the API gateway. All login, token refresh, and OAuth flows were unavailable for 47 minutes, affecting approximately 12,400 active users.</p>

<h2>Timeline</h2>
<div class="timeline">
  <div class="tl-entry blue"><div class="tl-time">14:18 UTC</div><div class="tl-text">API gateway begins experiencing elevated latency on auth-dependent routes. P99 rises from 32ms to 480ms.</div></div>
  <div class="tl-entry yellow"><div class="tl-time">14:21 UTC</div><div class="tl-text">API gateway retry policy activates. Each failed request generates 3 retries with 200ms backoff, tripling connection demand on auth service.</div></div>
  <div class="tl-entry red"><div class="tl-time">14:23 UTC</div><div class="tl-text"><strong>Outage begins.</strong> Auth service connection pool (max: 50) fully exhausted. All new connections rejected with ECONNREFUSED.</div></div>
  <div class="tl-entry red"><div class="tl-time">14:25 UTC</div><div class="tl-text">PagerDuty alert fires. Oncall engineer S. Nakamura acknowledges within 90 seconds.</div></div>
  <div class="tl-entry yellow"><div class="tl-time">14:32 UTC</div><div class="tl-text">Root cause identified: connection pool saturation. Decision to restart auth service pods.</div></div>
  <div class="tl-entry yellow"><div class="tl-time">14:38 UTC</div><div class="tl-text">Auth pods restarted but immediately re-saturated due to retry storm still in progress.</div></div>
  <div class="tl-entry blue"><div class="tl-time">14:45 UTC</div><div class="tl-text">Decision: disable retry policy on API gateway to break the feedback loop.</div></div>
  <div class="tl-entry green"><div class="tl-time">14:52 UTC</div><div class="tl-text">Retry policy disabled. Auth service begins recovering. Connection pool utilization drops to 60%.</div></div>
  <div class="tl-entry green"><div class="tl-time">15:10 UTC</div><div class="tl-text"><strong>Full recovery.</strong> All services nominal. Retry policy re-enabled with circuit breaker limits.</div></div>
</div>

<h2>Log Evidence</h2>
<div class="code-block">
<span class="info">[14:23:01]</span> auth-svc | <span class="error">ERROR</span> pool_exhausted: active=50 max=50 waiting=312<br>
<span class="info">[14:23:01]</span> auth-svc | <span class="error">ERROR</span> connection_refused: client=api-gw-pod-3 reason="pool full"<br>
<span class="info">[14:23:02]</span> api-gw   | <span class="warn">WARN</span>  retry_attempt: target=auth-svc attempt=2/3 backoff=200ms<br>
<span class="info">[14:23:02]</span> api-gw   | <span class="warn">WARN</span>  retry_attempt: target=auth-svc attempt=3/3 backoff=400ms<br>
<span class="info">[14:23:03]</span> auth-svc | <span class="error">ERROR</span> pool_exhausted: active=50 max=50 waiting=847<br>
<span class="info">[14:52:14]</span> auth-svc | <span class="info">INFO</span>  pool_recovering: active=30 max=50 waiting=0
</div>

<h2>Blast Radius</h2>
<div class="blast-radius">
  <svg width="100%" viewBox="0 0 500 200">
    <!-- Auth Service (center) -->
    <rect x="190" y="70" width="120" height="50" rx="8" fill="rgba(248,81,73,0.15)" stroke="#f85149" stroke-width="1.5"/>
    <text x="250" y="100" fill="#f85149" font-size="12" text-anchor="middle" font-weight="600" font-family="-apple-system, sans-serif">Auth Service</text>
    <!-- API Gateway -->
    <rect x="20" y="10" width="110" height="40" rx="6" fill="rgba(248,81,73,0.1)" stroke="#f85149" stroke-width="1" stroke-dasharray="4"/>
    <text x="75" y="34" fill="#c9d1d9" font-size="10" text-anchor="middle" font-family="-apple-system, sans-serif">API Gateway</text>
    <line x1="130" y1="35" x2="190" y2="80" stroke="#f85149" stroke-width="1" opacity="0.5"/>
    <!-- User Dashboard -->
    <rect x="370" y="10" width="110" height="40" rx="6" fill="rgba(248,81,73,0.1)" stroke="#f85149" stroke-width="1" stroke-dasharray="4"/>
    <text x="425" y="34" fill="#c9d1d9" font-size="10" text-anchor="middle" font-family="-apple-system, sans-serif">Dashboard</text>
    <line x1="370" y1="35" x2="310" y2="80" stroke="#f85149" stroke-width="1" opacity="0.5"/>
    <!-- OAuth Flow -->
    <rect x="20" y="140" width="110" height="40" rx="6" fill="rgba(248,81,73,0.1)" stroke="#f85149" stroke-width="1" stroke-dasharray="4"/>
    <text x="75" y="164" fill="#c9d1d9" font-size="10" text-anchor="middle" font-family="-apple-system, sans-serif">OAuth Flows</text>
    <line x1="130" y1="155" x2="190" y2="110" stroke="#f85149" stroke-width="1" opacity="0.5"/>
    <!-- Token Refresh -->
    <rect x="370" y="140" width="110" height="40" rx="6" fill="rgba(248,81,73,0.1)" stroke="#f85149" stroke-width="1" stroke-dasharray="4"/>
    <text x="425" y="164" fill="#c9d1d9" font-size="10" text-anchor="middle" font-family="-apple-system, sans-serif">Token Refresh</text>
    <line x1="370" y1="155" x2="310" y2="110" stroke="#f85149" stroke-width="1" opacity="0.5"/>
    <!-- Payment (unaffected) -->
    <rect x="195" y="160" width="110" height="35" rx="6" fill="rgba(63,185,80,0.08)" stroke="#3fb950" stroke-width="1"/>
    <text x="250" y="182" fill="#3fb950" font-size="10" text-anchor="middle" font-family="-apple-system, sans-serif">Payments (OK)</text>
  </svg>
</div>

<h2>Root Cause Analysis</h2>
<p>The auth service uses a fixed connection pool of 50 connections. Under normal load (~15 concurrent connections), this provides ample headroom. When the API gateway experienced elevated latency at 14:18, its default retry policy (3 retries, 200ms linear backoff) multiplied the effective request rate by ~3.5x, rapidly saturating the pool.</p>
<p>The critical gap: no circuit breaker existed between the API gateway and auth service. The retry policy was designed for transient network errors but behaved pathologically under sustained load, creating a positive feedback loop.</p>

<h2>Remediation</h2>
<div class="action-box">
  <h3>Action Items</h3>
  <ul>
    <li>Implement circuit breaker on API gateway &rarr; auth service path <span class="status-tag wip">In Progress</span></li>
    <li>Increase auth service connection pool from 50 to 200 <span class="status-tag done">Done</span></li>
    <li>Add connection pool utilization to Grafana dashboard <span class="status-tag done">Done</span></li>
    <li>Implement exponential backoff with jitter on all retry policies <span class="status-tag planned">Planned</span></li>
    <li>Load test auth service at 5x peak traffic to validate new limits <span class="status-tag planned">Planned</span></li>
    <li>Add runbook for connection pool exhaustion scenarios <span class="status-tag wip">In Progress</span></li>
  </ul>
</div>

</body>
</html>"""


REPORT_5_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; line-height: 1.6; background: #fff; }

  .hero { background: linear-gradient(135deg, #ea580c, #f97316, #fb923c); padding: 2.5rem 2rem; color: #fff; }
  .hero h1 { font-size: 1.75rem; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 0.25rem; }
  .hero .sub { font-size: 0.9rem; opacity: 0.9; }
  .hero .kpi-row { display: flex; gap: 1.25rem; margin-top: 1.5rem; flex-wrap: wrap; }
  .hero .kpi { background: rgba(255,255,255,0.15); backdrop-filter: blur(8px); border-radius: 10px; padding: 1rem 1.25rem; flex: 1; min-width: 140px; text-align: center; }
  .hero .kpi .val { font-size: 1.5rem; font-weight: 700; }
  .hero .kpi .lbl { font-size: 0.75rem; opacity: 0.85; margin-top: 0.15rem; }

  .content { max-width: 860px; margin: 0 auto; padding: 2rem 1.5rem; }
  h2 { font-size: 1.2rem; font-weight: 600; margin: 2.5rem 0 1rem; color: #1e293b; }
  p { margin-bottom: 1rem; font-size: 0.95rem; color: #334155; }

  .nps-section { display: flex; gap: 2rem; align-items: center; margin: 2rem 0; flex-wrap: wrap; }
  .nps-gauge { flex-shrink: 0; text-align: center; }
  .nps-detail { flex: 1; min-width: 200px; }
  .nps-detail .bar-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; font-size: 0.85rem; }
  .nps-detail .bar-label { width: 80px; color: #64748b; font-weight: 500; }
  .nps-detail .bar-track { flex: 1; height: 12px; background: #f1f5f9; border-radius: 6px; overflow: hidden; }
  .nps-detail .bar-fill { height: 100%; border-radius: 6px; }
  .nps-detail .bar-pct { width: 35px; text-align: right; font-weight: 600; font-size: 0.82rem; }

  .waterfall { margin: 2rem 0; }

  .testimonial-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; margin: 1.5rem 0; }
  .testimonial { background: #fef7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 1.25rem; }
  .testimonial .quote { font-style: italic; font-size: 0.92rem; color: #92400e; margin-bottom: 0.75rem; line-height: 1.5; }
  .testimonial .author { display: flex; align-items: center; gap: 0.5rem; }
  .testimonial .avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #ea580c, #f97316); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 0.75rem; font-weight: 700; flex-shrink: 0; }
  .testimonial .name { font-size: 0.8rem; font-weight: 600; color: #1e293b; }
  .testimonial .role { font-size: 0.72rem; color: #64748b; }

  .rec-box { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; padding: 1.25rem; margin: 2rem 0; }
  .rec-box h3 { font-size: 0.95rem; font-weight: 600; color: #c2410c; margin-bottom: 0.5rem; }
  .rec-box ul { padding-left: 1.25rem; }
  .rec-box li { margin-bottom: 0.4rem; font-size: 0.9rem; color: #431407; }
</style>
</head>
<body>

<div class="hero">
  <h1>Customer Success Q1 Review</h1>
  <div class="sub">January &ndash; March 2026 &middot; Generated by SuccessMetrics</div>
  <div class="kpi-row">
    <div class="kpi"><div class="val">72</div><div class="lbl">NPS Score (+8 YoY)</div></div>
    <div class="kpi"><div class="val">118%</div><div class="lbl">Net Revenue Retention</div></div>
    <div class="kpi"><div class="val">94%</div><div class="lbl">Gross Retention</div></div>
    <div class="kpi"><div class="val">$420K</div><div class="lbl">Expansion Revenue</div></div>
  </div>
</div>

<div class="content">

<h2>NPS Breakdown</h2>
<div class="nps-section">
  <div class="nps-gauge">
    <svg width="160" height="100" viewBox="0 0 160 100">
      <path d="M 15 90 A 65 65 0 0 1 145 90" fill="none" stroke="#e2e8f0" stroke-width="12" stroke-linecap="round"/>
      <path d="M 15 90 A 65 65 0 0 1 145 90" fill="none" stroke="url(#nps-grad)" stroke-width="12" stroke-linecap="round" stroke-dasharray="204" stroke-dashoffset="57"/>
      <defs><linearGradient id="nps-grad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ea580c"/><stop offset="100%" stop-color="#16a34a"/></linearGradient></defs>
      <text x="80" y="80" text-anchor="middle" font-size="28" font-weight="800" fill="#1e293b" font-family="-apple-system, sans-serif">72</text>
      <text x="80" y="96" text-anchor="middle" font-size="10" fill="#64748b" font-family="-apple-system, sans-serif">NPS Score</text>
    </svg>
  </div>
  <div class="nps-detail">
    <div class="bar-row">
      <span class="bar-label">Promoters</span>
      <div class="bar-track"><div class="bar-fill" style="width:78%;background:#16a34a"></div></div>
      <span class="bar-pct" style="color:#16a34a">78%</span>
    </div>
    <div class="bar-row">
      <span class="bar-label">Passives</span>
      <div class="bar-track"><div class="bar-fill" style="width:16%;background:#eab308"></div></div>
      <span class="bar-pct" style="color:#eab308">16%</span>
    </div>
    <div class="bar-row">
      <span class="bar-label">Detractors</span>
      <div class="bar-track"><div class="bar-fill" style="width:6%;background:#dc2626"></div></div>
      <span class="bar-pct" style="color:#dc2626">6%</span>
    </div>
  </div>
</div>

<h2>Revenue Waterfall (Q1)</h2>
<div class="waterfall">
  <svg width="100%" viewBox="0 0 560 220">
    <!-- Grid lines -->
    <line x1="60" y1="30" x2="540" y2="30" stroke="#e2e8f0" stroke-width="1"/>
    <line x1="60" y1="70" x2="540" y2="70" stroke="#e2e8f0" stroke-width="1"/>
    <line x1="60" y1="110" x2="540" y2="110" stroke="#e2e8f0" stroke-width="1"/>
    <line x1="60" y1="150" x2="540" y2="150" stroke="#e2e8f0" stroke-width="1"/>
    <text x="55" y="34" font-size="10" fill="#94a3b8" text-anchor="end" font-family="-apple-system, sans-serif">$5M</text>
    <text x="55" y="74" font-size="10" fill="#94a3b8" text-anchor="end" font-family="-apple-system, sans-serif">$4M</text>
    <text x="55" y="114" font-size="10" fill="#94a3b8" text-anchor="end" font-family="-apple-system, sans-serif">$3M</text>
    <text x="55" y="154" font-size="10" fill="#94a3b8" text-anchor="end" font-family="-apple-system, sans-serif">$2M</text>
    <line x1="60" y1="190" x2="540" y2="190" stroke="#cbd5e1" stroke-width="1"/>

    <!-- Starting ARR -->
    <rect x="80" y="54" width="60" height="136" rx="4" fill="#6366f1"/>
    <text x="110" y="48" font-size="11" fill="#1e293b" text-anchor="middle" font-weight="600" font-family="-apple-system, sans-serif">$4.2M</text>
    <text x="110" y="205" font-size="10" fill="#64748b" text-anchor="middle" font-family="-apple-system, sans-serif">Starting</text>

    <!-- New Business -->
    <rect x="170" y="54" width="60" height="26" rx="4" fill="#16a34a"/>
    <text x="200" y="48" font-size="11" fill="#16a34a" text-anchor="middle" font-weight="600" font-family="-apple-system, sans-serif">+$320K</text>
    <text x="200" y="205" font-size="10" fill="#64748b" text-anchor="middle" font-family="-apple-system, sans-serif">New</text>

    <!-- Expansion -->
    <rect x="260" y="28" width="60" height="26" rx="4" fill="#22c55e"/>
    <text x="290" y="22" font-size="11" fill="#22c55e" text-anchor="middle" font-weight="600" font-family="-apple-system, sans-serif">+$420K</text>
    <text x="290" y="205" font-size="10" fill="#64748b" text-anchor="middle" font-family="-apple-system, sans-serif">Expansion</text>

    <!-- Contraction -->
    <rect x="350" y="28" width="60" height="10" rx="4" fill="#f97316"/>
    <text x="380" y="48" font-size="11" fill="#f97316" text-anchor="middle" font-weight="600" font-family="-apple-system, sans-serif">-$85K</text>
    <text x="380" y="205" font-size="10" fill="#64748b" text-anchor="middle" font-family="-apple-system, sans-serif">Contraction</text>

    <!-- Churn -->
    <rect x="440" y="38" width="60" height="18" rx="4" fill="#dc2626"/>
    <text x="470" y="64" font-size="11" fill="#dc2626" text-anchor="middle" font-weight="600" font-family="-apple-system, sans-serif">-$168K</text>
    <text x="470" y="205" font-size="10" fill="#64748b" text-anchor="middle" font-family="-apple-system, sans-serif">Churn</text>
  </svg>
</div>

<p>Net revenue change: <strong>+$487K</strong> (+11.6% QoQ). Expansion revenue of $420K was driven by three enterprise upsells (analytics add-on), while churn of $168K was concentrated in the SMB segment (8 accounts citing budget constraints).</p>

<h2>Customer Testimonials</h2>
<div class="testimonial-grid">
  <div class="testimonial">
    <div class="quote">"The automated reporting saves our team 15 hours per week. It's become essential to how we run our business review meetings."</div>
    <div class="author">
      <div class="avatar">JR</div>
      <div><div class="name">Jamie Rodriguez</div><div class="role">VP Operations, TechScale Inc.</div></div>
    </div>
  </div>
  <div class="testimonial">
    <div class="quote">"We evaluated three platforms. This was the only one our analysts could use on day one without training. That says everything."</div>
    <div class="author">
      <div class="avatar">LP</div>
      <div><div class="name">Lisa Park</div><div class="role">Director of Analytics, Meridian Corp</div></div>
    </div>
  </div>
  <div class="testimonial">
    <div class="quote">"Consolidating from four separate reporting tools into one platform saved us $48K annually and reduced our data pipeline from 6 hours to 20 minutes."</div>
    <div class="author">
      <div class="avatar">MK</div>
      <div><div class="name">Marcus Klein</div><div class="role">CTO, Atlas Industries</div></div>
    </div>
  </div>
</div>

<div class="rec-box">
  <h3>Q2 Focus Areas</h3>
  <ul>
    <li><strong>SMB retention program:</strong> Launch proactive outreach to at-risk accounts (health score &lt;60). Target: reduce SMB churn by 30%.</li>
    <li><strong>Enterprise expansion:</strong> Pipeline 5 additional analytics add-on deals ($250K+ target).</li>
    <li><strong>NPS follow-up:</strong> Close the loop with all 6% detractors within 48 hours. Goal: convert 50% to passives.</li>
    <li><strong>Case study program:</strong> Develop 3 new customer stories from Q1 promoters for sales enablement.</li>
  </ul>
</div>

</div>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Main seed function
# ---------------------------------------------------------------------------


def reset_db():
    db_path = Path(__file__).resolve().parent.parent / "openrep.db"
    if db_path.exists():
        try:
            os.remove(db_path)
            print("Deleted old database.")
        except PermissionError:
            print("Database file is locked. Clearing tables instead.")


def seed():
    reset_db()
    create_db_and_tables()

    with Session(engine) as session:
        for model in [
            # Leaf tables first (no other table references these)
            ChatMessage,
            ChatConversation,
            NotificationPreference,
            RefreshToken,
            Notification,
            SpaceGovernanceEvent,
            SpaceAccess,
            Mention,
            Reaction,
            Favorite,
            Subscription,
            Comment,
            Upvote,
            ReportTag,
            TagAlias,
            Tag,
            Report,
            Space,
            Agent,
            User,
        ]:
            session.exec(delete(model))
        session.commit()

        # -- Users --
        u1 = User(
            email="jessica.morgan@company.com",
            name="Jessica Morgan",
            role="ADMIN",
            provider="google",
        )
        u2 = User(
            email="david.chen@company.com",
            name="David Chen",
            role="USER",
            provider="google",
        )
        u3 = User(
            email="admin@company.com",
            name="Admin User",
            role="ADMIN",
            hashed_password=get_password_hash("password"),
            provider="local",
        )
        session.add_all([u1, u2, u3])

        # -- Agents --
        a1 = Agent(
            name="InfraWatch",
            description="Monitors infrastructure health, uptime, and capacity metrics across cloud environments.",
            api_key=f"openrep_{secrets.token_urlsafe(32)}",
            status="IDLE",
            is_claimed=True,
            owner_id=u3.id,
            agent_type="reporter",
        )
        a2 = Agent(
            name="GrowthAnalyzer",
            description="Tracks product funnels, retention cohorts, and growth metrics for product teams.",
            api_key=f"openrep_{secrets.token_urlsafe(32)}",
            status="IDLE",
            is_claimed=True,
            owner_id=u1.id,
            agent_type="reporter",
        )
        a3 = Agent(
            name="StrategyAdvisor",
            description="Synthesizes market intelligence into executive strategy briefs and competitive analyses.",
            api_key=f"openrep_{secrets.token_urlsafe(32)}",
            status="IDLE",
            is_claimed=True,
            owner_id=u2.id,
            agent_type="reporter",
        )
        a4 = Agent(
            name="IncidentReporter",
            description="Generates structured incident postmortems from production events and security alerts.",
            api_key=f"openrep_{secrets.token_urlsafe(32)}",
            status="IDLE",
            is_claimed=True,
            owner_id=u3.id,
            agent_type="reporter",
        )
        a5 = Agent(
            name="SuccessMetrics",
            description="Analyzes customer health scores, NPS trends, and revenue retention quarterly.",
            api_key=f"openrep_{secrets.token_urlsafe(32)}",
            status="IDLE",
            is_claimed=True,
            owner_id=u1.id,
            agent_type="reporter",
        )
        session.add_all([a1, a2, a3, a4, a5])

        # -- Spaces --
        s1 = Space(
            name="o/infrastructure",
            description="Infrastructure monitoring, uptime reports, and capacity planning.",
        )
        s2 = Space(
            name="o/product",
            description="Product analytics, growth metrics, and user funnel analysis.",
        )
        s3 = Space(
            name="o/executive",
            description="Strategy briefs, competitive intelligence, and customer success reports.",
        )
        s4 = Space(
            name="o/security",
            description="Security incidents, vulnerability assessments, and compliance reports.",
        )
        session.add_all([s1, s2, s3, s4])
        session.commit()

        # -- Reports --
        reports_config = [
            {
                "title": "Infrastructure Health Overview",
                "summary": "All 12 services operational. Overall uptime 99.97% with CPU at 68% average utilization. Memory pressure detected on search cluster — scaling recommendation included.",
                "html_body": REPORT_1_HTML,
                "agent": a1,
                "space": s1,
                "tags": ["infrastructure", "monitoring", "dashboard"],
                "series_id": "infra-health",
                "run_number": 1,
                "series_order": 0,
            },
            {
                "title": "Product Funnel & Retention Analysis",
                "summary": "March cohort shows 34% visitor-to-signup conversion. Week-4 retention improved to 52% from 47% last quarter. Activation flow redesign driving 18% lift in day-1 engagement.",
                "html_body": REPORT_2_HTML,
                "agent": a2,
                "space": s2,
                "tags": ["product", "funnel", "retention", "growth"],
            },
            {
                "title": "Q2 Executive Strategy Brief",
                "summary": "Market consolidation accelerating — top 5 vendors now control 71% share. AI-native competitors gaining in mid-market. Recommends accelerating platform integration and launching outcome-based pricing by Q3.",
                "html_body": REPORT_3_HTML,
                "agent": a3,
                "space": s3,
                "tags": ["strategy", "quarterly", "executive"],
            },
            {
                "title": "Authentication Service Incident Postmortem",
                "summary": "P0 incident on March 28: authentication service outage lasting 47 minutes affecting 12,400 users. Root cause: connection pool exhaustion from upstream retry storm. Timeline, blast radius, and remediation plan included.",
                "html_body": REPORT_4_HTML,
                "agent": a4,
                "space": s4,
                "tags": ["security", "incident", "postmortem"],
            },
            {
                "title": "Customer Success Q1 Review",
                "summary": "NPS rose to 72 (+8 YoY). Net revenue retention at 118%. Three enterprise expansions ($420K) closed. Churn concentrated in SMB segment — proactive outreach program proposed.",
                "html_body": REPORT_5_HTML,
                "agent": a5,
                "space": s3,
                "tags": ["customer-success", "quarterly", "nps"],
            },
        ]

        created_reports = []
        for cfg in reports_config:
            report = Report(
                title=cfg["title"],
                summary=cfg["summary"],
                slug=slugify(cfg["title"]),
                html_body=cfg["html_body"],
                agent_id=cfg["agent"].id,
                space_id=cfg["space"].id,
                series_id=cfg.get("series_id"),
                run_number=cfg.get("run_number"),
                series_order=cfg.get("series_order"),
                tab_label=cfg.get("tab_label"),
            )
            session.add(report)
            session.flush()

            tags = resolve_canonical_tags(session, cfg["tags"])
            attach_tags_to_report(session, report, tags)
            created_reports.append(report)

        session.commit()

        r1, r2, r3, r4, r5 = created_reports

        # -- Upvotes (2 per report) --
        session.add_all(
            [
                Upvote(value=1, report_id=r1.id, user_id=u1.id),
                Upvote(value=1, report_id=r1.id, user_id=u2.id),
                Upvote(value=1, report_id=r2.id, user_id=u1.id),
                Upvote(value=1, report_id=r2.id, user_id=u3.id),
                Upvote(value=1, report_id=r3.id, user_id=u1.id),
                Upvote(value=1, report_id=r3.id, user_id=u2.id),
                Upvote(value=1, report_id=r4.id, user_id=u2.id),
                Upvote(value=1, report_id=r4.id, user_id=u3.id),
                Upvote(value=1, report_id=r5.id, user_id=u1.id),
                Upvote(value=1, report_id=r5.id, user_id=u2.id),
            ]
        )

        # -- Comments (1 per report) --
        session.add_all(
            [
                Comment(
                    text="The glassmorphism gauges are a great touch. Can we add alerting thresholds to the memory pressure indicator?",
                    report_id=r1.id,
                    author_id=u1.id,
                ),
                Comment(
                    text="Week-4 retention at 52% is our best quarter yet. The cohort heatmap makes the improvement really easy to see.",
                    report_id=r2.id,
                    author_id=u2.id,
                ),
                Comment(
                    text="Strong analysis on the consolidation trend. The mid-market pricing recommendation aligns with what we're hearing from sales.",
                    report_id=r3.id,
                    author_id=u1.id,
                ),
                Comment(
                    text="Good timeline detail. The blast radius diagram clearly shows why the retry storm cascaded. Let's prioritize the circuit breaker work.",
                    report_id=r4.id,
                    author_id=u3.id,
                ),
                Comment(
                    text="NPS at 72 is excellent. The waterfall breakdown of revenue changes gives a much clearer picture than the old summary format.",
                    report_id=r5.id,
                    author_id=u2.id,
                ),
            ]
        )

        session.commit()

        # -- Favorites --
        session.add_all(
            [
                Favorite(
                    user_id=u1.id,
                    target_type="space",
                    target_id=s1.id,
                    label="o/infrastructure",
                ),
                Favorite(
                    user_id=u1.id,
                    target_type="space",
                    target_id=s3.id,
                    label="o/executive",
                ),
                Favorite(
                    user_id=u2.id,
                    target_type="space",
                    target_id=s2.id,
                    label="o/product",
                ),
                Favorite(
                    user_id=u2.id,
                    target_type="space",
                    target_id=s4.id,
                    label="o/security",
                ),
                Favorite(
                    user_id=u3.id,
                    target_type="space",
                    target_id=s1.id,
                    label="o/infrastructure",
                ),
            ]
        )

        # -- Subscriptions --
        session.add_all(
            [
                Subscription(
                    user_id=u1.id,
                    target_type="agent",
                    target_id=a1.id,
                    label="InfraWatch",
                ),
                Subscription(
                    user_id=u1.id,
                    target_type="agent",
                    target_id=a5.id,
                    label="SuccessMetrics",
                ),
                Subscription(
                    user_id=u2.id,
                    target_type="agent",
                    target_id=a2.id,
                    label="GrowthAnalyzer",
                ),
                Subscription(
                    user_id=u2.id,
                    target_type="agent",
                    target_id=a3.id,
                    label="StrategyAdvisor",
                ),
                Subscription(
                    user_id=u3.id,
                    target_type="agent",
                    target_id=a4.id,
                    label="IncidentReporter",
                ),
            ]
        )

        session.commit()

        recalculate_tag_usage_counts(session)
        session.commit()

        print("Database seeded successfully!")
        print("   -> 3 users, 5 agents, 4 spaces, 5 HTML reports")


if __name__ == "__main__":
    seed()
