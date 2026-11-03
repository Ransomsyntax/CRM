# Integrations, protected fields and configuration sandboxes

These are executable application features, with the existing subscription, profile,
organization and record-access boundaries. They are not a compliance certification.

## Operator setup

Set `CRM_ENCRYPTION_KEYS` on the application service before connecting providers,
creating sandboxes or encrypting fields. Its value is a Fernet key generated with:

```sh
python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
```

Keep the key in the hosting secret store, separate from database exports. Never
commit it. Keep a protected backup: losing every key makes protected values
unrecoverable. For rotation, use `new_key,old_key`; new writes use the first key,
and reads accept retained keys. Do not remove an old key until its data has been
rewrapped or retired. The application fails closed when a required key is missing
or a ciphertext is invalid. There is no shared default or generated fallback key.

## Provider connections

Open Setup → Connections (also available through Integration Settings and
Marketplace). Add a provider-issued OAuth access token. Optional refresh token,
client ID, client secret and expiry support automatic refresh for Google,
Microsoft, Zoom and QuickBooks. Slack and Meta access tokens must be renewed
through the provider when needed. Credentials are write-only and encrypted.

Provider application registration, account consent, appropriate scopes and any
provider approval remain necessary. ChatGPT connector credentials are not copied
into this application. No customer account is silently connected.

| Provider | Sync inbox | Explicit confirmed action | Typical permissions/settings |
| --- | --- | --- | --- |
| Gmail | Message headers and snippets | Send one email | Gmail read/metadata and send scopes; authorized sender address for sending |
| Outlook | Messages and body previews | Send one email | Mail.Read, Mail.Send |
| Google Calendar | Calendar events | Create an event | Calendar event read/write scope; optional calendar_id |
| Outlook Calendar | Calendar events | Create an event | Calendars.ReadWrite |
| Slack | Accessible channels | Post one channel message | channels:read, chat:write; channel ID |
| Microsoft Teams | Joined teams | Post one channel message | Team.ReadBasic.All, ChannelMessage.Send; team and channel IDs |
| Zoom | Scheduled meetings | Create a scheduled meeting | User meeting read/write scopes |
| QuickBooks | Customers | Create a customer | Accounting scope; numeric realm_id; optional sandbox=true |
| Google Ads | Campaigns | Reporting only | Ads scope, developer token, customer_id; optional login_customer_id/api_version |
| Meta Ads | Campaign insights | Reporting only | ads_read; ad_account_id and supported api_version |

The adapters use fixed HTTPS hosts, reject redirects, bound response size and
process one batch per Sync click. Pagination cursors are retained. Remote IDs
deduplicate inbox records. Tokens and inbox data are encrypted, and provider errors
omit response bodies and credentials. Test actually calls the provider.

Selected mail, calendar/Zoom and QuickBooks customer inbox items can be imported
as CRM Emails, Activities and Accounts. Imports check module permissions and record
quotas, preserve the source identity and do not repeat an imported record.
Imports are one-way: remote edits do not silently overwrite an imported CRM record,
and remote deletions do not delete CRM data. Other provider records remain in the
integration inbox. The inbox shows the most recent 100 records.

Sending/creating requires in-app confirmation and applicable module permissions.
Each request has a unique key and a durable status. Repeating a completed request
returns the recorded reference. A timeout or uncertain provider result blocks
automatic retries; check the provider before initiating another action. An accepted
request is not a delivery receipt. Advertising budgets/campaigns are never mutated.

Disconnect deletes local credentials, inbox records and action tracking, retaining
already imported CRM records. Revoke the provider's OAuth grant there if required.

## Protected fields

Enterprise administrators with Manage Encryption can use Setup → Protected Fields.
Supported fields are non-unique custom text, multiline, email, phone, URL, numeric,
currency and date/time values, including custom fields on standard record layouts.
Native CRM columns, record names, lookup, unique and computed fields are excluded.
Plaintext defaults must be removed before enabling protection.

Enabling encryption backfills existing values and removes those fields' plaintext
from stored audit payloads in the same transaction. Future ORM writes encrypt before
persistence. Ciphertexts bind the organization, module and field identity. Audits
mask protected fields. Search/sort/report comparisons do not operate on ciphertext.

The separate Decrypt Protected Fields module permission controls plaintext reads,
in addition to field visibility and the Enterprise entitlement. Other users receive
`[Encrypted]`. Masked values are preserved when saving unrelated changes. Removal
requires both Manage Encryption and Decrypt permission. Downgrades retain encrypted
storage and mask protected values until entitlement is restored.

## Configuration sandbox

Enterprise users with Manage Sandbox can create an encrypted, isolated snapshot of
workflows, email templates, pipelines, validation rules and custom views. Customer
records, provider credentials, permissions, executable functions and infrastructure
are not copied. This is a configuration sandbox, not an arbitrary-code VM or a
second production application.

Save draft validates supported components without changing production. Test
evaluates workflow criteria against a supplied sample record and returns proposed
actions without executing them. Publish rechecks subscription and setup/module
permissions, validates every component, rejects foreign/duplicate source IDs and
requires the expected draft revision. A changed production snapshot blocks publish
until reconciled in a fresh sandbox. Successful publication is atomic and audited.
Omitted components are retained in production; deletion is not a sandbox operation.

## Verification

Coverage includes encrypted raw storage and audit masking, decryption permissions,
cross-tenant access, plan gates, provider request construction, token rotation,
refresh tokens, host/redirect restrictions, sync/import idempotency, confirmed action
idempotency, uncertain external outcomes, draft isolation, stale-production conflicts,
foreign component rejection, migration reversal and DOM/browser settings journeys.
Provider transport tests use controlled responses; live account operations require
account credentials and have not been represented as tested without them.
