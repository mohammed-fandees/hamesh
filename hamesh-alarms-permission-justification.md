# Chrome Web Store — `alarms` permission justification

Paste this into the Dashboard's **Privacy practices → Permission justifications → alarms** field.

---

A periodic, no-op background alarm (every 30 seconds, the shortest interval Chrome allows) keeps the background service worker from going fully idle, working around a known Chrome reliability issue with keyboard-shortcut delivery to a dormant extension. It reads and stores no data.
