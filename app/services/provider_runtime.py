"""Bounded provider API adapters. URLs are fixed; secrets never enter responses or logs."""
import base64
import json
import re
import time
from datetime import datetime
from email.message import EmailMessage
from email.utils import parseaddr
from html import escape
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from fastapi import HTTPException

PROVIDERS = {
    "gmail": {"label": "Gmail", "feature": "gmail_outlook_integration", "entity": "emails"},
    "outlook": {"label": "Outlook", "feature": "gmail_outlook_integration", "entity": "emails"},
    "google_calendar": {"label": "Google Calendar", "feature": "calendar_integration", "entity": "activities"},
    "outlook_calendar": {"label": "Outlook Calendar", "feature": "calendar_integration", "entity": "activities"},
    "slack": {"label": "Slack", "feature": "collaboration_integrations", "entity": None},
    "teams": {"label": "Microsoft Teams", "feature": "collaboration_integrations", "entity": None},
    "zoom": {"label": "Zoom", "feature": "collaboration_integrations", "entity": "activities"},
    "quickbooks": {"label": "QuickBooks Customers", "feature": "quickbooks_integration", "entity": "accounts"},
    "google_ads": {"label": "Google Ads Campaigns", "feature": "google_ads_integration", "entity": None},
    "meta_ads": {"label": "Meta Ads Insights", "feature": "social_ads_integration", "entity": None},
}
HOSTS = {"gmail.googleapis.com", "www.googleapis.com", "graph.microsoft.com", "slack.com", "api.zoom.us",
         "quickbooks.api.intuit.com", "sandbox-quickbooks.api.intuit.com", "googleads.googleapis.com", "graph.facebook.com",
         "oauth2.googleapis.com", "login.microsoftonline.com", "oauth.platform.intuit.com", "zoom.us"}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request_json(url, token=None, *, data=None, form=None, headers=None):
    parts = urlsplit(url)
    if parts.scheme != "https" or parts.hostname not in HOSTS or parts.username or parts.password or parts.port not in (None, 443):
        raise HTTPException(422, "Unsupported provider address")
    request_headers = {"Accept": "application/json", **(headers or {})}
    if token:
        request_headers["Authorization"] = "Bearer " + token
    body = None
    if data is not None:
        request_headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode()
    elif form is not None:
        request_headers["Content-Type"] = "application/x-www-form-urlencoded"
        body = urlencode(form).encode()
    try:
        with build_opener(NoRedirect()).open(Request(url, data=body, headers=request_headers), timeout=25) as response:
            raw = response.read(2_000_001)
            if len(raw) > 2_000_000:
                raise HTTPException(502, "Provider response exceeds the supported batch size")
            result = json.loads(raw) if raw else {}
            if not isinstance(result, dict):
                raise HTTPException(502, "Provider returned an unsupported response format")
            if isinstance(result, dict) and (result.get("error") or result.get("ok") is False or result.get("Fault")):
                raise HTTPException(502, "Provider rejected this operation; check account access and scopes")
            return result
    except HTTPError as error:
        raise HTTPException(502, f"Provider returned HTTP {error.code}; reconnect or check account scopes") from None
    except (URLError, TimeoutError, ValueError, OSError):
        raise HTTPException(502, "Provider could not be reached or returned an invalid response") from None


def refresh(provider, credentials):
    if not credentials.get("expires_at") or float(credentials["expires_at"]) > time.time() + 60:
        return credentials
    if not all(credentials.get(key) for key in ("refresh_token", "client_id", "client_secret")):
        raise HTTPException(409, "The access token expired. Reconnect this integration.")
    endpoints = {"gmail": "https://oauth2.googleapis.com/token", "google_calendar": "https://oauth2.googleapis.com/token",
        "google_ads": "https://oauth2.googleapis.com/token", "outlook": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        "outlook_calendar": "https://login.microsoftonline.com/common/oauth2/v2.0/token", "teams": "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        "quickbooks": "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", "zoom": "https://zoom.us/oauth/token"}
    if provider not in endpoints:
        raise HTTPException(409, "Reconnect this provider to renew its access token")
    form = {"grant_type": "refresh_token", "refresh_token": credentials["refresh_token"]}
    headers = {}
    if provider in {"quickbooks", "zoom"}:
        headers["Authorization"] = "Basic " + base64.b64encode((credentials["client_id"] + ":" + credentials["client_secret"]).encode()).decode()
    else:
        form.update({key: credentials[key] for key in ("client_id", "client_secret")})
    result = request_json(endpoints[provider], form=form, headers=headers)
    if not result.get("access_token"):
        raise HTTPException(502, "Provider did not return a renewed access token")
    return {**credentials, "access_token": result["access_token"],
            "refresh_token": result.get("refresh_token", credentials["refresh_token"]),
            "expires_at": time.time() + int(result.get("expires_in", 3600))}


def identifier(config, key):
    value = str(config.get(key) or "")
    if not re.fullmatch(r"[0-9]{1,30}", value):
        raise HTTPException(422, f"A numeric {key.replace('_', ' ')} is required")
    return value


def version(config, default=None):
    value = str(config.get("api_version") or default or "")
    if not re.fullmatch(r"v[0-9]{1,3}(?:\.0)?", value):
        raise HTTPException(422, "Set the provider's supported API version, for example v26 or v25.0")
    return value


def graph_page(url, expected_path):
    if not url.startswith("https://graph.microsoft.com/v1.0/" + expected_path):
        raise HTTPException(422, "Invalid Microsoft pagination cursor")
    return url


def fetch_batch(provider, credentials, config, cursor=None):
    token = credentials["access_token"]
    get = lambda url, **kwargs: request_json(url, token, **kwargs)
    if provider == "gmail":
        result = get("https://gmail.googleapis.com/gmail/v1/users/me/messages?" + urlencode({"maxResults": 25, **({"pageToken": cursor} if cursor else {})}))
        items = []
        for item in result.get("messages", []):
            message = get("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + quote(str(item["id"]), safe="") + "?format=metadata")
            headers = {h["name"].lower(): h["value"] for h in message.get("payload", {}).get("headers", [])}
            items.append({"id": message["id"], "title": headers.get("subject", "(No subject)"), "from": headers.get("from", ""), "to": headers.get("to", ""), "body": message.get("snippet", "")})
        return items, result.get("nextPageToken")
    if provider in {"outlook", "outlook_calendar", "teams"}:
        path = {"outlook": "me/messages", "outlook_calendar": "me/events", "teams": "me/joinedTeams"}[provider]
        query = {"outlook": "?$top=25&$select=id,subject,from,toRecipients,bodyPreview", "outlook_calendar": "?$top=25&$select=id,subject,start,end,bodyPreview", "teams": ""}[provider]
        result = get(graph_page(cursor, path) if cursor else "https://graph.microsoft.com/v1.0/" + path + query,
            headers={"Prefer": 'outlook.timezone="UTC"'} if provider == "outlook_calendar" else {})
        return [{**item, "title": item.get("subject") or item.get("displayName") or item["id"]} for item in result.get("value", [])], result.get("@odata.nextLink")
    if provider == "google_calendar":
        calendar = quote(str(config.get("calendar_id") or "primary"), safe="")
        result = get(f"https://www.googleapis.com/calendar/v3/calendars/{calendar}/events?" + urlencode({"maxResults": 25, **({"pageToken": cursor} if cursor else {})}))
        return [{**item, "title": item.get("summary", "Calendar event")} for item in result.get("items", [])], result.get("nextPageToken")
    if provider == "slack":
        result = get("https://slack.com/api/conversations.list?" + urlencode({"limit": 25, "exclude_archived": "true", **({"cursor": cursor} if cursor else {})}))
        return [{"id": item["id"], "title": item["name"], "purpose": item.get("purpose", {}).get("value", "")} for item in result.get("channels", [])], result.get("response_metadata", {}).get("next_cursor") or None
    if provider == "zoom":
        result = get("https://api.zoom.us/v2/users/me/meetings?" + urlencode({"page_size": 25, **({"next_page_token": cursor} if cursor else {})}))
        return [{**item, "title": item.get("topic", "Zoom meeting")} for item in result.get("meetings", [])], result.get("next_page_token") or None
    if provider == "quickbooks":
        realm = identifier(config, "realm_id")
        start = int(cursor or 1)
        if not 1 <= start <= 1_000_000:
            raise HTTPException(422, "Invalid QuickBooks pagination position")
        host = "sandbox-quickbooks.api.intuit.com" if config.get("sandbox") is True else "quickbooks.api.intuit.com"
        result = get(f"https://{host}/v3/company/{realm}/query?" + urlencode({"query": f"SELECT * FROM Customer STARTPOSITION {start} MAXRESULTS 25"}))
        items = result.get("QueryResponse", {}).get("Customer", [])
        return [{**item, "id": str(item["Id"]), "title": item.get("DisplayName", "Customer")} for item in items], str(start + 25) if len(items) == 25 else None
    if provider == "google_ads":
        customer = identifier(config, "customer_id")
        headers = {"developer-token": credentials.get("developer_token", "")}
        if not headers["developer-token"]:
            raise HTTPException(422, "A Google Ads developer token is required")
        if config.get("login_customer_id"):
            headers["login-customer-id"] = identifier(config, "login_customer_id")
        result = get(f"https://googleads.googleapis.com/{version(config, 'v26')}/customers/{customer}/googleAds:search",
            headers=headers, data={"query": "SELECT campaign.id, campaign.name, campaign.status FROM campaign LIMIT 100", **({"pageToken": cursor} if cursor else {})})
        return [{"id": str(item["campaign"]["id"]), "title": item["campaign"]["name"], "status": item["campaign"].get("status")} for item in result.get("results", [])], result.get("nextPageToken")
    if provider == "meta_ads":
        account = identifier(config, "ad_account_id")
        result = get(f"https://graph.facebook.com/{version(config)}/act_{account}/insights?" + urlencode({"fields": "campaign_id,campaign_name,impressions,clicks,spend,date_start,date_stop", "level": "campaign", "limit": 25, **({"after": cursor} if cursor else {})}))
        return [{**item, "id": str(item["campaign_id"]) + ":" + item["date_start"] + ":" + item["date_stop"], "title": item.get("campaign_name", "Campaign")} for item in result.get("data", [])], result.get("paging", {}).get("cursors", {}).get("after") if result.get("paging", {}).get("next") else None
    raise HTTPException(422, "Unsupported provider")


def prepare_write(provider, config, values):
    """Validate an explicit action and build its fixed provider request before dispatch."""
    if not isinstance(values, dict) or len(json.dumps(values)) > 50000:
        raise HTTPException(422, "Provide a small action payload")
    def text(key, limit=10000):
        value = values.get(key)
        if not isinstance(value, str) or not value.strip() or len(value) > limit:
            raise HTTPException(422, f"A valid {key.replace('_', ' ')} is required")
        return value.strip()
    def recipient():
        value=text("to",180)
        if parseaddr(value)[1] != value or '@' not in value or '\n' in value or '\r' in value:
            raise HTTPException(422, "Provide one valid recipient email address")
        return value
    if provider in {"gmail", "outlook"}:
        target, subject, body = recipient(), text("subject",220), text("body")
        if '\n' in subject or '\r' in subject:
            raise HTTPException(422, "Email subject must be a single line")
        if provider == "gmail":
            sender=text('from',180)
            if parseaddr(sender)[1]!=sender or '@' not in sender or '\n' in sender or '\r' in sender:
                raise HTTPException(422,'Provide the authorized Gmail sender address')
            message=EmailMessage(); message['From']=sender; message['To']=target; message['Subject']=subject; message.set_content(body)
            return "https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {"raw":base64.urlsafe_b64encode(message.as_bytes()).decode()}
        return "https://graph.microsoft.com/v1.0/me/sendMail", {"message":{"subject":subject,"body":{"contentType":"Text","content":body},"toRecipients":[{"emailAddress":{"address":target}}]},"saveToSentItems":True}
    if provider in {"google_calendar", "outlook_calendar", "zoom"}:
        subject, start = text("subject",180), text("start",80)
        try:
            parsed=datetime.fromisoformat(start.replace('Z','+00:00'))
            if parsed.tzinfo is None:
                raise ValueError()
        except ValueError:
            raise HTTPException(422, "Start must be an ISO date/time with a UTC offset")
        if provider == "zoom":
            duration=values.get('duration',30)
            if type(duration) is not int or not 1 <= duration <= 1440:
                raise HTTPException(422, "Duration must be 1–1440 minutes")
            return "https://api.zoom.us/v2/users/me/meetings", {"topic":subject,"type":2,"start_time":start,"duration":duration}
        end=text('end',80)
        try:
            finish=datetime.fromisoformat(end.replace('Z','+00:00'))
            if finish.tzinfo is None or finish<=parsed:
                raise ValueError()
        except (ValueError,TypeError):
            raise HTTPException(422, "End must be after start and include a UTC offset")
        if provider == 'google_calendar':
            calendar=quote(str(config.get('calendar_id') or 'primary'),safe='')
            return f'https://www.googleapis.com/calendar/v3/calendars/{calendar}/events', {'summary':subject,'start':{'dateTime':start},'end':{'dateTime':end}}
        from datetime import timezone
        return 'https://graph.microsoft.com/v1.0/me/events', {'subject':subject,'start':{'dateTime':parsed.astimezone(timezone.utc).replace(tzinfo=None).isoformat(),'timeZone':'UTC'},'end':{'dateTime':finish.astimezone(timezone.utc).replace(tzinfo=None).isoformat(),'timeZone':'UTC'}}
    if provider == 'slack':
        channel=text('channel',100)
        if not re.fullmatch(r'[A-Z0-9]+',channel):
            raise HTTPException(422,'Use the Slack channel ID')
        return 'https://slack.com/api/chat.postMessage', {'channel':channel,'text':text('body')}
    if provider == 'teams':
        team,channel=text('team_id',100),text('channel_id',200)
        return 'https://graph.microsoft.com/v1.0/teams/'+quote(team,safe='')+'/channels/'+quote(channel,safe='')+'/messages', {'body':{'contentType':'html','content':escape(text('body'))}}
    if provider == 'quickbooks':
        realm=identifier(config,'realm_id')
        host='sandbox-quickbooks.api.intuit.com' if config.get('sandbox') is True else 'quickbooks.api.intuit.com'
        return f'https://{host}/v3/company/{realm}/customer', {'DisplayName':text('name',100),'PrimaryEmailAddr':{'Address':recipient()}}
    raise HTTPException(422,'This provider supports reporting only; no advertising changes are sent')
