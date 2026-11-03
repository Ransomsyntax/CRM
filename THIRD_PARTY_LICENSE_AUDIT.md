# CONVOSIS CRM — Third-Party License Audit (Preliminary)

Audit date: 2026-10-16  
Scope: repository root `requirements.txt`, `package.json`, and `Dockerfile` reviewed via GitHub. **This is not a complete software bill of materials or legal clearance.** No installed transitive package tree, lockfile, source-asset inventory, bundled frontend library, or license texts were independently verified.

## Direct dependencies identified

| Ecosystem | Declared packages | Follow-up |
| --- | --- | --- |
| Python web | fastapi 0.142.2; uvicorn[standard] 0.53.0; sqlalchemy 2.0.44; psycopg[binary] 3.2.13; pymysql 1.1.1; alembic 1.20.0; pydantic-settings 2.7.1; python-multipart 0.0.32 | Retrieve exact distribution metadata, LICENSE files, and transitive dependencies. |
| Python office & imaging | openpyxl 3.1.5; xlrd 2.0.2; reportlab 4.4.4; Pillow >=11,<13 | Audit license notices, font/image redistribution and deployed binary dependencies. Pillow is not exact-pinned: resolve deployed version. |
| Node development | jsdom 30.1.3 | Audit npm transitive packages and any frontend shipped code separately. |
| Runtime image | python:3.12-slim | Audit OS packages and container base image notices. |

## Notable risks and required checks

1. **Source and media assets:** Enumerate all JS/CSS/fonts/icons/logos/images/templates and inspect provenance. A repository-level proprietary notice does not override their licenses. Do not assume externally sourced CRM icons, screenshots, fonts or imagery are owned.
2. **Dependency accuracy:** Generate a full SBOM using the exact deployed build and inspect package license metadata, notices, attribution and source-offer duties if applicable. Direct dependency lists alone are insufficient.
3. **Deployment:** Check any copied dependencies/assets inside the Docker image, including OS packages and bundled wheel binaries.
4. **Commercial compliance:** Include mandated attributions in a distributable `THIRD_PARTY_NOTICES` document, only after verifying exact versions and texts. Do not substitute guessed SPDX labels.
5. **History/security:** Public Git history can remain in clones and forks even after changing visibility. Inspect repository history for credentials/secrets and rotate any exposed keys.

## Suggested verification commands

```bash
python -m pip install pip-licenses pip-audit
pip-licenses --with-urls --with-license-file --format=json > python-licenses.json
python -m pip freeze > installed-python-packages.txt
npm ls --all --json > npm-tree.json
npx license-checker --json > npm-licenses.json
```

These are *suggested* commands, not claimed execution or verified findings. Manually investigate unknown, missing, copyleft or unusual license metadata. Review legal obligations with counsel before commercial distribution.

**Status:** Manifest inventory complete; full third-party licensing and asset-compliance clearance **pending**.
