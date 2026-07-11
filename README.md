# GoalRPG

An offline-first personal consistency tracker. It uses plain HTML, CSS, and JavaScript with local browser storage; there are no runtime dependencies or accounts.

## Run locally

Serve the folder over HTTP (service workers do not run from `file://`). For example:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Data

All entries stay in local browser storage under `ova-data-v1`. Use **Data → Export GoalRPG backup** regularly. Restoring a backup replaces the current local dataset.
