# Siddur app – updates

- `Siddur.apk` – latest build (install this the first time).
- `latest.json` – the version info the app checks to find updates.
- `releases/` – the versioned APK that `latest.json` points to.
- `source/` – Android project and `release.sh` to build and publish a new version.

Every update must be signed with the same private key as the first install (not stored here).
