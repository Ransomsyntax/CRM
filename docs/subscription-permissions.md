# Subscription and profile access

The server combines the organization's effective subscription, the user's module
and feature grants, setup capabilities, record sharing and organization quotas.
Customer administrators cannot bypass plan entitlements. The deployment's
platform owner retains its existing separate recovery and billing console.

## Plans

The capability catalog is in `app/entitlements.py`. Higher tiers inherit lower-tier
capabilities, except Bigin Express has no custom modules and QuickBooks is available
only in Bigin Express and Enterprise, matching the explicit pricing cards.
The displayed INR per-user prices and record/module limits are unchanged.
Existing Apex assistant access in Standard is preserved; AI agents and prediction
require Professional, and advanced AI studio/vision require Enterprise.

The catalog records advertised entitlements, not a compliance certification.
The follow-up enterprise runtime provides encrypted provider credentials, live
provider API adapters, protected custom-field storage and an isolated configuration
sandbox. See [enterprise-runtime.md](enterprise-runtime.md) for supported operations,
provider consent/scopes and encryption-key setup. HIPAA verification remains false.

## Administration

- Setup → Profiles creates named organization-scoped profiles with no initial access.
- Profiles edit module operations, setup administration and feature use independently.
- Unavailable subscription capabilities are locked in the editor. Saving a profile
  cannot activate them. Stored grants survive plan changes.
- Module Permissions previews effective permissions, including subscription gates.
- Standard and Team Manager profiles deny destructive/bulk/export/import actions
  until explicitly granted. Read Only defaults to read operations.
- Organization owners configure billing and appoint administrators. Other admins
  cannot edit their own profile or delegate privileges they do not hold.
- Add User opens a full-page invitation form and accepts an organization profile.
  Invitations persist the role/profile and apply them when accepted.
- The invitation result preserves SMTP delivery status and displays a shareable
  link. Existing invitation-delivery behavior is retained.
- Deactivation revokes sessions and releases the membership's seat. The
  organization owner must remain active. Reactivation rechecks subscription capacity.

## Seats and billing

Free permits three active memberships plus unexpired pending invitations. Paid
plans use `organization_subscriptions.purchased_seats`, rather than invented tier
user limits. Owner Console → Customers → Subscription configures provisioned seats.
Hosted checkout accepts an integer seat quantity covering existing users and
pending invitations; it grants that quantity only after verified payment.
Pending checkout quantities cannot be changed under an existing payment reference.

Migration `0035_subscription_permissions` introduces seats and invitation assignments.
Existing subscriptions start at the greater of three seats or their active members
plus valid pending invitations, preserving access during rollout. Future seat
reductions preserve data and existing memberships while blocking new reservations.
No customer records or existing permissions are deleted.

## Enforcement and boundaries

Alternate API routes, bulk operations, custom modules and public webform submissions
use the applicable plan checks. Pipeline creation distinguishes a single pipeline
from multiple pipelines. Reporting hierarchy stops granting subordinate visibility
after downgrade. Legacy user mutation routes delegate to the protected lifecycle
handlers, and profile writes use the validated profile editor.

The feature catalog covers the screenshot capabilities. Operational controls apply
to existing routes and runtime handlers. Provider registration and account consent
remain necessary. The configuration sandbox does not execute arbitrary code, and
protected fields currently cover supported custom values rather than native CRM columns.

## Validation

Regression coverage includes all five plan capability sets, explicit exceptions,
effective previews, invitation assignments, paid seats, acceptance/reactivation
quota checks, owner protection, alternate routes, checkout provisioning, and a
data-preserving migration. A Chromium journey creates a profile, edits grants,
verifies locked capabilities and invites a user from the full-page form.
